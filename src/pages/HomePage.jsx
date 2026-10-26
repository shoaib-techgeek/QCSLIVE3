import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

export default function HomePage() {
  const { status } = useAuth()
  return (
    <section className="hero">
      <div className="hero-copy">
        <h1>Shop the whole market in one place.</h1>
        <p>
          Browse products from independent sellers, check out once, and follow every order.
          The catalogue opens soon. Create your account now and you will be ready on day one.
        </p>
        <div className="hero-actions">
          {status === 'authenticated' ? (
            <Link to="/account" className="button">Go to my account</Link>
          ) : (
            <>
              <Link to="/register" className="button">Create account</Link>
              <Link to="/login" className="button button-ghost">Sign in</Link>
            </>
          )}
        </div>
      </div>
      <div className="collage" aria-hidden="true">
        <span className="tile tile-violet c1" />
        <span className="tile tile-mango c2" />
        <span className="tile tile-teal c3" />
        <span className="tile tile-coral c4" />
        <span className="tile tile-white c5" />
        <span className="tile tile-ink c6" />
      </div>
    </section>
  )
}
