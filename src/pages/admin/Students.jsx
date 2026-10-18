import { useMemo, useState } from 'react'
import StudentCard from '../../components/StudentCard'
import Autocomplete from '../../components/Autocomplete'
import { useStudents } from '../../context/StudentsContext'
import './admin.css'
import './students.css'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'probation', label: 'On probation' },
  { value: 'graduated', label: 'Graduated' },
]

export default function Students() {
  const { students } = useStudents()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState(null)

  // Applicants are managed on the Applications page.
  const roster = useMemo(
    () => students.filter((s) => s.status !== 'pending' && s.status !== 'rejected'),
    [students],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return roster.filter(
      (s) =>
        (status === 'all' || s.status === status) &&
        (!q || s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q)),
    )
  }, [roster, query, status])

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Students</h2>
        <p>
          {visible.length} of {roster.length} students
        </p>
      </div>

      <form className="toolbar" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field toolbar__search">
          <label className="field__label" htmlFor="student-search">
            Search
          </label>
          <input
            id="student-search"
            className="field__input"
            type="search"
            placeholder="Name or roll number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Autocomplete
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={setStatus}
          placeholder="Search status"
        />
      </form>

      {visible.length ? (
        <ul className="grid">
          {visible.map((student) => (
            <li key={student.id}>
              <StudentCard
                {...student}
                onViewProfile={() => {
                  setSelected(student)
                  setTimeout(() => setSelected(null), 2500)
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">No students match your filters.</p>
      )}

      {selected && (
        <p className="toast" role="status">
          Opening profile for {selected.name}…
        </p>
      )}
    </div>
  )
}
