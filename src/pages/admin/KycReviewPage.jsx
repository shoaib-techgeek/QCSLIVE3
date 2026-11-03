import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { decideKyc, getKycDetail, kycDocumentUrl } from '../../api/admin.js'
import Field from '../../components/Field.jsx'
import { ErrorMessage, SuccessMessage } from '../../components/FormMessage.jsx'
import Badge from '../../ui/Badge.jsx'
import { KIND_LABELS, STATUS_LABELS } from '../seller/kyc-labels.js'

const NEEDS_NOTE = ['approve_with_conditions', 'reject', 'request_info']

export default function KycReviewPage() {
  const { sellerId } = useParams()
  const [kyc, setKyc] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setKyc((await getKycDetail(sellerId)).kyc)
    } catch (err) {
      setError(err.message)
    }
  }, [sellerId])

  useEffect(() => { load() }, [load])

  async function decide(decision) {
    setError('')
    setMessage('')
    if (NEEDS_NOTE.includes(decision) && !note.trim()) {
      setError('Add a note so the seller knows why.')
      return
    }
    setBusy(true)
    try {
      await decideKyc(sellerId, decision, note.trim() || undefined)
      setNote('')
      setMessage('Decision saved.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!kyc) return error ? <ErrorMessage>{error}</ErrorMessage> : <p className="muted" role="status">Loading…</p>

  const s = STATUS_LABELS[kyc.status]
  const canStart = kyc.status === 'submitted'
  const canDecide = kyc.status === 'under_review'

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{kyc.storeName}</h1>
          <p className="muted"><Link to="/admin/kyc">← Back to the queue</Link></p>
        </div>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <SuccessMessage>{message}</SuccessMessage>

      {kyc.flags.includes('ntn_missing') && <p role="note"><Badge tone="warning">No tax number</Badge> The seller did not provide an NTN/VAT number.</p>}

      <section className="card" aria-labelledby="pii-heading">
        <h2 id="pii-heading">Business details</h2>
        {kyc.pii ? (
          <dl>
            <dt>CNIC</dt><dd>{kyc.pii.cnic}</dd>
            <dt>Business address</dt><dd>{kyc.pii.address}</dd>
            <dt>Tax number</dt><dd>{kyc.pii.ntn ?? 'Not provided'}</dd>
          </dl>
        ) : <p className="muted">No details saved.</p>}
      </section>

      <section className="card" aria-labelledby="docs-heading">
        <h2 id="docs-heading">Documents</h2>
        {kyc.documents.length === 0 ? <p className="muted">No documents.</p> : (
          <ul>
            {kyc.documents.map((d) => (
              <li key={d.id}>
                {KIND_LABELS[d.kind]} · <a href={kycDocumentUrl(sellerId, d.id)} target="_blank" rel="noopener noreferrer">View file<span className="visually-hidden"> ({KIND_LABELS[d.kind]}, opens in a new tab)</span></a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(canStart || canDecide) && (
        <section className="card" aria-labelledby="decision-heading">
          <h2 id="decision-heading">Decision</h2>
          {canDecide && <Field label="Note to the seller" as="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} hint="Required for conditions, rejection and requests for more information." />}
          <div className="button-row" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {canStart && <button type="button" className="button" disabled={busy} onClick={() => decide('start_review')}>Start review</button>}
            {canDecide && (
              <>
                <button type="button" className="button" disabled={busy} onClick={() => decide('approve')}>Approve</button>
                <button type="button" className="button button-secondary" disabled={busy} onClick={() => decide('approve_with_conditions')}>Approve with conditions</button>
                <button type="button" className="button button-ghost" disabled={busy} onClick={() => decide('request_info')}>Request more information</button>
                <button type="button" className="button button-danger" disabled={busy} onClick={() => decide('reject')}>Reject</button>
              </>
            )}
          </div>
        </section>
      )}

      {kyc.history.length > 0 && (
        <section className="card" aria-labelledby="history-heading">
          <h2 id="history-heading">History</h2>
          <ul>
            {kyc.history.map((h, i) => (
              <li key={i}>{new Date(h.at).toLocaleString()} · {STATUS_LABELS[h.from].label} → {STATUS_LABELS[h.to].label}{h.note ? ` · “${h.note}”` : ''}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
