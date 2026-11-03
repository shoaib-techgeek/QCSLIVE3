export const KIND_LABELS = {
  cnic_front: 'CNIC (front)',
  cnic_back: 'CNIC (back)',
  business_registration: 'Business registration document',
  business_photo: 'Photos of your business',
  tax_certificate: 'Tax (NTN/VAT) certificate',
}

export const STATUS_LABELS = {
  not_submitted: { label: 'Not submitted', tone: 'neutral' },
  submitted: { label: 'Submitted', tone: 'info' },
  under_review: { label: 'Under review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  approved_with_conditions: { label: 'Approved with conditions', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
  more_info_required: { label: 'More information needed', tone: 'warning' },
}
