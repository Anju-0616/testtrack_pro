import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import api from '../lib/api'

interface User {
  id:         number
  email:      string
  name:       string | null
  role:       'TESTER' | 'DEVELOPER'
  isVerified: boolean
}

interface AuthContextType {
  user:            User | null
  loading:         boolean
  login:           (email: string, password: string) => Promise<void>
  logout:          () => Promise<void>
  isAuthenticated: boolean
  isTester:        boolean
  isDeveloper:     boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    const token  = localStorage.getItem('accessToken')
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed?.id && parsed?.role) {
          setUser(parsed)
        } else {
          localStorage.removeItem('user')
        }
      } catch {
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('accessToken',  data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    localStorage.setItem('user',         JSON.stringify(data.user))
    setUser(data.user)
  }

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      await api.post('/auth/logout', { refreshToken })
    } catch {
      // ignore errors on logout
    } finally {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAuthenticated: !!user,
      isTester:        user?.role === 'TESTER',
      isDeveloper:     user?.role === 'DEVELOPER',
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}