import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import * as api from '../../api/sellerProducts.js'
import Field from '../../components/Field.jsx'
import { ErrorMessage, SuccessMessage } from '../../components/FormMessage.jsx'
import { CATEGORIES } from '../../lib/categories.js'
import { parseMoney, toInputMoney } from '../../lib/money.js'
import { variantLabel } from '../../lib/variants.js'
import Badge from '../../ui/Badge.jsx'
import { PRODUCT_STATUS } from './product-labels.js'

const CONTENT_EDITABLE = ['draft', 'rejected', 'inactive']
const PRICE_EDITABLE = ['draft', 'rejected', 'inactive', 'active']

function Details({ product, onSaved }) {
  const [form, setForm] = useState({ title: product.title, categorySlug: product.category?.slug ?? '', description: product.description ?? '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const editable = CONTENT_EDITABLE.includes(product.status)

  async function save(e) {
    e.preventDefault()
    setMessage('')
    setError('')
    try {
      await api.updateProduct(product.id, { title: form.title.trim(), categorySlug: form.categorySlug, description: form.description.trim() || null })
      setMessage('Details saved.')
      await onSaved()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form onSubmit={save} noValidate className="card stack" aria-labelledby="details-title">
      <h2 id="details-title">Details</h2>
      <ErrorMessage>{error}</ErrorMessage>
      <SuccessMessage>{message}</SuccessMessage>
      <Field label="Product name" value={form.title} disabled={!editable} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      <Field label="Category" as="select" value={form.categorySlug} disabled={!editable} onChange={(e) => setForm((f) => ({ ...f, categorySlug: e.target.value }))}>
        {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
      </Field>
      <Field label="Description" as="textarea" rows={4} value={form.description} disabled={!editable} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      {editable ? <div><button type="submit" className="button">Save details</button></div> : <p className="muted">Details cannot be changed while the product is {PRODUCT_STATUS[product.status].label.toLowerCase()}.</p>}
    </form>
  )
}

function Photos({ product, onChanged }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const editable = CONTENT_EDITABLE.includes(product.status)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setBusy(true)
    try {
      await api.uploadImage(product.id, file)
      await onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function remove(imageId) {
    setError('')
    try {
      await api.deleteImage(product.id, imageId)
      await onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="card stack" aria-labelledby="photos-title">
      <h2 id="photos-title">Photos</h2>
      <p className="muted">JPG, PNG or WebP, up to 5 MB each. The first photo is the main one.</p>
      <ErrorMessage>{error}</ErrorMessage>
      <ul className="photo-list">
        {product.images.map((img, i) => (
          <li key={img.id}>
            <img src={img.url} alt={img.altText || `${product.title}, photo ${i + 1}`} />
            {editable && <button type="button" className="button button-ghost button-small" onClick={() => remove(img.id)} aria-label={`Remove photo ${i + 1}`}>Remove</button>}
          </li>
        ))}
      </ul>
      {editable && <Field label="Add a photo" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={pick} />}
    </section>
  )
}

function Variants({ product, onChanged }) {
  const [edits, setEdits] = useState({}) // sku id -> { price, compareAt, stock }
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const val = (s, k, initial) => edits[s.id]?.[k] ?? initial
  const set = (s, patch) => setEdits((e) => ({ ...e, [s.id]: { ...e[s.id], ...patch } }))
  const priceEditable = PRICE_EDITABLE.includes(product.status)

  async function save() {
    setMessage('')
    setError('')
    const prices = []
    const stocks = []
    for (const s of product.skus) {
      const e = edits[s.id]
      if (!e) continue
      const label = variantLabel(s.options)
      if (e.price !== undefined || e.compareAt !== undefined) {
        const price = e.price !== undefined ? parseMoney(e.price) : s.priceMinor
        const compareAt = e.compareAt !== undefined ? (e.compareAt.trim() ? parseMoney(e.compareAt) : null) : s.compareAtMinor
        if (!price || price <= 0) return setError(`Enter a price above zero for ${label}.`)
        if (compareAt !== null && (compareAt === undefined || compareAt <= price)) return setError(`The original price for ${label} must be higher than the price.`)
        prices.push({ id: s.id, priceMinor: price, compareAtMinor: compareAt })
      }
      if (e.stock !== undefined) {
        const n = Number(e.stock)
        if (!/^\d+$/.test(e.stock.trim()) || !Number.isSafeInteger(n)) return setError(`Enter a whole number of units for ${label}.`)
        stocks.push({ id: s.id, onHand: n })
      }
    }
    try {
      if (prices.length) await api.updateProduct(product.id, { skus: prices })
      for (const s of stocks) await api.setStock(s.id, s.onHand)
      setEdits({})
      setMessage('Saved.')
      await onChanged()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="card stack" aria-labelledby="variants-title">
      <h2 id="variants-title">Prices and stock</h2>
      <ErrorMessage>{error}</ErrorMessage>
      <SuccessMessage>{message}</SuccessMessage>
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">Prices and stock per variant</caption>
          <thead><tr><th scope="col">Variant</th><th scope="col">SKU code</th><th scope="col">Price (Rs)</th><th scope="col">Original price (Rs)</th><th scope="col">In stock</th><th scope="col">Reserved</th></tr></thead>
          <tbody>
            {product.skus.map((s) => {
              const label = variantLabel(s.options)
              return (
                <tr key={s.id}>
                  <td>{label}</td>
                  <td>{s.sellerSku}</td>
                  <td><input className="cell-input" inputMode="decimal" aria-label={`Price for ${label}`} disabled={!priceEditable} value={val(s, 'price', toInputMoney(s.priceMinor))} onChange={(e) => set(s, { price: e.target.value })} /></td>
                  <td><input className="cell-input" inputMode="decimal" aria-label={`Original price for ${label}`} disabled={!priceEditable} value={val(s, 'compareAt', s.compareAtMinor ? toInputMoney(s.compareAtMinor) : '')} onChange={(e) => set(s, { compareAt: e.target.value })} /></td>
                  <td><input className="cell-input" inputMode="numeric" aria-label={`Stock for ${label}`} value={val(s, 'stock', String(s.stock.onHand))} onChange={(e) => set(s, { stock: e.target.value })} /></td>
                  <td>{s.stock.reserved}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div><button type="button" className="button" onClick={save} disabled={Object.keys(edits).length === 0}>Save prices and stock</button></div>
    </section>
  )
}

export default function SellerProductEditPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState({ loading: true, product: null, error: '' })
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      setState({ loading: false, product: (await api.getMyProduct(productId)).product, error: '' })
    } catch (err) {
      setState({ loading: false, product: null, error: err.status === 404 ? 'We could not find this product.' : err.message })
    }
  }, [productId])
  useEffect(() => { load() }, [load])

  async function run(fn, done = '') {
    setActionError('')
    setNotice('')
    try {
      await fn()
      setNotice(done)
      await load()
    } catch (err) {
      setActionError(err.message)
    }
  }

  if (state.loading) return <p className="muted" role="status">Loading…</p>
  if (state.error) return <div className="stack"><ErrorMessage>{state.error}</ErrorMessage><p><Link to="/seller/products">← Back to products</Link></p></div>

  const product = state.product
  const status = PRODUCT_STATUS[product.status]
  const canSubmit = product.status === 'draft' || product.status === 'rejected'
  const canDelete = CONTENT_EDITABLE.includes(product.status)

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{product.title}</h1>
          <p className="muted"><Link to="/seller/products">← Back to products</Link> · <Badge tone={status.tone}>{status.label}</Badge></p>
        </div>
      </div>
      <ErrorMessage>{actionError}</ErrorMessage>
      <SuccessMessage>{notice}</SuccessMessage>
      {product.rejectionReason && (product.status === 'rejected' || product.status === 'banned') && (
        <div className="card" role="note"><strong>{product.status === 'banned' ? 'Why this was removed' : 'What to fix'}:</strong> {product.rejectionReason}</div>
      )}
      {product.status === 'pending' && <p role="status">Your product is being reviewed. You can change prices and stock after it is approved.</p>}

      <Details product={product} onSaved={load} />
      <Photos product={product} onChanged={load} />
      <Variants key={product.skus.map((s) => `${s.id}:${s.priceMinor}:${s.stock.onHand}`).join('|')} product={product} onChanged={load} />

      <section className="card stack" aria-labelledby="actions-title">
        <h2 id="actions-title">Publishing</h2>
        <div className="button-row">
          {canSubmit && <button type="button" className="button" onClick={() => run(() => api.submitProduct(product.id))}>Send for review</button>}
          {product.status === 'active' && <button type="button" className="button button-secondary" onClick={() => run(() => api.deactivateProduct(product.id), 'Hidden. Shoppers can no longer see this product.')}>Hide from store</button>}
          {product.status === 'inactive' && <button type="button" className="button" onClick={() => run(() => api.activateProduct(product.id), 'Live again. Shoppers can see this product.')}>Show in store</button>}
          {canDelete && !confirmDelete && <button type="button" className="button button-ghost" onClick={() => setConfirmDelete(true)}>Delete product</button>}
          {canDelete && confirmDelete && (
            <>
              <button type="button" className="button button-danger" onClick={() => run(async () => { await api.deleteProduct(product.id); navigate('/seller/products') })}>Yes, delete this product</button>
              <button type="button" className="button button-ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
