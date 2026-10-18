import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'ucp.students.v2'

const SEED = [
  { id: 's1', rollNo: 'CS-2101', name: 'Aisha Khan', course: 'Computer Science', year: '3rd Year', gpa: 3.82, attendance: 96, email: 'aisha.khan@school.edu', status: 'active', appliedAt: '2023-08-14' },
  { id: 's2', rollNo: 'EE-2214', name: 'Daniel Okafor', course: 'Electrical Eng.', year: '2nd Year', gpa: 3.1, attendance: 82, email: 'daniel.okafor@school.edu', status: 'active', appliedAt: '2024-08-19' },
  { id: 's3', rollNo: 'BA-2033', name: 'Maria Gonzalez', course: 'Business Admin', year: '4th Year', gpa: 2.4, attendance: 68, email: 'maria.g@school.edu', status: 'probation', appliedAt: '2022-08-10' },
  { id: 's4', rollNo: 'CS-1987', name: 'Liam Chen', course: 'Computer Science', year: 'Alumni', gpa: 3.95, attendance: 99, email: 'liam.chen@school.edu', status: 'graduated', appliedAt: '2020-08-12' },
  { id: 's5', rollNo: 'ME-2150', name: 'Fatima Zahra', course: 'Mechanical Eng.', year: '1st Year', gpa: 3.5, attendance: 91, email: 'fatima.z@school.edu', status: 'active', appliedAt: '2025-08-18' },
  { id: 's6', rollNo: 'AR-2077', name: 'Noah Williams', course: 'Architecture', year: '2nd Year', gpa: 2.9, attendance: 74, email: 'noah.w@school.edu', status: 'probation', appliedAt: '2024-08-19' },
  { id: 's7', rollNo: 'CS-2230', name: 'Priya Sharma', course: 'Computer Science', year: '2nd Year', gpa: 3.67, attendance: 94, email: 'priya.s@school.edu', status: 'active', appliedAt: '2024-08-19' },
  { id: 's8', rollNo: 'MD-2301', name: 'Omar Haddad', course: 'Medicine', year: '1st Year', gpa: 3.74, attendance: 97, email: 'omar.h@school.edu', status: 'active', appliedAt: '2025-08-18' },
  { id: 's9', rollNo: 'LW-2112', name: 'Sofia Rossi', course: 'Law', year: '3rd Year', gpa: 3.33, attendance: 88, email: 'sofia.r@school.edu', status: 'active', appliedAt: '2023-08-14' },
  { id: 's10', rollNo: 'BA-2189', name: 'James Carter', course: 'Business Admin', year: '2nd Year', gpa: 3.0, attendance: 85, email: 'james.c@school.edu', status: 'active', appliedAt: '2024-08-19' },
  { id: 's11', rollNo: 'EE-1990', name: 'Chloe Martin', course: 'Electrical Eng.', year: 'Alumni', gpa: 3.58, attendance: 93, email: 'chloe.m@school.edu', status: 'graduated', appliedAt: '2020-08-12' },
  { id: 's12', rollNo: 'APP-1001', name: 'Hassan Ali', course: 'Medicine', year: '1st Year', email: 'hassan.ali@mail.com', status: 'pending', appliedAt: '2026-10-12' },
  { id: 's13', rollNo: 'APP-1002', name: 'Emily Brown', course: 'Computer Science', year: '1st Year', email: 'emily.brown@mail.com', status: 'pending', appliedAt: '2026-10-14' },
  { id: 's14', rollNo: 'APP-1003', name: 'Yuki Tanaka', course: 'Architecture', year: '1st Year', email: 'yuki.t@mail.com', status: 'pending', appliedAt: '2026-10-16' },
  { id: 's15', rollNo: 'APP-0999', name: 'Victor Petrov', course: 'Law', year: '1st Year', email: 'victor.p@mail.com', status: 'rejected', appliedAt: '2026-10-02' },
]

// Extra applicants so the Applications table has enough rows to paginate.
const EXTRA_APPLICANTS = [
  ['Amara Nwosu', 'Medicine'], ['Ben Fischer', 'Law'], ['Carla Mendes', 'Business Admin'],
  ['Dev Patel', 'Computer Science'], ['Elena Volkova', 'Architecture'], ['Farid Karimi', 'Electrical Eng.'],
  ['Grace Liu', 'Mechanical Eng.'], ['Hiro Sato', 'Computer Science'], ['Isla Murphy', 'Law'],
  ['Jon Alvarez', 'Business Admin'], ['Kara Nilsson', 'Medicine'], ['Leo Dubois', 'Architecture'],
].map(([name, course], i) => ({
  id: `sx${i + 1}`,
  rollNo: `APP-11${String(i + 10)}`,
  name,
  course,
  year: '1st Year',
  email: `${name.toLowerCase().replace(/\s+/g, '.')}@mail.com`,
  status: i % 6 === 5 ? 'rejected' : 'pending',
  appliedAt: `2026-10-${String(1 + i).padStart(2, '0')}`,
}))
SEED.push(...EXTRA_APPLICANTS)

const PREFIX = {
  'Computer Science': 'CS',
  'Electrical Eng.': 'EE',
  'Mechanical Eng.': 'ME',
  'Business Admin': 'BA',
  Architecture: 'AR',
  Medicine: 'MD',
  Law: 'LW',
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // storage unavailable or corrupted: fall back to seed data
  }
  return SEED
}

const StudentsContext = createContext(null)

export function StudentsProvider({ children }) {
  const [students, setStudents] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(students))
    } catch {
      // ignore: data just won't persist
    }
  }, [students])

  /** Creates a pending application and returns it. */
  const addApplication = useCallback(({ name, email, course }) => {
    const application = {
      id: `s${Date.now()}`,
      rollNo: `APP-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      course,
      year: '1st Year',
      status: 'pending',
      appliedAt: new Date().toISOString().slice(0, 10),
    }
    setStudents((list) => [application, ...list])
    return application
  }, [])

  const approve = useCallback((id) => {
    setStudents((list) =>
      list.map((s) => {
        if (s.id !== id) return s
        const number = Math.floor(2000 + Math.random() * 8000)
        return {
          ...s,
          status: 'active',
          rollNo: `${PREFIX[s.course] ?? 'ST'}-${number}`,
          gpa: undefined,
          attendance: undefined,
        }
      }),
    )
  }, [])

  const reject = useCallback((id) => {
    setStudents((list) => list.map((s) => (s.id === id ? { ...s, status: 'rejected' } : s)))
  }, [])

  const value = useMemo(
    () => ({ students, addApplication, approve, reject }),
    [students, addApplication, approve, reject],
  )

  return <StudentsContext.Provider value={value}>{children}</StudentsContext.Provider>
}

export function useStudents() {
  const ctx = useContext(StudentsContext)
  if (!ctx) throw new Error('useStudents must be used inside <StudentsProvider>')
  return ctx
}
