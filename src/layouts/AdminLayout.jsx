import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useStudents } from '../context/StudentsContext'
import './AdminLayout.css'

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/applications', label: 'Applications', icon: 'applications', badge: true },
  { to: '/admin/students', label: 'Students', icon: 'students' },
]

const TITLES = {
  '/admin': 'Dashboard',
  '/admin/applications': 'Applications',
  '/admin/students': 'Students',
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { students } = useStudents()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const pending = students.filter((s) => s.status === 'pending').length

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  return (
    <div className="shell">
      <a className="shell__skip" href="#main">
        Skip to content
      </a>

      <aside className={`sidebar${open ? ' is-open' : ''}`} id="sidebar" aria-label="Sidebar">
        <div className="sidebar__head">
          <Link to="/admin" className="sidebar__brand" onClick={() => setOpen(false)}>
            <Icon name="cap" size={26} />
            <span>Northbridge</span>
          </Link>
          <button
            type="button"
            className="icon-btn sidebar__close"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Main">
          <p className="sidebar__section">Manage</p>
          <ul>
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className="sidebar__link"
                  onClick={() => setOpen(false)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.badge && pending > 0 && (
                    <span className="sidebar__count" aria-label={`${pending} pending`}>
                      {pending}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <p className="sidebar__foot">University Registration · v1.0</p>
      </aside>

      {open && <div className="shell__scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="shell__main">
        <header className="topbar">
          <button
            type="button"
            className="icon-btn topbar__menu"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="sidebar"
            onClick={() => setOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <h1 className="topbar__title">{TITLES[pathname] ?? 'Admin'}</h1>

          <div className="topbar__right">
            <div className="topbar__user">
              <span className="topbar__avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="topbar__who">
                <strong>{user.name}</strong>
                <small>Administrator</small>
              </span>
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              aria-label="Sign out"
              onClick={handleLogout}
            >
              <Icon name="logout" size={16} />
              <span className="topbar__logout-label">Sign out</span>
            </button>
          </div>
        </header>

        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
