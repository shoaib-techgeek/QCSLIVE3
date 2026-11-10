import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createProduct } from '../../api/sellerProducts.js'
import Field from '../../components/Field.jsx'
import { ErrorMessage } from '../../components/FormMessage.jsx'
import { CATEGORIES } from '../../lib/categories.js'
import { parseMoney } from '../../lib/money.js'
import { buildVariants, splitValues, variantLabel } from '../../lib/variants.js'

const MAX_OPTIONS = 3 // mirrors the server default (CATALOG_MAX_OPTIONS); the server is the authority

const keyOf = (v) => JSON.stringify(v)

export default function SellerProductFormPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', categorySlug: '', description: '' })
  const [options, setOptions] = useState([])
  const [rows, setRows] = useState({}) // variant key -> { sellerSku, price, compareAt }
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const variants = useMemo(() => buildVariants(options.map((o) => ({ name: o.name, values: splitValues(o.values) }))), [options])
  const row = (v) => rows[keyOf(v)] ?? { sellerSku: '', price: '', compareAt: '' }
  const setRow = (v, patch) => setRows((r) => ({ ...r, [keyOf(v)]: { ...row(v), ...patch } }))
  const setOption = (i, patch) => setOptions((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o)))

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const next = {}
    if (!form.title.trim()) next.title = 'Enter a product name.'
    if (!form.categorySlug) next.categorySlug = 'Choose a category.'
    const skus = []
    variants.forEach((v, i) => {
      const r = row(v)
      const price = parseMoney(r.price)
      const compareAt = r.compareAt.trim() ? parseMoney(r.compareAt) : undefined
      if (!r.sellerSku.trim()) next[`sku${i}`] = 'Enter a SKU code.'
      else if (!price || price <= 0) next[`sku${i}`] = 'Enter a price above zero, like 1299 or 1299.50.'
      else if (r.compareAt.trim() && (compareAt === null || compareAt <= price)) next[`sku${i}`] = 'The original price must be higher than the price.'
      else skus.push({ sellerSku: r.sellerSku.trim(), options: v, priceMinor: price, ...(compareAt ? { compareAtMinor: compareAt } : {}) })
    })
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const { product } = await createProduct({
        title: form.title.trim(), categorySlug: form.categorySlug, ...(form.description.trim() ? { description: form.description.trim() } : {}),
        options: options.map((o) => ({ name: o.name.trim(), values: splitValues(o.values) })).filter((o) => o.name),
        skus,
      })
      navigate(`/seller/products/${product.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="stack" aria-labelledby="new-title">
      <div className="page-head">
        <div>
          <h1 id="new-title">Add product</h1>
          <p className="muted"><Link to="/seller/products">← Back to products</Link></p>
        </div>
      </div>
      <ErrorMessage>{error}</ErrorMessage>

      <section className="card stack" aria-labelledby="basics-title">
        <h2 id="basics-title">Basics</h2>
        <Field label="Product name" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} error={errors.title} />
        <Field label="Category" as="select" required value={form.categorySlug} onChange={(e) => setForm((f) => ({ ...f, categorySlug: e.target.value }))} error={errors.categorySlug}>
          <option value="">Choose a category</option>
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </Field>
        <Field label="Description (optional)" as="textarea" rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} hint="Plain text only." />
      </section>

      <section className="card stack" aria-labelledby="options-title">
        <h2 id="options-title">Options</h2>
        <p className="muted">Add options like Color or Size if the product comes in variants. Leave this empty for a single product.</p>
        {options.map((o, i) => (
          <div key={i} className="option-row">
            <Field label={`Option ${i + 1} name`} value={o.name} onChange={(e) => setOption(i, { name: e.target.value })} />
            <Field label={`Option ${i + 1} values`} value={o.values} onChange={(e) => setOption(i, { values: e.target.value })} hint="Separate values with commas, like Red, Blue" />
            <button type="button" className="button button-ghost button-small" onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}>Remove option {i + 1}</button>
          </div>
        ))}
        {options.length < MAX_OPTIONS && (
          <div><button type="button" className="button button-secondary button-small" onClick={() => setOptions((os) => [...os, { name: '', values: '' }])}>Add option</button></div>
        )}
      </section>

      <section className="card stack" aria-labelledby="prices-title">
        <h2 id="prices-title">Prices</h2>
        <p className="muted">Enter prices in rupees. You add stock after saving.</p>
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Variants and prices</caption>
            <thead><tr><th scope="col">Variant</th><th scope="col">SKU code</th><th scope="col">Price (Rs)</th><th scope="col">Original price (Rs)</th></tr></thead>
            <tbody>
              {variants.map((v, i) => {
                const label = variantLabel(v)
                const r = row(v)
                return (
                  <tr key={keyOf(v)}>
                    <td>{label}</td>
                    <td><input className="cell-input" aria-label={`SKU code for ${label}`} value={r.sellerSku} onChange={(e) => setRow(v, { sellerSku: e.target.value })} /></td>
                    <td><input className="cell-input" inputMode="decimal" aria-label={`Price for ${label}`} value={r.price} onChange={(e) => setRow(v, { price: e.target.value })} /></td>
                    <td>
                      <input className="cell-input" inputMode="decimal" aria-label={`Original price for ${label}`} value={r.compareAt} onChange={(e) => setRow(v, { compareAt: e.target.value })} />
                      {errors[`sku${i}`] && <p className="field-error" role="alert">{errors[`sku${i}`]}</p>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div><button type="submit" className="button" disabled={saving}>{saving ? 'Saving…' : 'Save as draft'}</button></div>
    </form>
  )
}
