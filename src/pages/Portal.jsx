import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { useStudents } from '../context/StudentsContext'
import './pages.css'

const MESSAGES = {
  pending: 'Your application has been received and is waiting for review by the admissions office.',
  active: 'Congratulations, you are enrolled. Your student record is active.',
  rejected: 'Unfortunately your application was not approved. Contact admissions for next steps.',
}

export default function Portal() {
  const { user, logout } = useAuth()
  const { students } = useStudents()
  const navigate = useNavigate()
  const record = students.find((s) => s.id === user.studentId)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="portal">
      <header className="portal__bar">
        <span className="portal__brand">
          <Icon name="cap" size={24} /> Northbridge University
        </span>
        <button type="button" className="btn btn--secondary btn--sm" onClick={handleLogout}>
          <Icon name="logout" size={16} /> Sign out
        </button>
      </header>

      <main className="portal__main">
        <h1>Hello, {user.name.split(' ')[0]}</h1>
        {record ? (
          <section className="panel" aria-labelledby="app-status">
            <div className="panel__head">
              <h2 className="panel__title" id="app-status">
                Application status
              </h2>
              <StatusBadge status={record.status} />
            </div>
            <p>{MESSAGES[record.status] ?? 'Your record is up to date.'}</p>
            <dl className="portal__details">
              <div>
                <dt>Program</dt>
                <dd>{record.course}</dd>
              </div>
              <div>
                <dt>Reference</dt>
                <dd>{record.rollNo}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{record.email}</dd>
              </div>
            </dl>
          </section>
        ) : (
          <p>We couldn’t find your application record.</p>
        )}
      </main>
    </div>
  )
}
