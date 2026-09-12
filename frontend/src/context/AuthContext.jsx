import { createContext, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken } from '../services/api'
import {
  login as apiLogin,
  registerStudent,
  registerEvaluator,
} from '../services/authApi'

const USER_KEY = 'evalai.user'
const AuthContext = createContext(null)

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeUser(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readUser)
  const [ready, setReady] = useState(false)

  // Re-validate the stored token against the backend on load.
  useEffect(() => {
    let alive = true
    const token = getToken()
    if (!token) {
      setReady(true)
      return
    }
    api('/auth/me')
      .then((res) => {
        if (!alive) return
        setUser(res.user)
        writeUser(res.user)
      })
      .catch(() => {
        if (!alive) return
        setToken(null)
        writeUser(null)
        setUser(null)
      })
      .finally(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])

  const login = async (email, password) => {
    const res = await apiLogin(email, password)
    setToken(res.token)
    setUser(res.user)
    writeUser(res.user)
    return res.user
  }

  const register = async ({ role, ...payload }) => {
    const fn = role === 'evaluator' ? registerEvaluator : registerStudent
    return fn(payload) // does NOT log in
  }

  const logout = () => {
    setToken(null)
    writeUser(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, role: user?.role ?? null, ready, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
