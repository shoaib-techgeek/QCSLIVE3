import './StudentCard.css'

const STATUS_LABELS = {
  active: 'Active',
  probation: 'On probation',
  graduated: 'Graduated',
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
}

function attendanceLevel(value) {
  if (value >= 90) return 'good'
  if (value >= 75) return 'fair'
  return 'low'
}

/**
 * @param {object} props
 * @param {string} props.name
 * @param {string} props.rollNo
 * @param {string} props.course
 * @param {string} [props.year]               e.g. "3rd Year"
 * @param {number} [props.gpa]                0 - 4
 * @param {number} [props.attendance]         0 - 100
 * @param {string} [props.email]
 * @param {string} [props.avatar]             image URL, falls back to initials
 * @param {'active'|'probation'|'graduated'} [props.status]
 * @param {(rollNo: string) => void} [props.onViewProfile]
 */
export default function StudentCard({
  name,
  rollNo,
  course,
  year,
  gpa,
  attendance,
  email,
  avatar,
  status = 'active',
  onViewProfile,
}) {
  const hasAttendance = typeof attendance === 'number'
  const level = hasAttendance ? attendanceLevel(attendance) : null

  return (
    <article className="student-card" aria-label={`Student ${name}`}>
      <header className="student-card__header">
        {avatar ? (
          <img className="student-card__avatar" src={avatar} alt={`${name}`} loading="lazy" />
        ) : (
          <span className="student-card__avatar student-card__avatar--initials" aria-hidden="true">
            {getInitials(name)}
          </span>
        )}
        <div className="student-card__identity">
          <h3 className="student-card__name">{name}</h3>
          <p className="student-card__roll">{rollNo}</p>
        </div>
        <span className={`student-card__badge student-card__badge--${status}`}>
          {STATUS_LABELS[status] ?? status}
        </span>
      </header>

      <dl className="student-card__meta">
        <div>
          <dt>Course</dt>
          <dd>{course}</dd>
        </div>
        {year && (
          <div>
            <dt>Year</dt>
            <dd>{year}</dd>
          </div>
        )}
        {typeof gpa === 'number' && (
          <div>
            <dt>GPA</dt>
            <dd>{gpa.toFixed(2)}</dd>
          </div>
        )}
      </dl>

      {!hasAttendance && <div aria-hidden="true" />}
      {hasAttendance && (
        <div className="student-card__attendance">
          <div className="student-card__attendance-label">
            <span id={`att-${rollNo}`}>Attendance</span>
            <strong>{attendance}%</strong>
          </div>
          <div
            className="student-card__bar"
            role="progressbar"
            aria-labelledby={`att-${rollNo}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={attendance}
          >
            <div
              className={`student-card__bar-fill student-card__bar-fill--${level}`}
              style={{ width: `${attendance}%` }}
            />
          </div>
        </div>
      )}

      <footer className="student-card__footer">
        {email && (
          <a className="student-card__email" href={`mailto:${email}`}>
            {email}
          </a>
        )}
        {onViewProfile && (
          <button
            type="button"
            className="student-card__action"
            onClick={() => onViewProfile(rollNo)}
          >
            View profile
          </button>
        )}
      </footer>
    </article>
  )
}
