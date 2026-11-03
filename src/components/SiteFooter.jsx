import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import { CATEGORIES } from '../lib/sampleCatalog.js'
import { sellerLinkFor } from '../lib/sellerLink.js'
import Logo from './Logo.jsx'

export default function SiteFooter() {
  const { status, account } = useAuth()
  const sell = sellerLinkFor(account)
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-about">
          <Link to="/" className="brand footer-brand"><Logo /> <span>QCS Store</span></Link>
          <p>Products from independent sellers, with cash on delivery in Pakistan and 14-day returns.</p>
        </div>
        <nav aria-label="Shop" className="footer-col">
          <h2>Shop</h2>
          <ul>{CATEGORIES.slice(0, 6).map((c) => <li key={c.slug}><Link to={`/?category=${c.slug}`}>{c.name}</Link></li>)}</ul>
        </nav>
        <nav aria-label="Sell" className="footer-col">
          <h2>Sell</h2>
          <ul>
            <li><Link to={sell.to}>{sell.label}</Link></li>
          </ul>
        </nav>
        <nav aria-label="Account" className="footer-col">
          <h2>Account</h2>
          <ul>
            {status === 'authenticated'
              ? <li><Link to="/account">My account</Link></li>
              : <><li><Link to="/login">Sign in</Link></li><li><Link to="/register">Create account</Link></li></>}
          </ul>
        </nav>
      </div>
      <p className="footer-legal">&copy; {new Date().getFullYear()} QCS Store</p>
    </footer>
  )
}
