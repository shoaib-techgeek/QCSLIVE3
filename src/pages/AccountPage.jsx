import { useState } from 'react'
import { changePassword, updateMe } from '../api/auth.js'
import { useAuth } from '../auth/AuthContext.jsx'
import Field from '../components/Field.jsx'
import { ErrorMessage, SuccessMessage } from '../components/FormMessage.jsx'

function ProfileForm() {
  const { account, setAccount } = useAuth()
  const [form, setForm] = useState({ fullName: account.fullName ?? '', phone: account.phone ?? '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    setErrors({})
    setSaving(true)
    try {
      const r = await updateMe({ fullName: form.fullName.trim() || null, phone: form.phone.trim() || null })
      setAccount(r.account)
      setMessage('Profile saved.')
    } catch (err) {
      if (Object.keys(err.fieldErrors ?? {}).length > 0) setErrors(err.fieldErrors)
      else setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="profile-heading" className="card">
      <h2 id="profile-heading">Profile</h2>
      <ErrorMessage>{error}</ErrorMessage>
      <SuccessMessage>{message}</SuccessMessage>
      <p className="muted">Signed in as {account.email}</p>
      <Field label="Full name" autoComplete="name" value={form.fullName} onChange={set('fullName')} error={errors.fullName} />
      <Field label="Phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} />
      <button type="submit" className="button" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
    </form>
  )
}

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    setErrors({})
    setSaving(true)
    try {
      await changePassword(form)
      setForm({ currentPassword: '', newPassword: '' })
      setMessage('Password changed. Other devices were signed out.')
    } catch (err) {
      if (Object.keys(err.fieldErrors ?? {}).length > 0) setErrors(err.fieldErrors)
      else setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="password-heading" className="card">
      <h2 id="password-heading">Change password</h2>
      <ErrorMessage>{error}</ErrorMessage>
      <SuccessMessage>{message}</SuccessMessage>
      <Field label="Current password" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set('currentPassword')} error={errors.currentPassword} />
      <Field label="New password" type="password" autoComplete="new-password" required hint="At least 10 characters." value={form.newPassword} onChange={set('newPassword')} error={errors.newPassword} />
      <button type="submit" className="button" disabled={saving || !form.currentPassword || !form.newPassword}>
        {saving ? 'Saving…' : 'Change password'}
      </button>
    </form>
  )
}

export default function AccountPage() {
  const { account } = useAuth()
  const initials = (account.fullName || account.email).trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <section className="container">
      <div className="account-head">
        <span className="avatar" aria-hidden="true">{initials}</span>
        <div>
          <h1>My account</h1>
          <p className="muted">{account.fullName ? `Welcome back, ${account.fullName.split(' ')[0]}.` : 'Welcome back.'}</p>
        </div>
      </div>
      <div className="account-grid">
        <ProfileForm />
        <PasswordForm />
      </div>
    </section>
  )
}
