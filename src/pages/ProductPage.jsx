import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { getProduct } from '../api/catalog.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { useCart } from '../cart/CartContext.jsx'
import { formatMoney } from '../lib/money.js'
import EmptyState from '../ui/EmptyState.jsx'

function Gallery({ images, title }) {
  const [index, setIndex] = useState(0)
  if (images.length === 0) return <div className="pdp-media pdp-media-empty" role="img" aria-label="No photo yet" />
  const current = images[Math.min(index, images.length - 1)]
  return (
    <div className="pdp-gallery">
      <div className="pdp-media"><img src={current.url} alt={current.altText || title} /></div>
      {images.length > 1 && (
        <ul className="pdp-thumbs" aria-label="Product photos">
          {images.map((img, i) => (
            <li key={img.url}>
              <button type="button" aria-label={`Show photo ${i + 1}`} aria-pressed={i === index} onClick={() => setIndex(i)}>
                <img src={img.url} alt="" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function ProductPage() {
  const { slug } = useParams()
  const { status } = useAuth()
  const { add } = useCart()
  const navigate = useNavigate()
  const location = useLocation()
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)
  const [state, setState] = useState({ loading: true, product: null, missing: false, error: '' })
  const [chosen, setChosen] = useState({})

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, product: null, missing: false, error: '' })
    setChosen({})
    setAdded(false)
    setAddError('')
    getProduct(slug)
      .then((r) => !cancelled && setState({ loading: false, product: r.product, missing: false, error: '' }))
      .catch((e) => !cancelled && setState({ loading: false, product: null, missing: e.status === 404, error: e.status === 404 ? '' : e.message }))
    return () => { cancelled = true }
  }, [slug])

  const product = state.product
  const selected = useMemo(() => {
    if (!product) return null
    if (product.options.length === 0) return product.skus[0] ?? null
    if (product.options.some((o) => !chosen[o.name])) return null
    return product.skus.find((s) => product.options.every((o) => s.options[o.name] === chosen[o.name])) ?? null
  }, [product, chosen])

  async function addToCart() {
    if (status !== 'authenticated') return navigate('/login', { state: { from: location.pathname } })
    setAddError('')
    setAdded(false)
    setAdding(true)
    try {
      await add(selected.id, qty)
      setAdded(true)
    } catch (err) {
      setAddError(err.message)
    } finally {
      setAdding(false)
    }
  }

  if (state.loading) return <p className="container muted" role="status">Loading…</p>
  if (state.missing) return <div className="container"><EmptyState title="This product is not available">It may have been removed or is not on sale yet. <Link to="/search">Browse all products</Link></EmptyState></div>
  if (state.error) return <p className="container field-error" role="alert">{state.error}</p>

  const lowest = Math.min(...product.skus.map((s) => s.priceMinor))
  const shown = selected ?? null
  const allChosen = product.options.every((o) => chosen[o.name])

  return (
    <article className="container-wide pdp">
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to="/">Home</Link> / <Link to={`/search?category=${product.category.slug}`}>{product.category.name}</Link>
      </nav>
      <div className="pdp-layout">
        <Gallery images={product.images} title={product.title} />
        <div className="pdp-info">
          <h1>{product.title}</h1>
          <p className="muted">Sold by {product.store.name}</p>
          <p className="pdp-price" aria-live="polite">
            <span className="price">{shown ? formatMoney(shown.priceMinor, shown.currency) : `From ${formatMoney(lowest, product.skus[0].currency)}`}</span>
            {shown?.compareAtMinor ? <span className="price-was"><span className="visually-hidden">Was </span>{formatMoney(shown.compareAtMinor, shown.currency)}</span> : null}
          </p>

          {product.options.map((o) => (
            <fieldset key={o.name} className="pdp-option">
              <legend>{o.name}</legend>
              <div className="pdp-choices">
                {o.values.map((v) => (
                  <button key={v} type="button" className="chip" aria-pressed={chosen[o.name] === v} onClick={() => setChosen((c) => ({ ...c, [o.name]: v }))}>{v}</button>
                ))}
              </div>
            </fieldset>
          ))}

          <p className="pdp-stock" role="status">
            {!allChosen ? 'Choose your options to see availability.' : shown?.inStock ? 'In stock' : 'Sold out'}
          </p>
          <div className="pdp-buy">
            <label className="pdp-qty">Quantity
              <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button type="button" className="button" disabled={!selected || !selected.inStock || adding} onClick={addToCart}>{adding ? 'Adding…' : 'Add to cart'}</button>
          </div>
          {addError && <p className="field-error" role="alert">{addError}</p>}
          {added && <p role="status" className="pdp-added">Added to your cart. <Link to="/cart">View cart</Link></p>}

          {product.description && (
            <section aria-labelledby="desc-title" className="pdp-desc">
              <h2 id="desc-title">About this product</h2>
              <p>{product.description}</p>
            </section>
          )}
        </div>
      </div>
    </article>
  )
}
