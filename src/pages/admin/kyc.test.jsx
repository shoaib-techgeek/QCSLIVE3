import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT, apiError, mockApi, renderApp } from '../../test/utils.jsx'

afterEach(() => vi.unstubAllGlobals())

const ADMIN = { ...ACCOUNT, permissions: ['admin:access', 'kyc:review'] }
const asAdmin = { 'GET /api/v1/me': { json: { account: ADMIN } } }
const detail = (over = {}) => ({
  id: 's1', storeName: 'Ali Traders', status: 'submitted', note: null, flags: [],
  documents: [{ id: 'd1', kind: 'cnic_front', mime: 'image/png', sizeBytes: 10 }],
  pii: { cnic: '4210112345671', address: 'Shop 4, Main Market, Karachi', ntn: null },
  history: [], ...over,
})

describe('admin KYC queue', () => {
  it('blocks users without the kyc:review permission', async () => {
    mockApi({ 'GET /api/v1/me': { json: { account: { ...ACCOUNT, permissions: ['admin:access'] } } } })
    renderApp('/admin/kyc')
    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument()
  })

  it('lists applications with links and a missing-tax-number flag', async () => {
    mockApi({
      ...asAdmin,
      'GET /api/v1/admin/kyc': { json: { items: [{ id: 's1', storeName: 'Ali Traders', status: 'submitted', submittedAt: '2026-11-01T10:00:00.000Z', flags: ['ntn_missing'] }], nextCursor: null } },
    })
    renderApp('/admin/kyc')
    const link = await screen.findByRole('link', { name: 'Ali Traders' })
    expect(link).toHaveAttribute('href', '/admin/kyc/s1')
    expect(screen.getByText('No tax number')).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    mockApi({ ...asAdmin, 'GET /api/v1/admin/kyc': { json: { items: [], nextCursor: null } } })
    renderApp('/admin/kyc')
    expect(await screen.findByText('Nothing to review')).toBeInTheDocument()
  })
})

describe('admin KYC review', () => {
  it('shows details and documents that open in a new tab', async () => {
    mockApi({ ...asAdmin, 'GET /api/v1/admin/kyc/s1': { json: { kyc: detail() } } })
    renderApp('/admin/kyc/s1')
    expect(await screen.findByText('4210112345671')).toBeInTheDocument()
    const view = screen.getByRole('link', { name: /View file/ })
    expect(view).toHaveAttribute('href', '/api/v1/admin/kyc/s1/documents/d1')
    expect(view).toHaveAttribute('target', '_blank')
    expect(view).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('starts the review of a submitted application', async () => {
    let status = 'submitted'
    const { calls } = mockApi({
      ...asAdmin,
      'GET /api/v1/admin/kyc/s1': () => ({ json: { kyc: detail({ status }) } }),
      'POST /api/v1/admin/kyc/s1/decision': () => { status = 'under_review'; return { json: { kyc: { id: 's1', status } } } },
    })
    renderApp('/admin/kyc/s1')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Start review' }))
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/admin/kyc/s1/decision').body).toEqual({ decision: 'start_review' })
  })

  it('will not reject without a note, then sends the note', async () => {
    const { calls } = mockApi({
      ...asAdmin,
      'GET /api/v1/admin/kyc/s1': { json: { kyc: detail({ status: 'under_review' }) } },
      'POST /api/v1/admin/kyc/s1/decision': { json: { kyc: { id: 's1', status: 'rejected' } } },
    })
    renderApp('/admin/kyc/s1')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Reject' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a note')
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)

    await user.type(screen.getByLabelText(/Note to the seller/), 'Documents are unreadable')
    await user.click(screen.getByRole('button', { name: 'Reject' }))
    expect(await screen.findByText('Decision saved.')).toBeInTheDocument()
    expect(calls.find((c) => c.key.startsWith('POST')).body).toEqual({ decision: 'reject', note: 'Documents are unreadable' })
  })

  it('shows the server error when a decision is refused', async () => {
    mockApi({
      ...asAdmin,
      'GET /api/v1/admin/kyc/s1': { json: { kyc: detail({ status: 'under_review' }) } },
      'POST /api/v1/admin/kyc/s1/decision': apiError(409, 'KYC_INVALID_TRANSITION', 'Cannot move KYC from approved to approved.'),
    })
    renderApp('/admin/kyc/s1')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Approve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot move KYC')
  })

  it('offers no decision buttons on a finished application', async () => {
    mockApi({ ...asAdmin, 'GET /api/v1/admin/kyc/s1': { json: { kyc: detail({ status: 'approved' }) } } })
    renderApp('/admin/kyc/s1')
    await screen.findByText('4210112345671')
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start review' })).not.toBeInTheDocument()
  })
})

describe('console links', () => {
  it('shows an Admin console link in the storefront header for admins only', async () => {
    mockApi({ ...asAdmin })
    renderApp('/account')
    expect(await screen.findByRole('link', { name: 'Admin console' })).toHaveAttribute('href', '/admin/kyc')
  })

  it('does not show it to customers', async () => {
    mockApi({ 'GET /api/v1/me': { json: { account: ACCOUNT } } })
    renderApp('/account')
    await screen.findByRole('heading', { name: 'My account' })
    expect(screen.queryByRole('link', { name: 'Admin console' })).not.toBeInTheDocument()
  })
})
