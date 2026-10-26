import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import Button from '../ui/Button.jsx'

/** Client-side convenience only; the API enforces authorization on every request. */
export default function RequirePermission({ permission }) {
  const { account } = useAuth()
  if (!account) return <Navigate to="/login" replace />
  if (!account.permissions?.includes(permission)) {
    return (
      <div className="container center-page">
        <h1>No access</h1>
        <p className="muted">Your account does not have permission to open this area.</p>
        <Button to="/">Back to the store</Button>
      </div>
    )
  }
  return <Outlet />
}
