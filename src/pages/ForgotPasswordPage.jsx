import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../api/auth.js'
import Field from '../components/Field.jsx'
import { ErrorMessage, SuccessMessage } from '../components/FormMessage.jsx'
import AuthShell from '../components/AuthShell.jsx'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <h1>Reset your password</h1>
      {sent ? (
        <SuccessMessage>If an account exists for that address, we have sent a reset link. It is valid for 1 hour.</SuccessMessage>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <ErrorMessage>{error}</ErrorMessage>
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="button" disabled={submitting || !email}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
      <p><Link to="/login">Back to sign in</Link></p>
    </AuthShell>
  )
}
