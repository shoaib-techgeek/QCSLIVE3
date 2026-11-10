import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../cart/CartContext.jsx'
import { ErrorMessage } from '../components/FormMessage.jsx'
import { formatMoney } from '../lib/money.js'
import { variantLabel } from '../lib/variants.js'
import EmptyState from '../ui/EmptyState.jsx'

const MAX_QTY = 10 // mirrors the server default (CART_MAX_QTY); the server is the authority

function ItemNotes({ item, onAccept }) {
  return item.changes.map((c) => {
    if (c.code === 'PRICE_CHANGED') {
      return (
        <p key={c.code} className="cart-note" role="status">
          The price changed from {formatMoney(c.oldMinor, item.currency)} to {formatMoney(c.newMinor, item.currency)}.{' '}
          <button type="button" className="link-button" onClick={onAccept}>OK, keep this item</button>
        </p>
      )
    }
    if (c.code === 'UNAVAILABLE') return <p key={c.code} className="cart-note cart-note-bad" role="status">This item is no longer available. Remove it to continue.</p>
    if (c.code === 'OUT_OF_STOCK') return <p key={c.code} className="cart-note cart-note-bad" role="status">Sold out.</p>
    return <p key={c.code} className="cart-note cart-note-bad" role="status">Only {c.available} left. Lower the quantity to continue.</p>
  })
}

function CartItem({ item, onChange }) {
  const max = Math.max(1, Math.min(MAX_QTY, item.available ?? MAX_QTY))
  const label = item.product.title
  return (
    <li className="cart-item">
      <input type="checkbox" aria-label={`Select ${label}`} checked={item.selected} onChange={(e) => onChange(item.id, { selected: e.target.checked })} disabled={item.available === null} />
      <div className="cart-thumb">{item.product.imageUrl ? <img src={item.product.imageUrl} alt="" /> : null}</div>
      <div className="cart-main">
        {item.product.slug ? <Link to={`/p/${item.product.slug}`} className="cart-title">{label}</Link> : <span className="cart-title">{label}</span>}
        {Object.keys(item.sku.options).length > 0 && <p className="muted">{variantLabel(item.sku.options)}</p>}
        <ItemNotes item={item} onAccept={() => onChange(item.id, { acceptPrice: true })} />
      </div>
      <div className="cart-buy">
        <span className="price">{formatMoney(item.priceMinor, item.currency)}</span>
        {item.compareAtMinor ? <span className="price-was"><span className="visually-hidden">Was </span>{formatMoney(item.compareAtMinor, item.currency)}</span> : null}
        <label className="cart-qty"><span className="visually-hidden">Quantity of {label}</span>
          <select value={Math.min(item.qty, max)} onChange={(e) => onChange(item.id, { qty: Number(e.target.value) })} disabled={item.available === null || item.available === 0}>
            {Array.from({ length: max }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button type="button" className="link-button" onClick={() => onChange(item.id, null)} aria-label={`Remove ${label}`}>Remove</button>
      </div>
    </li>
  )
}

export default function CartPage() {
  const { cart, loading, update, remove } = useCart()
  const [error, setError] = useState('')

  async function onChange(itemId, patch) {
    setError('')
    try {
      if (patch === null) await remove(itemId)
      else await update(itemId, patch)
    } catch (err) {
      setError(err.message)
    }
  }

  const empty = cart.groups.length === 0
  return (
    <div className="container-wide">
      <h1>Your cart</h1>
      <ErrorMessage>{error}</ErrorMessage>
      {loading && empty ? (
        <p className="muted" role="status">Loading…</p>
      ) : empty ? (
        <EmptyState title="Your cart is empty">Find something you like. <Link to="/search">Browse products</Link></EmptyState>
      ) : (
        <div className="cart-layout">
          <div className="cart-groups">
            {cart.groups.map((g) => (
              <section key={g.storeName} className="card cart-group" aria-label={`Items from ${g.storeName}`}>
                <h2>{g.storeName}</h2>
                <ul className="cart-list">{g.items.map((item) => <CartItem key={item.id} item={item} onChange={onChange} />)}</ul>
                <p className="cart-subtotal">Store subtotal: <strong>{formatMoney(g.subtotalMinor, cart.summary.currency)}</strong></p>
              </section>
            ))}
          </div>
          <aside className="card cart-summary" aria-label="Order summary">
            <h2>Summary</h2>
            <p><span>Items selected</span> <strong>{cart.summary.itemCount}</strong></p>
            <p><span>Subtotal</span> <strong>{formatMoney(cart.summary.subtotalMinor, cart.summary.currency)}</strong></p>
            <p className="muted">Shipping is added at checkout.</p>
            <button type="button" className="button button-block" disabled>Checkout opens soon</button>
          </aside>
        </div>
      )}
    </div>
  )
}
