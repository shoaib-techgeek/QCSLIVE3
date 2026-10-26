import Logo from './Logo.jsx'

/** Split layout for sign-in style pages: brand panel (desktop only) + form card. */
export default function AuthShell({ children }) {
  return (
    <div className="auth">
      <aside className="auth-brand" aria-hidden="true">
        <div className="awning awning-lg" />
        <div className="auth-brand-body">
          <div className="auth-brand-logo"><Logo size={36} /> QCS Live</div>
          <p className="auth-brand-title">Your marketplace, open for business.</p>
          <p className="auth-brand-text">One account for everything you buy and every order you track.</p>
          <div className="tile-row">
            <span className="tile tile-mango" />
            <span className="tile tile-teal" />
            <span className="tile tile-coral" />
            <span className="tile tile-white" />
          </div>
        </div>
      </aside>
      <div className="auth-main">
        <div className="auth-card">{children}</div>
      </div>
    </div>
  )
}
