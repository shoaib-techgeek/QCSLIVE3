import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth.js'
import { ApiError } from '../api/client.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null)
  const [status, setStatus] = useState('loading') // loading | authenticated | anonymous

  useEffect(() => {
    let cancelled = false
    authApi
      .getMe()
      .then((r) => !cancelled && (setAccount(r.account), setStatus('authenticated')))
      .catch((e) => {
        if (cancelled) return
        if (!(e instanceof ApiError) || e.status !== 401) console.error('session check failed', e)
        setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials) => {
    const r = await authApi.login(credentials)
    setAccount(r.account)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setAccount(null)
      setStatus('anonymous')
    }
  }, [])

  const value = useMemo(
    () => ({ account, status, login, logout, setAccount }),
    [account, status, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
