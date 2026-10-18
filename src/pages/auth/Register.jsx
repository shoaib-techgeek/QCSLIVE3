import { useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import PasswordField from './PasswordField'
import Autocomplete from '../../components/Autocomplete'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../context/StudentsContext'
import { PROGRAM_OPTIONS } from '../../constants'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Register() {
  const { register, emailExists } = useAuth()
  const { addApplication } = useStudents()
  const navigate = useNavigate()
  const nameId = useId()
  const emailId = useId()

  const [form, setForm] = useState({ name: '', email: '', course: '', password: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const validate = () => {
    const next = {}
    if (form.name.trim().length < 2) next.name = 'Enter your full name.'
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.'
    else if (emailExists(form.email)) next.email = 'An account with this email already exists.'
    if (!form.course) next.course = 'Choose the program you are applying to.'
    if (form.password.length < 8) next.password = 'Use at least 8 characters.'
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.'
    return next
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormError('')
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length) return

    const application = addApplication(form)
    const result = register({ ...form, studentId: application.id })
    if (!result.ok) return setFormError(result.error)
    navigate('/portal', { replace: true })
  }

  return (
    <AuthLayout
      title="Apply for admission"
      subtitle="Create your account and submit your application."
      footer={
        <>
          Already registered? <Link to="/login">Sign in</Link>
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
          <label className="field__label" htmlFor={nameId}>
            Full name
          </label>
          <input
            id={nameId}
            className="field__input"
            type="text"
            autoComplete="name"
            value={form.name}
            onChange={set('name')}
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? `${nameId}-err` : undefined}
          />
          {errors.name && (
            <p className="field__error" id={`${nameId}-err`}>
              {errors.name}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={emailId}>
            Email
          </label>
          <input
            id={emailId}
            className="field__input"
            type="email"
            inputMode="email"
            autoComplete="email"
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

        <div className="field">
          <Autocomplete
            label="Program"
            placeholder="Search programs"
            options={PROGRAM_OPTIONS}
            value={form.course}
            onChange={(course) => setForm((f) => ({ ...f, course }))}
          />
          {errors.course && <p className="field__error">{errors.course}</p>}
        </div>

        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={form.password}
          onChange={set('password')}
          error={errors.password}
        />
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
        />

        <button className="btn btn--primary btn--block" type="submit">
          Submit application
        </button>
      </form>
    </AuthLayout>
  )
}
