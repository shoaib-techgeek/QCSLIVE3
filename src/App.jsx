import { useMemo, useState } from 'react'
import StudentCard from './components/StudentCard'
import Autocomplete from './components/Autocomplete'
import './App.css'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'probation', label: 'On probation' },
  { value: 'graduated', label: 'Graduated' },
]

const STUDENTS = [
  { rollNo: 'CS-2101', name: 'Aisha Khan', course: 'Computer Science', year: '3rd Year', gpa: 3.82, attendance: 96, email: 'aisha.khan@school.edu', status: 'active' },
  { rollNo: 'EE-2214', name: 'Daniel Okafor', course: 'Electrical Eng.', year: '2nd Year', gpa: 3.1, attendance: 82, email: 'daniel.okafor@school.edu', status: 'active' },
  { rollNo: 'BA-2033', name: 'Maria Gonzalez', course: 'Business Admin', year: '4th Year', gpa: 2.4, attendance: 68, email: 'maria.g@school.edu', status: 'probation' },
  { rollNo: 'CS-1987', name: 'Liam Chen', course: 'Computer Science', year: 'Alumni', gpa: 3.95, attendance: 99, email: 'liam.chen@school.edu', status: 'graduated' },
  { rollNo: 'ME-2150', name: 'Fatima Zahra', course: 'Mechanical Eng.', year: '1st Year', gpa: 3.5, attendance: 91, email: 'fatima.z@school.edu', status: 'active' },
  { rollNo: 'AR-2077', name: 'Noah Williams', course: 'Architecture', year: '2nd Year', gpa: 2.9, attendance: 74, email: 'noah.w@school.edu', status: 'probation' },
]

export default function App() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [selected, setSelected] = useState(null)

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return STUDENTS.filter(
      (s) =>
        (status === 'all' || s.status === status) &&
        (!q || s.name.toLowerCase().includes(q) || s.rollNo.toLowerCase().includes(q)),
    )
  }, [query, status])

  const handleView = (rollNo) => {
    const student = STUDENTS.find((s) => s.rollNo === rollNo)
    setSelected(student)
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>Students</h1>
        <p>{visible.length} of {STUDENTS.length} students</p>
      </header>

      <form className="toolbar" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="toolbar__search">
          Search
          <input
            type="search"
            placeholder="Name or roll number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
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
            <li key={student.rollNo}>
              <StudentCard {...student} onViewProfile={handleView} />
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
    </main>
  )
}
