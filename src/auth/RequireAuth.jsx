import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

/** Client-side convenience only; the API enforces authorization on every request. */
export default function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <p role="status" className="container muted">Loading…</p>
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
