import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import Field from '../components/Field.jsx'
import { ErrorMessage } from '../components/FormMessage.jsx'
import AuthShell from '../components/AuthShell.jsx'

export default function LoginPage() {
  const { login, status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated') return <Navigate to="/account" replace />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login({ email: form.email.trim(), password: form.password })
      navigate(location.state?.from ?? '/account', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <h1>Login</h1>
      <form onSubmit={onSubmit} noValidate>
        <ErrorMessage>{error}</ErrorMessage>
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <Field label="Password" type="password" autoComplete="current-password" required value={form.password} onChange={set('password')} />
        <button type="submit" className="button" disabled={submitting || !form.email || !form.password}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p><Link to="/forgot-password">Forgot your password?</Link></p>
      <p>New here? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  )
}
