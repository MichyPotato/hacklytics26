import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

const AuthContext = createContext(null)

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
const TOKEN_KEY = 'hacklytics_token'

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(Boolean(token))

  const setSession = (nextToken, nextUser) => {
    setToken(nextToken)
    setUser(nextUser)
    if (nextToken) {
      localStorage.setItem(TOKEN_KEY, nextToken)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }

  useEffect(() => {
    let isMounted = true

    const loadProfile = async () => {
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })

        const data = await response.json()
        if (response.ok && data.success && isMounted) {
          setUser(data.user)
        } else if (isMounted) {
          setSession('', null)
        }
      } catch (error) {
        if (isMounted) {
          setSession('', null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadProfile()
    return () => {
      isMounted = false
    }
  }, [token])

  const login = async ({ email, password }) => {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    const data = await response.json()
    if (response.ok && data.success) {
      setSession(data.token, data.user)
      return { success: true }
    }

    return { success: false, message: data.message || 'Login failed' }
  }

  const signup = async ({ email, password }) => {
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    const data = await response.json()
    if (response.ok && data.success) {
      setSession(data.token, data.user)
      return { success: true }
    }

    return { success: false, message: data.message || 'Signup failed' }
  }

  const updateLocations = async ({ homeLocation, workLocation }) => {
    const response = await fetch(`${API_BASE}/api/profile/locations`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ homeLocation, workLocation })
    })

    const data = await response.json()
    if (response.ok && data.success) {
      setUser(data.user)
      return { success: true }
    }

    return { success: false, message: data.message || 'Update failed' }
  }

  const updateLanguage = async ({ preferredLanguage }) => {
    const response = await fetch(`${API_BASE}/api/profile/language`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ preferredLanguage })
    })

    const data = await response.json()
    if (response.ok && data.success) {
      setUser(data.user)
      return { success: true }
    }

    return { success: false, message: data.message || 'Update failed' }
  }

  const logout = () => {
    setSession('', null)
  }

  const value = useMemo(() => ({
    token,
    user,
    isLoading,
    login,
    signup,
    updateLocations,
    updateLanguage,
    logout
  }), [token, user, isLoading])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
