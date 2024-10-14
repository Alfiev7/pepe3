const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');
    initializeDatabase();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// User model
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  balance: Number,
  holdings: {
    type: Map,
    of: Number,
    default: () => new Map()
  }
});

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    if (ret.holdings instanceof Map) {
      ret.holdings = Object.fromEntries(ret.holdings);
    } else if (typeof ret.holdings === 'object' && ret.holdings !== null) {
      ret.holdings = { ...ret.holdings };
    } else {
      ret.holdings = {};
    }
    return ret;
  }
});

const User = mongoose.model('User', userSchema);

// Coin model
const Coin = mongoose.model('Coin', {
  name: String,
  symbol: String,
  price: Number,
  supply: Number,
  priceHistory: Array,
  priceChange24h: Number
});

// Transaction model
const Transaction = mongoose.model('Transaction', {
  userId: mongoose.Schema.Types.ObjectId,
  coinId: String,
  type: String,
  amount: Number,
  price: Number,
  timestamp: Date
});

// Initialize database with some coins
async function initializeDatabase() {
  const coinsCount = await Coin.countDocuments();
  if (coinsCount === 0) {
    const initialCoins = [
      { name: 'Bitcoin', symbol: 'BTC', price: 50000, supply: 21000000 },
      { name: 'Ethereum', symbol: 'ETH', price: 3000, supply: 100000000 },
      { name: 'Litecoin', symbol: 'LTC', price: 150, supply: 84000000 },
    ];

    for (let coin of initialCoins) {
      const newCoin = new Coin({
        ...coin,
        priceHistory: [{ price: coin.price, timestamp: new Date() }],
        priceChange24h: 0
      });
      await newCoin.save();
    }
    console.log('Initial coins created');
  }
}

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) {
    console.log('No token provided');
    return res.status(401).json({ message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log('Token verification failed:', err.message);
      return res.status(403).json({ message: 'Invalid token' });
    }
    console.log('Token verified successfully for user:', user._id);
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      password: hashedPassword,
      balance: 10000,
      holdings: new Map()
    });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error registering user' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.body.username });
    if (user == null) {
      return res.status(400).json({ message: 'Cannot find user' });
    }
    if (await bcrypt.compare(req.body.password, user.password)) {
      const accessToken = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
      res.json({ accessToken: accessToken });
    } else {
      res.status(401).json({ message: 'Not Allowed' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error logging in' });
  }
});

app.get('/api/user', authenticateToken, async (req, res) => {
  try {
    console.log('Fetching user data for:', req.user._id);
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      console.log('User not found:', req.user._id);
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('User data retrieved:', user);
    res.json(user);
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ message: 'Error fetching user data', error: error.message });
  }
});

app.get('/api/coins', async (req, res) => {
  try {
    const coins = await Coin.find();
    res.json(coins);
  } catch (error) {
    console.error('Error fetching coins:', error);
    res.status(500).json({ message: 'Error fetching coins', error: error.message });
  }
});

const updateCoinPrice = async (coin, type, amount) => {
  const priceImpact = 0.00001 * amount; // 0.01% price impact per unit
  const multiplier = type === 'buy' ? 1 + priceImpact : 1 - priceImpact;
  coin.price *= multiplier;
  await coin.save();
  
  io.emit('priceUpdate', { 
    _id: coin._id,
    symbol: coin.symbol,
    price: coin.price,
    priceChange24h: coin.priceChange24h
  });
};

app.post('/api/transaction', authenticateToken, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { coinId, type, amount } = req.body;
    const userId = req.user._id;

    console.log('Transaction request:', { userId, coinId, type, amount });

    if (!coinId || !type || amount <= 0) {
      throw new Error('Invalid input: coinId, type, and amount (> 0) are required');
    }

    const user = await User.findById(userId).session(session);
    const coin = await Coin.findOne({ symbol: coinId }).session(session);

    if (!user || !coin) {
      throw new Error('User or Coin not found');
    }

    console.log('User and coin found:', { userId: user._id, coinId: coin._id });

    const totalPrice = amount * coin.price;

    if (type === 'buy') {
      if (user.balance < totalPrice) {
        throw new Error('Insufficient funds');
      }
      user.balance -= totalPrice;
      const currentHolding = user.holdings.get(coin.symbol) || 0;
      user.holdings.set(coin.symbol, currentHolding + amount);
      await updateCoinPrice(coin, 'buy', amount);
    } else if (type === 'sell') {
      const currentHolding = user.holdings.get(coin.symbol) || 0;
      if (currentHolding < amount) {
        throw new Error('Insufficient coin balance');
      }
      user.balance += totalPrice;
      user.holdings.set(coin.symbol, currentHolding - amount);
      if (user.holdings.get(coin.symbol) === 0) {
        user.holdings.delete(coin.symbol);
      }
      await updateCoinPrice(coin, 'sell', amount);
    } else {
      throw new Error('Invalid transaction type');
    }

    const transaction = new Transaction({
      userId: user._id,
      coinId: coin._id,
      type,
      amount,
      price: coin.price,
      timestamp: new Date()
    });

    await transaction.save({ session });
    await user.save({ session });

    await session.commitTransaction();
    
    console.log('Transaction successful:', transaction);
    console.log('Updated user data:', user);

    // Emit user update to all connected clients
    io.emit('userUpdate', user);
    
    res.status(200).json({ message: 'Transaction successful', user });
  } catch (error) {
    await session.abortTransaction();
    console.error('Transaction error:', error);
    res.status(400).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user._id }).sort({ timestamp: -1 }).limit(5);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Error fetching transactions', error: error.message });
  }
});

// Function to generate random price fluctuations
const generatePriceFluctuation = () => {
  return (Math.random() * 0.6 - 0.3) / 100; // Random number between -0.3% and 0.3%
};

// Update coin prices every 2 seconds
setInterval(async () => {
  try {
    const coins = await Coin.find();
    for (let coin of coins) {
      const priceChange = generatePriceFluctuation();
      const newPrice = coin.price * (1 + priceChange);
      
      coin.priceHistory.push({ price: newPrice, timestamp: new Date() });
      if (coin.priceHistory.length > 1440) { // Keep only last 24 hours (1440 minutes)
        coin.priceHistory.shift();
      }
      
      const oldPrice = coin.priceHistory[0].price;
      const priceChange24h = (newPrice - oldPrice) / oldPrice * 100;

      coin.price = newPrice;
      coin.priceChange24h = priceChange24h;

      await coin.save();
      
      io.emit('priceUpdate', { 
        _id: coin._id,
        symbol: coin.symbol,
        price: newPrice, 
        priceChange24h: priceChange24h 
      });
    }
  } catch (error) {
    console.error('Error updating coin prices:', error);
  }
}, 2000);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));