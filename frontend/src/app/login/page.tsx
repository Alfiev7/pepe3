'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('token', data.accessToken)
        router.push('/dashboard')
      } else {
        const errorData = await response.text()
        setError(errorData || 'Login failed')
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('An error occurred. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 bg-opacity-50 backdrop-blur-xl">
      <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-96 border border-gray-700">
        <h1 className="text-3xl font-bold mb-6 text-center text-white">
          Login to <span className="text-green-500">PepeExchange</span>
        </h1>
        {error && (
          <p className="text-red-500 mb-4 text-center bg-red-100 border border-red-400 rounded p-2">
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-green-500 focus:ring focus:ring-green-500 focus:ring-opacity-50 transition duration-200"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-green-500 focus:ring focus:ring-green-500 focus:ring-opacity-50 transition duration-200"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-200"
          >
            Login
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-400">
          Don't have an account?{' '}
          <Link href="/signup" className="text-green-400 hover:text-green-300 transition duration-200">
            Register here
          </Link>
        </p>
      </div>
    </div>
  )
}