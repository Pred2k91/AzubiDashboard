import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi.me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const result = await authApi.login(email, password)
    if (result.requires_2fa) return result
    setUser(result.user)
    return result.user
  }, [])

  const completeTwoFactorLogin = useCallback(async (pendingToken, code) => {
    const { user } = await authApi.verifyTwoFactor(pendingToken, code)
    setUser(user)
    return user
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {})
    setUser(null)
  }, [])

  const refresh = useCallback(async () => {
    const { user } = await authApi.me()
    setUser(user)
    return user
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, completeTwoFactorLogin, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von AuthProvider verwendet werden')
  return ctx
}
