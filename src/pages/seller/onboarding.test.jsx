import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT, apiError, mockApi, renderApp } from '../../test/utils.jsx'

afterEach(() => vi.unstubAllGlobals())

const SELLER = { id: 's1', storeName: 'Ali Traders', slug: 'ali-traders', description: null, status: 'pending', kycStatus: 'not_submitted', createdAt: '2026-11-01T00:00:00.000Z' }
const REQUIRED = ['cnic_front', 'cnic_back', 'business_registration', 'business_photo']
const kyc = (over = {}) => ({ status: 'not_submitted', note: null, documents: [], pii: null, requiredDocuments: REQUIRED, ...over })
const signedIn = { 'GET /api/v1/me': { json: { account: ACCOUNT } } }

describe('seller onboarding', () => {
  it('asks signed-out visitors to sign in first', async () => {
    mockApi({ 'GET /api/v1/me': apiError(401, 'UNAUTHENTICATED', 'Authentication required.') })
    renderApp('/seller/onboarding')
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })

  it('creates a store when the user has none', async () => {
    let created = false
    const { calls } = mockApi({
      ...signedIn,
      'GET /api/v1/seller/profile': () => (created ? { json: { seller: SELLER } } : apiError(404, 'SELLER_NOT_FOUND', 'You do not have a store yet.')),
      'POST /api/v1/seller/profile': () => { created = true; return { status: 201, json: { seller: SELLER } } },
      'GET /api/v1/seller/kyc': { json: { kyc: kyc() } },
    })
    renderApp('/seller/onboarding')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Store name/), '  Ali Traders ')
    await user.click(screen.getByRole('button', { name: 'Create store' }))
    expect(await screen.findByRole('heading', { name: 'Documents' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/seller/profile').body).toEqual({ storeName: 'Ali Traders' })
  })

  it('shows the server message when the store name is taken', async () => {
    mockApi({
      ...signedIn,
      'GET /api/v1/seller/profile': apiError(404, 'SELLER_NOT_FOUND', 'x'),
      'POST /api/v1/seller/profile': apiError(409, 'STORE_NAME_TAKEN', 'This store name is already taken.'),
    })
    renderApp('/seller/onboarding')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Store name/), 'Ali Traders')
    await user.click(screen.getByRole('button', { name: 'Create store' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This store name is already taken.')
  })

  it('uploads a document with its kind before the file', async () => {
    let docs = []
    const { calls } = mockApi({
      ...signedIn,
      'GET /api/v1/seller/profile': { json: { seller: SELLER } },
      'GET /api/v1/seller/kyc': () => ({ json: { kyc: kyc({ documents: docs }) } }),
      'POST /api/v1/seller/kyc/documents': () => { docs = [{ id: 'd1', kind: 'cnic_front', mime: 'image/png', sizeBytes: 2048 }]; return { status: 201, json: { document: docs[0] } } },
    })
    renderApp('/seller/onboarding')
    const user = userEvent.setup()
    const file = new File(['x'], 'front.png', { type: 'image/png' })
    await user.upload(await screen.findByLabelText('Upload cnic (front)'), file)
    await screen.findByText(/Uploaded \(2 KB\)/)
    const form = calls.find((c) => c.key === 'POST /api/v1/seller/kyc/documents').form
    expect([...form.keys()]).toEqual(['kind', 'file'])
    expect(form.get('kind')).toBe('cnic_front')
    expect(screen.getByRole('button', { name: 'Remove CNIC (front)' })).toBeInTheDocument()
  })

  it('tells the seller what is still missing when submit is rejected', async () => {
    mockApi({
      ...signedIn,
      'GET /api/v1/seller/profile': { json: { seller: SELLER } },
      'GET /api/v1/seller/kyc': { json: { kyc: kyc() } },
      'POST /api/v1/seller/kyc/submit': apiError(400, 'KYC_INCOMPLETE', 'Some required documents or details are missing.', [{ path: 'cnic_back', message: 'Required.' }, { path: 'pii', message: 'Required.' }]),
    })
    renderApp('/seller/onboarding')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Submit application' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Still needed: CNIC (back), business details.')
  })

  it('saves business details and never echoes the full CNIC', async () => {
    let pii = null
    const { calls } = mockApi({
      ...signedIn,
      'GET /api/v1/seller/profile': { json: { seller: SELLER } },
      'GET /api/v1/seller/kyc': () => ({ json: { kyc: kyc({ pii }) } }),
      'PUT /api/v1/seller/kyc/pii': () => { pii = { cnicLast4: '5671', hasAddress: true, hasNtn: false }; return { json: { kyc: kyc({ pii }) } } },
    })
    renderApp('/seller/onboarding')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/CNIC number/), '42101-1234567-1')
    await user.type(screen.getByLabelText(/Business address/), 'Shop 4, Main Market, Karachi')
    await user.click(screen.getByRole('button', { name: 'Save details' }))
    expect(await screen.findByText('Details saved.')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'PUT /api/v1/seller/kyc/pii').body).toEqual({ cnic: '42101-1234567-1', address: 'Shop 4, Main Market, Karachi' })
    expect(await screen.findByText(/CNIC ending 5671/)).toBeInTheDocument()
    expect(screen.queryByDisplayValue('42101-1234567-1')).not.toBeInTheDocument()
  })

  it('locks editing while under review', async () => {
    mockApi({
      ...signedIn,
      'GET /api/v1/seller/profile': { json: { seller: { ...SELLER, kycStatus: 'under_review' } } },
      'GET /api/v1/seller/kyc': { json: { kyc: kyc({ status: 'under_review', documents: [{ id: 'd1', kind: 'cnic_front', mime: 'image/png', sizeBytes: 1000 }] }) } },
    })
    renderApp('/seller/onboarding')
    expect(await screen.findByText('Your application is being reviewed.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit application' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('shows the reviewer note and allows edits when more information is needed', async () => {
    mockApi({
      ...signedIn,
      'GET /api/v1/seller/profile': { json: { seller: SELLER } },
      'GET /api/v1/seller/kyc': { json: { kyc: kyc({ status: 'more_info_required', note: 'CNIC back is blurry' }) } },
    })
    renderApp('/seller/onboarding')
    expect(await screen.findByText(/CNIC back is blurry/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit application' })).toBeInTheDocument()
  })

  it('after approval refreshes the account and links to the seller center', async () => {
    let me = 0
    mockApi({
      'GET /api/v1/me': () => ({ json: { account: me++ === 0 ? ACCOUNT : { ...ACCOUNT, permissions: ['seller:access'] } } }),
      'GET /api/v1/seller/profile': { json: { seller: { ...SELLER, status: 'active', kycStatus: 'approved' } } },
      'GET /api/v1/seller/kyc': { json: { kyc: kyc({ status: 'approved' }) } },
    })
    renderApp('/seller/onboarding')
    const link = await screen.findByRole('link', { name: 'Open seller center' })
    expect(link).toHaveAttribute('href', '/seller')
    await waitFor(() => expect(me).toBeGreaterThan(1))
  })
})
