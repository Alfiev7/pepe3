'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import io from 'socket.io-client'

type Coin = {
  _id: string;
  name: string;
  symbol: string;
  price: number;
  supply: number;
  priceChange24h: number;
}

type Holdings = {
  [key: string]: number;
}

type User = {
  _id: string;
  username: string;
  balance: number;
  holdings: Holdings;
}

type Notification = {
  message: string;
  type: 'success' | 'error';
}

export default function Marketplace() {
  const [user, setUser] = useState<User | null>(null)
  const [coins, setCoins] = useState<Coin[]>([])
  const [notification, setNotification] = useState<Notification | null>(null)
  const [buyAmounts, setBuyAmounts] = useState<{[key: string]: string}>({})
  const [sellAmounts, setSellAmounts] = useState<{[key: string]: string}>({})
  const router = useRouter()

  const fetchUserData = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!userRes.ok) {
        throw new Error('Failed to fetch user data');
      }
      const userData = await userRes.json();
      setUser(userData);
    } catch (error) {
      console.error('Error fetching user data:', error)
      router.push('/login')
    }
  }, [router])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    const fetchData = async () => {
      try {
        const [userRes, coinsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/coins`)
        ]);
        if (!userRes.ok || !coinsRes.ok) {
          throw new Error('Failed to fetch data');
        }
        const userData = await userRes.json();
        const coinsData = await coinsRes.json();
        setUser(userData);
        setCoins(coinsData);
      } catch (error) {
        console.error('Error fetching data:', error)
        router.push('/login')
      }
    }

    fetchData()

    const socket = io(process.env.NEXT_PUBLIC_API_URL || '')

    socket.on('priceUpdate', (updatedCoins) => {
      setCoins(prevCoins => 
        prevCoins.map(coin => {
          if (Array.isArray(updatedCoins)) {
            const updatedCoin = updatedCoins.find(c => c._id === coin._id);
            return updatedCoin ? { ...coin, ...updatedCoin } : coin;
          } else if (updatedCoins && typeof updatedCoins === 'object' && '_id' in updatedCoins) {
            return updatedCoins._id === coin._id ? { ...coin, ...updatedCoins } : coin;
          }
          return coin;
        })
      );
    })

    socket.on('userUpdate', (updatedUser) => {
      console.log('Received user update:', updatedUser);
      setUser(prevUser => {
        console.log('Previous user state:', prevUser);
        console.log('New user state:', updatedUser);
        return updatedUser;
      });
    })

    return () => {
      socket.disconnect()
    }
  }, [router, fetchUserData])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const handleTransaction = async (coinId: string, type: 'buy' | 'sell', amount: number) => {
    const token = localStorage.getItem('token')
    if (!token || !user) return

    if (isNaN(amount) || amount <= 0) {
      setNotification({
        message: 'Please enter a valid amount greater than 0',
        type: 'error'
      });
      return;
    }

    console.log('Transaction request:', { coinId, type, amount });

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ coinId, type, amount })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Transaction failed')
      }

      const data = await res.json();
      console.log('Transaction response:', data);
      setUser(data.user);
      console.log('Updated user data after transaction:', data.user);
      
      const coin = coins.find(c => c.symbol === coinId)
      if (coin) {
        setNotification({ 
          message: `Successfully ${type === 'buy' ? 'bought' : 'sold'} ${amount} of ${coin.name}`, 
          type: 'success' 
        })
      } else {
        setNotification({ 
          message: `Transaction successful`, 
          type: 'success' 
        })
      }

      if (type === 'buy') {
        setBuyAmounts(prev => ({ ...prev, [coinId]: '' }))
      
      } else {
        setSellAmounts(prev => ({ ...prev, [coinId]: '' }))
      }

      // Fetch updated user data after transaction
      await fetchUserData();
    } catch (error) {
      console.error('Transaction error:', error);
      let errorMessage = 'An error occurred. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String(error.message);
      }
      setNotification({ 
        message: errorMessage, 
        type: 'error' 
      });
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  const handleBuyAmountChange = (coinId: string, value: string) => {
    setBuyAmounts(prev => ({ ...prev, [coinId]: value }))
  }

  const handleSellAmountChange = (coinId: string, value: string) => {
    setSellAmounts(prev => ({ ...prev, [coinId]: value  }))
  }

  if (!user || coins.length === 0) return <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">Loading...</div>

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100">
      <nav className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg sticky top-0 z-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between h-auto sm:h-16 py-2 sm:py-0">
            <div className="flex items-center justify-center w-full sm:w-auto mb-2 sm:mb-0">
              <Image
                src="/icons/Pepe_nervous_sweat.png"
                alt="PepeExchange Logo"
                width={32}
                height={32}
                className="w-8 h-8"
                priority
              />
              <span className="text-xl font-bold text-green-400 ml-2">PepeExchange</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition duration-150 ease-in-out">
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition duration-150 ease-in-out"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-lg shadow-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div className="mb-4 sm:mb-0">
                <h2 className="text-xl font-bold text-white">Your Balance</h2>
                <p className="text-green-400 text-2xl sm:text-3xl font-bold">{formatCurrency(user.balance)}</p>
              </div>
              <div className="text-left sm:text-right w-full sm:w-auto">
                <p className="text-sm text-gray-400">Total Assets</p>
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {formatCurrency(user.balance + Object.entries(user.holdings).reduce((total, [coinId, amount]) => {
                    const coin = coins.find(c => c.symbol === coinId)
                    return total + (coin ? coin.price * amount : 0)
                  }, 0))}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {coins.map(coin => (
              <div key={coin._id} className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg rounded-lg shadow-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-white">{coin.name}</h3>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-900 text-green-400">
                      {coin.symbol}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline mb-4">
                    <div className="text-2xl font-bold text-white">{formatCurrency(coin.price)}</div>
                    <div className={`text-sm font-medium ${coin.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {coin.priceChange24h >= 0 ? '▲' : '▼'} {Math.abs(coin.priceChange24h).toFixed(2)}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mb-4">Your holdings: {user.holdings[coin.symbol] || 0} {coin.symbol}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="number"
                        id={`buy-${coin._id}`}
                        value={buyAmounts[coin._id] || ''}
                        onChange={(e) => handleBuyAmountChange(coin._id, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="Amount to buy"
                        min="0"
                        step="0.01"
                      />
                      {buyAmounts[coin._id] && (
                        <p className="text-sm text-gray-400 mt-1">
                          ≈ {formatCurrency(parseFloat(buyAmounts[coin._id]) * coin.price)}
                        </p>
                      )}
                      <button
                        onClick={() => {
                          const amount = parseFloat(buyAmounts[coin._id])
                          if (amount > 0) handleTransaction(coin.symbol, 'buy', amount)
                        }}
                        className="w-full mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition duration-150 ease-in-out"
                      >
                        Buy
                      </button>
                    </div>
                    <div>
                      <input
                        type="number"
                        id={`sell-${coin._id}`}
                        value={sellAmounts[coin._id] || ''}
                        onChange={(e) => handleSellAmountChange(coin._id, e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Amount to sell"
                        min="0"
                        step="0.01"
                      />
                      {sellAmounts[coin._id] && (
                        <p className="text-sm text-gray-400 mt-1">
                          ≈ {formatCurrency(parseFloat(sellAmounts[coin._id]) * coin.price)}
                        </p>
                      )}
                      <button
                        onClick={() => {
                          const amount = parseFloat(sellAmounts[coin._id])
                          if (amount > 0) handleTransaction(coin.symbol, 'sell', amount)
                        }}
                        className="w-full mt-2 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition duration-150 ease-in-out"
                      >
                        Sell
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg mt-8">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between  items-center">
            <p className="text-gray-400 text-sm">© 2023 PepeExchange. All rights reserved.</p>
            <div className="flex space-x-4">
            </div>
          
          </div>
        </div>
      </footer>

      {notification && (
        <div className={`fixed bottom-4 right-4 px-4 py-2 rounded-md ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {notification.message}
          <button onClick={() => setNotification(null)} className="ml-2 text-white font-bold">×</button>
        </div>
      )}
    </div>
  )
}