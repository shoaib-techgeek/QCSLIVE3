import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMe } from '../../api/auth.js'
import * as sellerApi from '../../api/seller.js'
import { useAuth } from '../../auth/AuthContext.jsx'
import Field from '../../components/Field.jsx'
import { ErrorMessage, SuccessMessage } from '../../components/FormMessage.jsx'
import Badge from '../../ui/Badge.jsx'
import { KIND_LABELS, STATUS_LABELS } from './kyc-labels.js'

const EDITABLE = ['not_submitted', 'more_info_required']
const ACCEPT = 'image/png,image/jpeg,application/pdf'
const UPLOAD_KINDS = ['cnic_front', 'cnic_back', 'business_registration', 'business_photo', 'tax_certificate']

function CreateStore({ onCreated }) {
  const [form, setForm] = useState({ storeName: '', description: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setErrors({})
    setSaving(true)
    try {
      await sellerApi.createSeller({ storeName: form.storeName.trim(), ...(form.description.trim() && { description: form.description.trim() }) })
      onCreated()
    } catch (err) {
      if (Object.keys(err.fieldErrors ?? {}).length > 0) setErrors(err.fieldErrors)
      else setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card" aria-labelledby="store-heading">
      <h2 id="store-heading">Name your store</h2>
      <p className="muted">Shoppers will see this name. You cannot change it later, so choose carefully.</p>
      <ErrorMessage>{error}</ErrorMessage>
      <Field label="Store name" required value={form.storeName} onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))} error={errors.storeName} hint="3 to 60 characters" />
      <Field label="About your store (optional)" as="textarea" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} error={errors.description} />
      <button type="submit" className="button" disabled={saving}>{saving ? 'Creating…' : 'Create store'}</button>
    </form>
  )
}

