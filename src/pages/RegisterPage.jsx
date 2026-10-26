import { useState } from 'react'
import { Link } from 'react-router-dom'
import { register } from '../api/auth.js'
import Field from '../components/Field.jsx'
import { ErrorMessage, SuccessMessage } from '../components/FormMessage.jsx'
import AuthShell from '../components/AuthShell.jsx'

function validateRegistration({ email, password }) {
  const errors = {}
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email address.'
  if (password.length < 10) errors.password = 'Password must be at least 10 characters.'
  return errors
}

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState(null) // null | { verificationRequired }
  const [submitting, setSubmitting] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setFormError('')
    const clientErrors = validateRegistration(form)
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    setSubmitting(true)
    try {
      const result = await register({
        email: form.email.trim(),
        password: form.password,
        ...(form.fullName.trim() ? { fullName: form.fullName.trim() } : {}),
      })
      setDone({ verificationRequired: result?.verificationRequired !== false })
    } catch (err) {
      if (err.fieldErrors && Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors)
      else setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (done && !done.verificationRequired) {
    return (
      <AuthShell>
        <h1>Account created</h1>
        <SuccessMessage>Your account is ready. You can sign in now.</SuccessMessage>
        <p><Link to="/login" className="button">Go to login</Link></p>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell>
        <h1>Check your email</h1>
        <SuccessMessage>
          If {form.email.trim()} can be registered, we have sent a verification link. It is valid for 24 hours.
        </SuccessMessage>
        <p><Link to="/login">Back to sign in</Link></p>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1>Create your account</h1>
      <form onSubmit={onSubmit} noValidate>
        <ErrorMessage>{formError}</ErrorMessage>
        <Field label="Full name (optional)" autoComplete="name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
        <Field label="Email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={errors.email} />
        <Field
          label="Password" type="password" autoComplete="new-password" required
          hint="At least 10 characters." value={form.password} onChange={set('password')} error={errors.password}
        />
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p>Already registered? <Link to="/login">Sign in</Link></p>
    </AuthShell>
  )
}
