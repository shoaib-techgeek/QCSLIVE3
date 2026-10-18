import Icon from '../../components/Icon'
import './auth.css'

const YEAR = new Date().getFullYear()

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth__brand" aria-hidden="true">
        <div className="auth__logo">
          <Icon name="cap" size={28} />
          <span>Northbridge University</span>
        </div>
        <div>
          <p className="auth__tagline">Registration &amp; administration, in one place.</p>
          <ul className="auth__points">
            <li>Apply for admission in minutes</li>
            <li>Track every application and enrolment</li>
            <li>Keep student records organised</li>
          </ul>
        </div>
        <p className="auth__copy">© {YEAR} Northbridge University</p>
      </aside>

      <main className="auth__main">
        <div className="auth__card">
          <div className="auth__mobile-logo">
            <Icon name="cap" size={24} />
            <span>Northbridge University</span>
          </div>
          <h1 className="auth__title">{title}</h1>
          <p className="auth__subtitle">{subtitle}</p>
          {children}
          {footer && <p className="auth__footer">{footer}</p>}
        </div>
      </main>
    </div>
  )
}
