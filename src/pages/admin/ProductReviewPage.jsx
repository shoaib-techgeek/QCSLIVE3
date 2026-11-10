import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getProductForReview, moderateProduct } from '../../api/adminProducts.js'
import Field from '../../components/Field.jsx'
import { ErrorMessage, SuccessMessage } from '../../components/FormMessage.jsx'
import { formatMoney } from '../../lib/money.js'
import { variantLabel } from '../../lib/variants.js'
import Badge from '../../ui/Badge.jsx'
import { PRODUCT_STATUS } from '../seller/product-labels.js'

const NEEDS_REASON = ['reject', 'ban', 'deactivate']

export default function ProductReviewPage() {
  const { productId } = useParams()
  const [product, setProduct] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setProduct((await getProductForReview(productId)).product)
    } catch (err) {
      setError(err.message)
    }
  }, [productId])
  useEffect(() => { load() }, [load])

  async function decide(decision) {
    setError('')
    setMessage('')
    if (NEEDS_REASON.includes(decision) && !reason.trim()) return setError('Add a reason so the seller knows why.')
    setBusy(true)
    try {
      await moderateProduct(productId, decision, reason.trim() || undefined)
      setReason('')
      setMessage('Decision saved.')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!product) return error ? <ErrorMessage>{error}</ErrorMessage> : <p className="muted" role="status">Loading…</p>

  const status = PRODUCT_STATUS[product.status]
  const pending = product.status === 'pending'
  const live = product.status === 'active'
  const hidden = product.status === 'inactive'

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{product.title}</h1>
          <p className="muted"><Link to="/admin/products">← Back to the queue</Link> · Store: {product.store.name}</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <ErrorMessage>{error}</ErrorMessage>
      <SuccessMessage>{message}</SuccessMessage>

      <section className="card stack" aria-labelledby="info-title">
        <h2 id="info-title">Listing</h2>
        <p><strong>Category:</strong> {product.category?.name}</p>
        <p style={{ whiteSpace: 'pre-line' }}>{product.description || <span className="muted">No description.</span>}</p>
        <ul className="photo-list">
          {product.images.map((img, i) => <li key={img.id}><img src={img.url} alt={img.altText || `${product.title}, photo ${i + 1}`} /></li>)}
          {product.images.length === 0 && <li className="muted">No photos.</li>}
        </ul>
      </section>

      <section className="card stack" aria-labelledby="skus-title">
        <h2 id="skus-title">Variants</h2>
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Variants and prices</caption>
            <thead><tr><th scope="col">Variant</th><th scope="col">SKU code</th><th scope="col" className="num">Price</th><th scope="col" className="num">Original price</th></tr></thead>
            <tbody>
              {product.skus.map((s) => (
                <tr key={s.id}>
                  <td>{variantLabel(s.options)}</td><td>{s.sellerSku}</td>
                  <td className="num">{formatMoney(s.priceMinor, s.currency)}</td>
                  <td className="num">{s.compareAtMinor ? formatMoney(s.compareAtMinor, s.currency) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(pending || live || hidden) && (
        <section className="card stack" aria-labelledby="decision-title">
          <h2 id="decision-title">Decision</h2>
          <Field label="Reason for the seller" as="textarea" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} hint="Required to reject, remove or hide a product." />
          <div className="button-row">
            {pending && <button type="button" className="button" disabled={busy} onClick={() => decide('approve')}>Approve</button>}
            {pending && <button type="button" className="button button-secondary" disabled={busy} onClick={() => decide('reject')}>Ask for changes</button>}
            {live && <button type="button" className="button button-secondary" disabled={busy} onClick={() => decide('deactivate')}>Hide from store</button>}
            <button type="button" className="button button-danger" disabled={busy} onClick={() => decide('ban')}>Remove product</button>
          </div>
        </section>
      )}

      {product.history.length > 0 && (
        <section className="card stack" aria-labelledby="history-title">
          <h2 id="history-title">History</h2>
          <ul>
            {product.history.map((h, i) => (
              <li key={i}>{new Date(h.at).toLocaleString()} · {PRODUCT_STATUS[h.from].label} → {PRODUCT_STATUS[h.to].label}{h.note ? ` · “${h.note}”` : ''}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
