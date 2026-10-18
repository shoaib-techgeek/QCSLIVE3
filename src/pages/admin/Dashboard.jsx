import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import StatusBadge from '../../components/StatusBadge'
import { useStudents } from '../../context/StudentsContext'
import { ENROLLED_STATUSES, PROGRAMS, STATUS_LABELS } from '../../constants'
import './admin.css'

const STATUS_ORDER = ['active', 'probation', 'graduated', 'pending', 'rejected']
const dateFmt = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' })

export default function Dashboard() {
  const { students, approve, reject } = useStudents()

  const stats = useMemo(() => {
    const enrolled = students.filter((s) => ENROLLED_STATUSES.includes(s.status))
    const pending = students
      .filter((s) => s.status === 'pending')
      .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
    const graded = enrolled.filter((s) => typeof s.gpa === 'number')
    const avgGpa = graded.length ? graded.reduce((sum, s) => sum + s.gpa, 0) / graded.length : null

    const byProgram = PROGRAMS.map((program) => ({
      program,
      count: enrolled.filter((s) => s.course === program).length,
    })).sort((a, b) => b.count - a.count)

    const byStatus = STATUS_ORDER.map((status) => ({
      status,
      count: students.filter((s) => s.status === status).length,
    }))

    const attention = enrolled.filter(
      (s) => s.status === 'probation' || (typeof s.attendance === 'number' && s.attendance < 75),
    )

    return { enrolled, pending, avgGpa, byProgram, byStatus, attention }
  }, [students])

  const maxProgram = Math.max(1, ...stats.byProgram.map((p) => p.count))
  const total = students.length || 1
  const graduated = stats.byStatus.find((s) => s.status === 'graduated').count

  const cards = [
    { label: 'Enrolled students', value: stats.enrolled.length, note: 'Active + on probation', icon: 'students' },
    { label: 'Pending applications', value: stats.pending.length, note: 'Awaiting review', icon: 'applications' },
    { label: 'Graduates', value: graduated, note: 'All time', icon: 'cap' },
    { label: 'Average GPA', value: stats.avgGpa === null ? '—' : stats.avgGpa.toFixed(2), note: 'Enrolled students', icon: 'dashboard' },
  ]

  return (
    <div className="stack">
      <section aria-label="Key figures" className="stats">
        {cards.map((c) => (
          <div className="stat" key={c.label}>
            <span className="stat__icon">
              <Icon name={c.icon} />
            </span>
            <div>
              <p className="stat__label">{c.label}</p>
              <p className="stat__value">{c.value}</p>
              <p className="stat__note">{c.note}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="split">
        <section className="panel" aria-labelledby="by-program">
          <h2 className="panel__title" id="by-program">
            Enrolment by program
          </h2>
          <ul className="bars">
            {stats.byProgram.map(({ program, count }) => (
              <li key={program} className="bars__row">
                <span className="bars__label">{program}</span>
                <span className="bars__track" aria-hidden="true">
                  <span className="bars__fill" style={{ width: `${(count / maxProgram) * 100}%` }} />
                </span>
                <span className="bars__value">{count}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel" aria-labelledby="by-status">
          <h2 className="panel__title" id="by-status">
            Records by status
          </h2>
          <div className="stack-bar" aria-hidden="true">
            {stats.byStatus
              .filter((s) => s.count)
              .map((s) => (
                <span
                  key={s.status}
                  className={`stack-bar__seg stack-bar__seg--${s.status}`}
                  style={{ flexGrow: s.count }}
                />
              ))}
          </div>
          <ul className="legend">
            {stats.byStatus.map((s) => (
              <li key={s.status}>
                <span className={`legend__dot stack-bar__seg--${s.status}`} aria-hidden="true" />
                {STATUS_LABELS[s.status]}
                <strong>
                  {s.count} <small>({Math.round((s.count / total) * 100)}%)</small>
                </strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="split">
        <section className="panel" aria-labelledby="recent-apps">
          <div className="panel__head">
            <h2 className="panel__title" id="recent-apps">
              Recent applications
            </h2>
            <Link className="panel__link" to="/admin/applications">
              View all
            </Link>
          </div>
          {stats.pending.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Applicant</th>
                    <th scope="col">Program</th>
                    <th scope="col">Applied</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.pending.slice(0, 5).map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        <br />
                        <span className="table__muted">{s.email}</span>
                      </td>
                      <td>{s.course}</td>
                      <td className="table__muted">{dateFmt.format(new Date(s.appliedAt))}</td>
                      <td>
                        <div className="table__actions">
                          <button type="button" className="btn btn--primary btn--sm" onClick={() => approve(s.id)} aria-label={`Approve ${s.name}`}>
                            Approve
                          </button>
                          <button type="button" className="btn btn--secondary btn--sm" onClick={() => reject(s.id)} aria-label={`Reject ${s.name}`}>
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted-note">No applications waiting for review.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="attention">
          <h2 className="panel__title" id="attention">
            Needs attention
          </h2>
          {stats.attention.length ? (
            <ul className="attention">
              {stats.attention.map((s) => (
                <li key={s.id}>
                  <div>
                    <strong>{s.name}</strong>
                    <span className="table__muted">
                      {s.rollNo} · {s.attendance}% attendance
                    </span>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-note">Everyone is on track.</p>
          )}
        </section>
      </div>
    </div>
  )
}
