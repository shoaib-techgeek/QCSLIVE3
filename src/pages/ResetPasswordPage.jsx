import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../api/auth.js'
import Field from '../components/Field.jsx'
import { ErrorMessage, SuccessMessage } from '../components/FormMessage.jsx'
import AuthShell from '../components/AuthShell.jsx'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!token) {
    return (
      <AuthShell>
        <h1>Choose a new password</h1>
        <ErrorMessage>This reset link is incomplete.</ErrorMessage>
        <p><Link to="/forgot-password">Request a new link</Link></p>
      </AuthShell>
    )
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setFieldError('')
    if (password.length < 10) return setFieldError('Password must be at least 10 characters.')
    setSubmitting(true)
    try {
      await resetPassword(token, password)
      setDone(true)
    } catch (err) {
      if (err.fieldErrors?.password) setFieldError(err.fieldErrors.password)
      else setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell>
      <h1>Choose a new password</h1>
      {done ? (
        <>
          <SuccessMessage>Your password has been changed. All devices were signed out.</SuccessMessage>
          <p><Link to="/login" className="button">Sign in</Link></p>
        </>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <ErrorMessage>{error}</ErrorMessage>
          <Field
            label="New password" type="password" autoComplete="new-password" required
            hint="At least 10 characters." value={password} onChange={(e) => setPassword(e.target.value)} error={fieldError}
          />
          <button type="submit" className="button" disabled={submitting}>
            {submitting ? 'Saving…' : 'Change password'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
