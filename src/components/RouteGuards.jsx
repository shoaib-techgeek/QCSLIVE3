import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { homeFor } from '../routes'

/** Requires a signed-in user, optionally of a specific role. */
export function RequireAuth({ role }) {
  const { user } = useAuth()
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (role && user.role !== role) return <Navigate to={homeFor(user)} replace />
  return <Outlet />
}

/** Login/register are for signed-out visitors only. */
export function PublicOnly() {
  const { user } = useAuth()
  return user ? <Navigate to={homeFor(user)} replace /> : <Outlet />
}
