import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'
import Icon from '../ui/Icon.jsx'
import ThemeToggle from '../ui/ThemeToggle.jsx'
import Logo from './Logo.jsx'

/** Shared shell for the seller center and admin console. `nav`: [{ to, label, icon, end? }]. */
export default function ConsoleLayout({ title, nav }) {
  const { account } = useAuth()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="console">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="console-side" data-open={open}>
        <Link to="/" className="console-brand">
          <Logo size={32} />
          <span>QCS Live<small>{title}</small></span>
        </Link>
        <nav className="console-nav" aria-label={title}>
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className="console-link" onClick={() => setOpen(false)}>
              <Icon name={item.icon} size={20} /> {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="console-side-foot">{account?.email}</p>
      </aside>
      {open && <button type="button" className="console-scrim" aria-label="Close menu" onClick={() => setOpen(false)} />}
      <div>
        <header className="console-top">
          <button type="button" className="button button-ghost button-icon console-menu" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <strong>{title}</strong>
          <span className="spacer" />
          <ThemeToggle />
          <Link to="/" className="button button-ghost button-small">View store</Link>
        </header>
        <main id="main" className="console-content"><Outlet /></main>
      </div>
    </div>
  )
}
