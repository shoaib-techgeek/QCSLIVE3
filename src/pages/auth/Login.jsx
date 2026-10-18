import { useId, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import PasswordField from './PasswordField'
import { useAuth } from '../../context/AuthContext'
import { homeFor } from '../../routes'
import { DEMO_ADMIN } from '../../constants'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const emailId = useId()

  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const next = {}
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.password) next.password = 'Enter your password.'
    return next
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) return

    setSubmitting(true)
    const result = login(form.email, form.password)
    setSubmitting(false)
    if (!result.ok) return setFormError(result.error)

    const from = location.state?.from?.pathname
    navigate(from && from !== '/login' ? from : homeFor(result.user), { replace: true })
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage registrations and students."
      footer={
        <>
          New applicant? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        {formError && (
          <div className="alert alert--error" role="alert">
            {formError}
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor={emailId}>
            Email
          </label>
          <input
            id={emailId}
            className="field__input"
            type="email"
            inputMode="email"
            autoComplete="username"
            placeholder="you@university.edu"
            value={form.email}
            onChange={set('email')}
            aria-invalid={errors.email ? 'true' : undefined}
            aria-describedby={errors.email ? `${emailId}-err` : undefined}
          />
          {errors.email && (
            <p className="field__error" id={`${emailId}-err`}>
              {errors.email}
            </p>
          )}
        </div>

        <PasswordField
          label="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
        />

        <button className="btn btn--primary btn--block" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="auth__demo">
        <p>
          <strong>Demo admin</strong>
          <br />
          {DEMO_ADMIN.email} · {DEMO_ADMIN.password}
        </p>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => {
            setForm({ email: DEMO_ADMIN.email, password: DEMO_ADMIN.password })
            setErrors({})
            setFormError('')
          }}
        >
          Fill in
        </button>
      </div>
    </AuthLayout>
  )
}
