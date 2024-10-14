'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import io from 'socket.io-client'
import Image from 'next/image'

type Coin = {
  _id: string;
  name: string;
  symbol: string;
  price: number;
  supply: number;
  priceChange24h: number;
}

type Transaction = {
  _id: string;
  coinId: string;
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  timestamp: string;
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

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [coins, setCoins] = useState<Coin[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const fetchData = async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const [userRes, coinsRes, transactionsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/user`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/coins`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/transactions`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!userRes.ok || !coinsRes.ok || !transactionsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const userData = await userRes.json();
      const coinsData = await coinsRes.json();
      const transactionsData = await transactionsRes.json();

      setUser(userData);
      setCoins(coinsData);
      setTransactions(transactionsData);
      setError(null);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const socket = io(`${process.env.NEXT_PUBLIC_API_URL}`);

    socket.on('priceUpdate', (update) => {
      setCoins(prevCoins => 
        prevCoins.map(coin => 
          coin._id === update._id ? { ...coin, price: update.price, supply: update.supply, priceChange24h: update.priceChange24h } : coin
        )
      );
    });

    socket.on('userUpdate', (updatedUser) => {
      setUser(updatedUser);
    });

    return () => {
      socket.disconnect();
    };
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token')
    router.push('/login')
  }

  const calculateTotalValue = () => {
    if (!user || !coins.length) return 0;
    return Object.entries(user.holdings).reduce((total, [coinSymbol, amount]) => {
      const coin = coins.find(c => c.symbol === coinSymbol)
      return total + (coin ? coin.price * amount : 0)
    }, 0)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-xl font-semibold">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="text-center bg-gray-800 p-8 rounded-lg shadow-lg">
          <p className="text-red-500 mb-4 text-xl">{error}</p>
          <div className="space-y-4">
            <button
              onClick={fetchData}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300 ease-in-out w-full"
            >
              Retry
            </button>
            <button
              onClick={() => router.push('/login')}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-300 ease-in-out w-full"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user || coins.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="text-center">
          <p className="text-xl font-semibold mb-4">No data available</p>
          <button
            onClick={fetchData}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-300 ease-in-out"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalValue = user.balance + calculateTotalValue()
  const portfolioValue = calculateTotalValue()

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
              <Link href="/marketplace" className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition duration-150 ease-in-out">
                Marketplace
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
          <div className="grid grid-cols-1 gap-6 mb-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg overflow-hidden shadow-lg rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">Total Balance</dt>
                      <dd className="text-lg sm:text-2xl font-semibold text-white">{formatCurrency(totalValue)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg overflow-hidden shadow-lg rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">Portfolio Value</dt>
                      <dd className="text-lg sm:text-2xl font-semibold text-white">{formatCurrency(portfolioValue)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg overflow-hidden shadow-lg rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0 bg-yellow-500 rounded-md p-3">
                    <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-400 truncate">Cash Balance</dt>
                      <dd className="text-lg sm:text-2xl font-semibold text-white">{formatCurrency(user.balance)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg shadow-lg rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-white">Your Holdings</h2>
              <div className="space-y-2">
                {Object.entries(user.holdings).map(([coinSymbol, amount]) => {
                  const coin = coins.find(c => c.symbol === coinSymbol)
                  if (!coin) return null
                  return (
                    <div key={coinSymbol} className="flex items-center justify-between p-2 rounded-lg border border-gray-700">
                      <div className="flex items-center space-x-2 overflow-hidden">
                        <p className="font-medium text-white truncate">{coin.name}</p>
                        <p className="text-sm text-gray-400 whitespace-nowrap">{amount} {coin.symbol}</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <p className="font-medium text-white whitespace-nowrap">{formatCurrency(amount * coin.price)}</p>
                        <p className={`text-sm ${coin.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {coin.priceChange24h >= 0 ? '▲' : '▼'} {Math.abs(coin.priceChange24h).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg shadow-lg rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-white">Market Overview</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {coins.map(coin => (
                <div key={coin._id} className="bg-gray-700 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold text-white">{coin.name || 'Unknown'}</h3>
                    <span className="text-sm text-gray-400">{coin.symbol || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-xl font-bold text-white">{formatCurrency(coin.price || 0)}</p>
                    <p className={`text-sm ${(coin.priceChange24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(coin.priceChange24h || 0) >= 0 ? '▲' : '▼'} {Math.abs(coin.priceChange24h || 0).toFixed(2)}%
                    </p>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">Supply: {coin.supply ? coin.supply.toLocaleString() : 'N/A'}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg shadow-lg rounded-lg p-6 overflow-x-auto">
            <h2 className="text-xl font-semibold mb-4 text-white">Recent Transactions</h2>
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Coin</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Price</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Total</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {transactions.map(transaction => {
                  const coin = coins.find(c => c._id === transaction.coinId)
                  return (
                    <tr key={transaction._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          transaction.type === 'buy' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                        }`}>
                          {transaction.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-white">{coin?.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-white">{transaction.amount}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-white">{formatCurrency(transaction.price)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-white">{formatCurrency(transaction.amount * transaction.price)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-white">{new Date(transaction.timestamp).toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-lg mt-8">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-between items-center">
            <p className="text-gray-400 text-sm w-full sm:w-auto mb-2 sm:mb-0">© 2023 CryptoSimulator. All rights reserved.</p>
            <div className="flex space-x-4">
              <Link href="/marketplace" className="text-gray-400 hover:text-white transition duration-150 ease-in-out">Marketplace</Link>
              <Link href="/portfolio" className="text-gray-400 hover:text-white transition duration-150 ease-in-out">Portfolio</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}