import { useMemo, useState } from 'react'
import StatusBadge from '../../components/StatusBadge'
import SortableTh from '../../components/SortableTh'
import Pagination from '../../components/Pagination'
import { useStudents } from '../../context/StudentsContext'
import './admin.css'
import './students.css'

const dateFmt = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' })

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
]

const COMPARATORS = {
  name: (a, b) => a.name.localeCompare(b.name),
  course: (a, b) => a.course.localeCompare(b.course),
  appliedAt: (a, b) => a.appliedAt.localeCompare(b.appliedAt),
  status: (a, b) => a.status.localeCompare(b.status),
}

export default function Applications() {
  const { students, approve, reject } = useStudents()
  const [tab, setTab] = useState('pending')
  const [sort, setSort] = useState({ key: 'appliedAt', dir: 'desc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const applications = useMemo(
    () => students.filter((s) => s.status === 'pending' || s.status === 'rejected'),
    [students],
  )

  const counts = {
    pending: applications.filter((s) => s.status === 'pending').length,
    rejected: applications.filter((s) => s.status === 'rejected').length,
    all: applications.length,
  }

  const sorted = useMemo(() => {
    const filtered = tab === 'all' ? applications : applications.filter((s) => s.status === tab)
    const compare = COMPARATORS[sort.key]
    const factor = sort.dir === 'asc' ? 1 : -1
    // Name is a stable tie-breaker so equal values don't shuffle between renders.
    return [...filtered].sort((a, b) => compare(a, b) * factor || a.name.localeCompare(b.name))
  }, [applications, tab, sort])

  // Clamp: approving/rejecting the last row of a page can leave it out of range.
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const rows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const changeTab = (value) => {
    setTab(value)
    setPage(1)
  }

  const changeSort = (key) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))
    setPage(1)
  }

  const changePageSize = (size) => {
    setPageSize(size)
    setPage(1)
  }

  return (
    <div className="stack">
      <div className="page-head">
        <h2>Applications</h2>
        <p>Review new applicants. Approving creates an active student record.</p>
      </div>

      <div className="segmented" role="group" aria-label="Filter applications">
        {TABS.map((t) => (
          <button key={t.value} type="button" aria-pressed={tab === t.value} onClick={() => changeTab(t.value)}>
            {t.label} ({counts[t.value]})
          </button>
        ))}
      </div>

      <section className="panel" aria-label="Applications list">
        {sorted.length ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <SortableTh label="Applicant" sortKey="name" sort={sort} onSort={changeSort} />
                    <SortableTh label="Program" sortKey="course" sort={sort} onSort={changeSort} />
                    <SortableTh label="Applied" sortKey="appliedAt" sort={sort} onSort={changeSort} />
                    <SortableTh label="Status" sortKey="status" sort={sort} onSort={changeSort} />
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        <br />
                        <span className="table__muted">{s.email}</span>
                      </td>
                      <td>{s.course}</td>
                      <td className="table__muted">{dateFmt.format(new Date(s.appliedAt))}</td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                      <td>
                        <div className="table__actions">
                          <button type="button" className="btn btn--primary btn--sm" onClick={() => approve(s.id)} aria-label={`Approve ${s.name}`}>
                            Approve
                          </button>
                          {s.status === 'pending' && (
                            <button type="button" className="btn btn--secondary btn--sm" onClick={() => reject(s.id)} aria-label={`Reject ${s.name}`}>
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={currentPage}
              pageSize={pageSize}
              total={sorted.length}
              onPageChange={setPage}
              onPageSizeChange={changePageSize}
            />
          </>
        ) : (
          <p className="muted-note">Nothing to show here.</p>
        )}
      </section>
    </div>
  )
}
