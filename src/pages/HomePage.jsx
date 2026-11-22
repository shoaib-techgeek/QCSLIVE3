import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProducts } from '../api/catalog.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { CATEGORIES } from '../lib/categories.js'
import { sellerLinkFor } from '../lib/sellerLink.js'
import EmptyState from '../ui/EmptyState.jsx'
import ProductCard from '../ui/ProductCard.jsx'
import { cardProps } from './SearchPage.jsx'

const TRUST = [
  { title: 'Cash on delivery', text: 'Pay when your order arrives, anywhere in Pakistan.' },
  { title: '14-day returns', text: 'Send an item back within 14 days of delivery.' },
  { title: 'Verified sellers', text: 'We check every seller’s business before they can publish.' },
]

const SELL_STEPS = [
  { title: 'Create your store', text: 'Pick a name and tell shoppers what you sell.' },
  { title: 'Verify your business', text: 'Upload your CNIC, registration document and photos of your business.' },
  { title: 'List your products', text: 'Add products and stock, then ship orders yourself.' },
]

function Hero({ sell }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-inner">
        <div className="hero-copy">
          <h1 id="hero-title">Everything a market has, in one place.</h1>
          <p>Browse products from independent sellers, check out once, and follow every order.</p>
          <div className="hero-actions">
            <a href="#explore" className="button">Start shopping</a>
            <Link to={sell.to} className="button button-outline-light">{sell.label}</Link>
          </div>
        </div>
        <div className="price-board" aria-hidden="true">
          {['mango', 'teal', 'coral', 'ink', 'violet'].map((tone, i) => (
            <span key={i} className={`board-tile tile tile-${tone} b${i + 1}`}><i className="tag" /></span>
          ))}
        </div>
      </div>
    </section>
  )
}

function TrustBand() {
  return (
    <section className="trust-band" aria-label="Why shop with us">
      <ul>
        {TRUST.map((t) => (
          <li key={t.title}><strong>{t.title}</strong><span>{t.text}</span></li>
        ))}
      </ul>
    </section>
  )
}

/** Loads a product list once per category; returns { loading, items, error }. */
function useProducts(params) {
  const key = JSON.stringify(params)
  
  const [state, setState] = useState({ loading: true, items: [], error: '' })

  useEffect(() => {

    let cancelled = false
    
    setState((s) => ({ ...s, loading: true, error: '' }))

    listProducts(params)
      .then((r) => !cancelled && setState({ loading: false, items: r.items, error: '' }))
      .catch((e) => !cancelled && setState({ loading: false, items: [], error: e.message }))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}

function NewIn() {
  
  const { loading, items } = useProducts({ sort: 'newest', limit: 5 })

  if (loading || items.length === 0) return null
  return (
    <section className="home-section" id="new-in" aria-labelledby="new-in-title">
      <div className="section-head">
        <h2 id="new-in-title" className="rail-title">New in</h2>
        <Link to="/search?sort=newest">See all</Link>
      </div>
      <div className="product-grid explore-grid">
     

        {
        items.map((p) => 
          <ProductCard key={p.id} {...cardProps(p)} 
        />)}
      </div>
    </section>
  )
}

function Explore({ sell }) {
  const [category, setCategory] = useState('')
  const { loading, items, error } = useProducts({ category, limit: 20 })
  return (
    <section className="home-section" id="explore" aria-labelledby="explore-title">
      <h2 id="explore-title" className="section-title explore-title">Explore your interests</h2>
      <div className="chip-row" role="group" aria-label="Filter products by category">
        {[{ slug: '', name: 'Recommended' }, ...CATEGORIES].map((c) => (
          <button key={c.slug} type="button" className="chip" aria-pressed={category === c.slug} onClick={() => setCategory(c.slug)}>
            {c.name}
          </button>
        ))}
      </div>
      {error ? (
        <p className="field-error" role="alert">{error}</p>
      ) : loading ? (
        <p className="muted" role="status">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState title={category ? 'Nothing here yet' : 'The store is opening soon'}>
          {category ? 'No products in this category yet. ' : 'Sellers are setting up their shops. '}
          <Link to={sell.to}>{sell.label}</Link> and be among the first.
        </EmptyState>
      ) : (
        <>
          <div className="product-grid explore-grid">
            {items.map((p) => <ProductCard key={p.id} {...cardProps(p)} />)}
          </div>
          <p className="see-all"><Link to={category ? `/search?category=${category}` : '/search'}>See all products</Link></p>
        </>
      )}
    </section>
  )
}

function SellerBand({ sell }) {
  return (
    <section className="seller-band" aria-labelledby="sell-title">
      <div className="seller-band-inner">
        <div>
          <h2 id="sell-title">Sell on QCS Store</h2>
          <p>Open a store, verify your business and reach shoppers across Pakistan. You list the products and ship the orders.</p>
          <Link to={sell.to} className="button">{sell.label}</Link>
        </div>
        <ol className="sell-steps">
          {SELL_STEPS.map((s) => (
            <li key={s.title}><strong>{s.title}</strong><span>{s.text}</span></li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export default function HomePage() {
  const { account } = useAuth()
  const sell = sellerLinkFor(account)
  return (
    <>
      <Hero sell={sell} />
      <TrustBand />
      <div className="home">
        <NewIn />
        <Explore sell={sell} />
      </div>
      <SellerBand sell={sell} />
    </>
  )
}
