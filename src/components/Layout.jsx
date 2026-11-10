import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { useCart } from '../cart/CartContext.jsx'
import { CATEGORIES } from '../lib/categories.js'
import { sellerLinkFor } from '../lib/sellerLink.js'
import ThemeToggle from '../ui/ThemeToggle.jsx'
import Logo from './Logo.jsx'
import SiteFooter from './SiteFooter.jsx'

const ICONS = {
  star: 'M12 2l3 6.3 6.9.9-5 4.8 1.2 6.9L12 17.6 5.9 20.9 7.1 14 2.1 9.2 9 8.3z',
  search: 'M11 4a7 7 0 1 0 4.2 12.6l4.6 4.6 1.4-1.4-4.6-4.6A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  support: 'M12 3a9 9 0 0 0-9 9v5a3 3 0 0 0 3 3h1v-7H5v-1a7 7 0 0 1 14 0v1h-2v7h1a3 3 0 0 0 3-3v-5a9 9 0 0 0-9-9z',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 9h-3a15 15 0 0 0-1.2-5A8 8 0 0 1 18.9 11zM12 4c.8 1 1.6 3 1.9 7h-3.8c.3-4 1.1-6 1.9-7zM9.3 6a15 15 0 0 0-1.2 5h-3A8 8 0 0 1 9.3 6zM5.1 13h3a15 15 0 0 0 1.2 5 8 8 0 0 1-4.2-5zm5 0h3.8c-.3 4-1.1 6-1.9 7-.8-1-1.6-3-1.9-7zm5.6 5a15 15 0 0 0 1.2-5h3a8 8 0 0 1-4.2 5z',
  chevron: 'M6 9l6 6 6-6',
  cart: 'M3 3h2l.4 2M5.4 5H21l-2 9H8L5.4 5zM8 14l-1 3h12M9 20.5a1 1 0 1 0 0 .01M18 20.5a1 1 0 1 0 0 .01',
}

function Icon({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"
      fill={d === ICONS.cart || d === ICONS.chevron ? 'none' : 'currentColor'}
      stroke={d === ICONS.cart || d === ICONS.chevron ? 'currentColor' : 'none'}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

export default function Layout() {
  const { status, account, logout } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [query, setQuery] = useState('')
  const initial = (account?.fullName || account?.email || '?').charAt(0).toUpperCase()

  function handleSearch(event) {
    event.preventDefault()
    const q = query.trim()
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  }

  async function handleLogout() {
    setSigningOut(true)
    try {
      await logout()
    } finally {
      setSigningOut(false)
      navigate('/')
    }
  }

  const sell = sellerLinkFor(account)

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <div className="utility-bar">
        <div className="utility-inner">
          <ul className="promise-list">
            <li>Cash on delivery in Pakistan</li>
            <li>14-day returns</li>
            <li>Verified sellers</li>
          </ul>
          <div className="utility-links">
            {account?.permissions?.includes('admin:access') && <Link to="/admin/kyc" className="utility-link">Admin console</Link>}
            <Link to={sell.to} className="utility-sell">{sell.label}</Link>
          </div>
        </div>
      </div>
      <header className="site-header">
        <div className="site-header-inner">
          <Link to="/" className="brand"><Logo /> <span>QCS Store</span></Link>

          <nav aria-label="Primary" className="site-links">
            <Link to="/search?sort=newest" className="site-link"><Icon d={ICONS.star} /> New in</Link>
            <details className="cat-menu">
              <summary className="site-link">Categories <Icon d={ICONS.chevron} size={14} /></summary>
              <ul>
                {CATEGORIES.map((c) => (
                  <li key={c.slug}>
                    <Link to={`/search?category=${c.slug}`} onClick={(e) => e.currentTarget.closest('details').removeAttribute('open')}>{c.name}</Link>
                  </li>
                ))}
              </ul>
            </details>
          </nav>

          <form className="site-search" role="search" onSubmit={handleSearch}>
            <input
              type="search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products"
              aria-label="Search products"
            />
            <button type="submit" aria-label="Search"><Icon d={ICONS.search} size={20} /></button>
          </form>

          <div className="site-actions">
            {status === 'authenticated' ? (
              <>
                <Link to="/account" className="account-link">
                  <span className="account-avatar" aria-hidden="true">{initial}</span>
                  <span className="account-text">
                    <span>Hello, {account?.fullName || account?.email}</span>
                    <strong>Orders &amp; Account</strong>
                  </span>
                </Link>
                <button type="button" className="site-link" onClick={handleLogout} disabled={signingOut}>
                  Sign out
                </button>
              </>
            ) : status === 'anonymous' ? (
              <>
                <Link to="/login" className="site-link">Sign in</Link>
                <Link to="/register" className="site-pill">Create account</Link>
              </>
            ) : null}
            <button type="button" className="site-link site-link-extra"><Icon d={ICONS.support} /> Support</button>
            <ThemeToggle />
            <button type="button" className="site-link site-link-extra"><Icon d={ICONS.globe} /> English</button>
            <Link to="/cart" className="site-link" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`}><Icon d={ICONS.cart} size={24} /> <span>{count}</span></Link>
          </div>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <SiteFooter />
    </>
  )
}