function Documents({ kyc, editable, onChange }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  async function onPick(kind, e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setBusy(kind)
    try {
      await sellerApi.uploadKycDocument(kind, file)
      await onChange()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function onRemove(id) {
    setError('')
    try {
      await sellerApi.deleteKycDocument(id)
      await onChange()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="card" aria-labelledby="docs-heading">
      <h2 id="docs-heading">Documents</h2>
      <p className="muted">JPG, PNG or PDF, up to 5 MB each. Documents are private and only seen by our review team.</p>
      <ErrorMessage>{error}</ErrorMessage>
      <ul className="stack" style={{ listStyle: 'none', padding: 0, gap: '1rem' }}>
        {UPLOAD_KINDS.map((kind) => {
          const docs = kyc.documents.filter((d) => d.kind === kind)
          const required = kyc.requiredDocuments.includes(kind)
          return (
            <li key={kind}>
              <strong>{KIND_LABELS[kind]}</strong> {required ? <Badge tone="neutral">Required</Badge> : <Badge tone="neutral">Optional</Badge>}
              {docs.map((d) => (
                <p key={d.id} className="muted">
                  Uploaded ({Math.max(1, Math.round(d.sizeBytes / 1024))} KB)
                  {editable && <> · <button type="button" className="button button-ghost button-small" onClick={() => onRemove(d.id)} aria-label={`Remove ${KIND_LABELS[kind]}`}>Remove</button></>}
                </p>
              ))}
              {editable && (kind === 'business_photo' || docs.length === 0) && (
                <Field label={docs.length ? 'Add another' : `Upload ${KIND_LABELS[kind].toLowerCase()}`} type="file" accept={ACCEPT} disabled={busy === kind} onChange={(e) => onPick(kind, e)} />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Details({ kyc, editable, onChange }) {
  const [form, setForm] = useState({ cnic: '', address: '', ntn: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    setErrors({})
    setSaving(true)
    try {
      await sellerApi.saveKycPii({ cnic: form.cnic, address: form.address, ...(form.ntn.trim() && { ntn: form.ntn.trim() }) })
      setForm({ cnic: '', address: '', ntn: '' })
      setMessage('Details saved.')
      await onChange()
    } catch (err) {
      if (Object.keys(err.fieldErrors ?? {}).length > 0) setErrors(err.fieldErrors)
      else setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card" aria-labelledby="details-heading">
      <h2 id="details-heading">Business details</h2>
      {kyc.pii && <p className="muted">Saved: CNIC ending {kyc.pii.cnicLast4}{kyc.pii.hasNtn ? ', tax number provided' : ', no tax number'}. {editable && 'Enter new values to replace them.'}</p>}
      <ErrorMessage>{error}</ErrorMessage>
      <SuccessMessage>{message}</SuccessMessage>
      {editable ? (
        <>
          <Field label="CNIC number" required inputMode="numeric" value={form.cnic} onChange={set('cnic')} error={errors.cnic} hint="13 digits, for example 42101-1234567-1" />
          <Field label="Business address" required as="textarea" rows={2} value={form.address} onChange={set('address')} error={errors.address} />
          <Field label="Tax number, NTN or VAT (optional)" value={form.ntn} onChange={set('ntn')} error={errors.ntn} hint="Not required, but it helps us approve you faster." />
          <button type="submit" className="button" disabled={saving}>{saving ? 'Saving…' : 'Save details'}</button>
        </>
      ) : null}
    </form>
  )
}

function StatusBanner({ kyc }) {
  const s = STATUS_LABELS[kyc.status]
  const messages = {
    submitted: 'Thanks! We received your application and will review it soon.',
    under_review: 'Your application is being reviewed.',
    approved: 'You are approved to sell.',
    approved_with_conditions: 'You are approved to sell, with conditions.',
    rejected: 'Your application was not approved.',
    more_info_required: 'We need a little more information. Update your documents or details, then submit again.',
  }
  return (
    <div className="card" role="status">
      <h2>Verification status <Badge tone={s.tone}>{s.label}</Badge></h2>
      {messages[kyc.status] && <p>{messages[kyc.status]}</p>}
      {kyc.note && <p><strong>Note from our team:</strong> {kyc.note}</p>}
      {(kyc.status === 'approved' || kyc.status === 'approved_with_conditions') && (
        <Link to="/seller" className="button">Open seller center</Link>
      )}
    </div>
  )
}

export default function OnboardingPage() {
  const { setAccount } = useAuth()
  const [state, setState] = useState({ loading: true, seller: null, kyc: null, error: '' })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const { seller } = await sellerApi.getSeller()
      const { kyc } = await sellerApi.getKyc()
      setState({ loading: false, seller, kyc, error: '' })
    } catch (err) {
      if (err.status === 404) setState({ loading: false, seller: null, kyc: null, error: '' })
      else setState({ loading: false, seller: null, kyc: null, error: err.message })
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Approval grants new permissions; refresh the cached account so the seller center opens.
  useEffect(() => {
    if (state.kyc && (state.kyc.status === 'approved' || state.kyc.status === 'approved_with_conditions')) {
      getMe().then((r) => setAccount(r.account)).catch(() => {})
    }
  }, [state.kyc?.status, setAccount])

  async function submit() {
    setSubmitError('')
    setSubmitting(true)
    try {
      await sellerApi.submitKyc()
      await load()
    } catch (err) {
      const missing = (err.details ?? []).map((d) => KIND_LABELS[d.path] ?? 'business details')
      setSubmitError(missing.length ? `Still needed: ${missing.join(', ')}.` : err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (state.loading) return <p className="muted" role="status">Loading…</p>
  if (state.error) return <ErrorMessage>{state.error}</ErrorMessage>

  return (
    <div className="container stack">
      <div className="page-head">
        <div>
          <h1>Sell on QCS Store</h1>
          <p className="muted">Create your store and verify your business. You can start drafting products while we review.</p>
        </div>
      </div>
      {!state.seller ? (
        <CreateStore onCreated={load} />
      ) : (
        <>
          <div className="card">
            <h2>{state.seller.storeName}</h2>
            <p className="muted">Your store link name: {state.seller.slug}</p>
          </div>
          {state.kyc.status !== 'not_submitted' && <StatusBanner kyc={state.kyc} />}
          <Documents kyc={state.kyc} editable={EDITABLE.includes(state.kyc.status)} onChange={load} />
          <Details kyc={state.kyc} editable={EDITABLE.includes(state.kyc.status)} onChange={load} />
          {EDITABLE.includes(state.kyc.status) && (
            <div className="card">
              <h2>Submit for review</h2>
              <ErrorMessage>{submitError}</ErrorMessage>
              <button type="button" className="button" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit application'}</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
