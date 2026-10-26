import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="container center-page">
      <h1>Page not found</h1>
      <p className="muted">The page you are looking for does not exist or has moved.</p>
      <p><Link to="/" className="button">Back to home</Link></p>
    </section>
  )
}
