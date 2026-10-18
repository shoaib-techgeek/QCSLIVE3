export const PROGRAMS = [
  'Computer Science',
  'Electrical Eng.',
  'Mechanical Eng.',
  'Business Admin',
  'Architecture',
  'Medicine',
  'Law',
]

export const PROGRAM_OPTIONS = PROGRAMS.map((p) => ({ value: p, label: p }))

export const STATUS_LABELS = {
  active: 'Active',
  probation: 'On probation',
  graduated: 'Graduated',
  pending: 'Pending',
  rejected: 'Rejected',
}

/** Statuses that count as currently enrolled. */
export const ENROLLED_STATUSES = ['active', 'probation']

export const DEMO_ADMIN = {
  email: 'admin@university.edu',
  password: 'Admin@123',
}
