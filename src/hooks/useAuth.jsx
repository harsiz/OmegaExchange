import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getToken, getUser, setToken, setUser, clearAuth, parseJwt } from '@/lib/auth'
import { authApi } from '@/lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUserState]    = useState(() => getUser())
  const [loading, setLoading]      = useState(true)

  const refresh = useCallback(async () => {
    const token = getToken()
    if (!token) { setLoading(false); return }
    try {
      const { data } = await authApi.me()
      setUserState(data.user)
      setUser(data.user)
    } catch (err) {
      // Only clear auth on 401 (invalid/expired token), not on network/server errors
      const status = err?.response?.status
      if (status === 401) {
        clearAuth()
        setUserState(null)
      }
      // On 500/network errors, keep the user logged in using cached state
    } finally {
      setLoading(false)
    }
  }, [])

  // Called from AuthCallback page
  const loginWithToken = useCallback((token) => {
    setToken(token)
    const payload = parseJwt(token)
    if (payload) {
      const u = { id: payload.sub, username: payload.username }
      setUserState(u)
      setUser(u)
    }
    refresh()
  }, [refresh])

  const logout = useCallback(() => {
    clearAuth()
    setUserState(null)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <AuthContext.Provider value={{ user, loading, loginWithToken, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
