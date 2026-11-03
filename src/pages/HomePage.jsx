import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { CATEGORIES, SHELVES } from '../lib/sampleCatalog.js'
import { sellerLinkFor } from '../lib/sellerLink.js'
import ProductCard from '../ui/ProductCard.jsx'

const TRUST = [
  { title: 'Cash on delivery', text: 'Pay when your order arrives, anywhere in Pakistan.' },
  { title: '14-day returns', text: 'Send an item back within 14 days of delivery.' },
  { title: 'Verified sellers', text: 'We check every seller’s business before they can publish.' },
  { title: 'Follow every order', text: 'See where your order is from the moment the seller ships it.' },
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
            <a href="#best-sellers" className="button">Start shopping</a>
            <Link to={sell.to} className="button button-ghost">{sell.label}</Link>
          </div>
        </div>
        <div className="price-board" aria-hidden="true">
          {['violet', 'mango', 'teal', 'coral', 'ink'].map((tone, i) => (
            <span key={i} className={`board-tile tile tile-${tone} b${i + 1}`}><i className="tag" /></span>
          ))}
        </div>
      </div>
    </section>
  )
}

function TrustRow() {
  return (
    <ul className="trust-row" aria-label="Why shop with us">
      {TRUST.map((t) => (
        <li key={t.title}>
          <strong>{t.title}</strong>
          <span>{t.text}</span>
        </li>
      ))}
    </ul>
  )
}

function CategoryRow() {
  return (
    <section className="home-section" aria-labelledby="cats-title">
      <h2 id="cats-title" className="section-title">Shop by category</h2>
      <ul className="cat-row">
        {CATEGORIES.map((c) => (
          <li key={c.slug}>
            <Link to={`/?category=${c.slug}`} className="cat-tile">
              <span className={`tile tile-${c.tone} cat-art`} aria-hidden="true" />
              <span>{c.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Shelf({ shelf }) {
  return (
    <section className="home-section" id={shelf.id} aria-labelledby={`${shelf.id}-title`}>
      <div className="section-head">
        <h2 id={`${shelf.id}-title`} className="section-title">{shelf.title}</h2>
        <Link to={`/?sort=${shelf.sort}`}>See all {shelf.title.toLowerCase()}</Link>
      </div>
      <div className="product-grid shelf-grid">
        {shelf.products.map((p) => <ProductCard key={p.slug} to="/" {...p} />)}
      </div>
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
          <Link to={sell.to} className="button band-cta">{sell.label}</Link>
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
      <div className="home">
        <TrustRow />
        <CategoryRow />
        <p className="sample-note" role="note">The catalogue opens soon. The products below are samples so you can see how the store will look.</p>
        {SHELVES.map((s) => <Shelf key={s.id} shelf={s} />)}
      </div>
      <SellerBand sell={sell} />
    </>
  )
}
