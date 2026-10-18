import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DEMO_ADMIN } from '../constants'

/*
 * DEMO AUTH ONLY. Accounts and the session live in localStorage and passwords
 * are stored in plain text. Replace this module with a real backend
 * (hashed passwords, httpOnly session cookie / JWT) before going to production.
 */

const USERS_KEY = 'ucp.users.v1'
const SESSION_KEY = 'ucp.session.v1'

const ADMIN = {
  id: 'admin-1',
  name: 'Registrar Admin',
  email: DEMO_ADMIN.email,
  password: DEMO_ADMIN.password,
  role: 'admin',
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

const normalize = (email) => email.trim().toLowerCase()
const publicUser = ({ password: _password, ...rest }) => rest

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(() => read(USERS_KEY, []))
  const [sessionId, setSessionId] = useState(() => read(SESSION_KEY, null))

  const user = useMemo(() => {
    const found = [ADMIN, ...users].find((u) => u.id === sessionId)
    return found ? publicUser(found) : null
  }, [users, sessionId])

  const emailExists = useCallback(
    (email) => [ADMIN, ...users].some((u) => u.email === normalize(email)),
    [users],
  )

  const login = useCallback(
    (email, password) => {
      const found = [ADMIN, ...users].find(
        (u) => u.email === normalize(email) && u.password === password,
      )
      if (!found) return { ok: false, error: 'Incorrect email or password.' }
      setSessionId(found.id)
      write(SESSION_KEY, found.id)
      return { ok: true, user: publicUser(found) }
    },
    [users],
  )

  const register = useCallback(
    ({ name, email, password, studentId }) => {
      if (emailExists(email)) return { ok: false, error: 'An account with this email already exists.' }
      const account = {
        id: `u${Date.now()}`,
        name: name.trim(),
        email: normalize(email),
        password,
        role: 'student',
        studentId,
      }
      const next = [...users, account]
      setUsers(next)
      write(USERS_KEY, next)
      setSessionId(account.id)
      write(SESSION_KEY, account.id)
      return { ok: true, user: publicUser(account) }
    },
    [users, emailExists],
  )

  const logout = useCallback(() => {
    setSessionId(null)
    write(SESSION_KEY, null)
  }, [])

  const value = useMemo(
    () => ({ user, login, register, logout, emailExists }),
    [user, login, register, logout, emailExists],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
