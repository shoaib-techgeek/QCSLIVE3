import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT, apiError, mockApi, renderApp } from '../../test/utils.jsx'

afterEach(() => vi.unstubAllGlobals())

const ADMIN = { ...ACCOUNT, permissions: ['admin:access', 'product:moderate'] }
const asAdmin = { 'GET /api/v1/me': { json: { account: ADMIN } } }
const detail = (over = {}) => ({
  id: 'p1', title: 'Cotton T-shirt', slug: 'x', description: 'Soft cotton.', status: 'pending', rejectionReason: null, category: { slug: 'men', name: 'Men' },
  store: { name: 'Ali Traders' }, options: [], images: [{ id: 'i1', url: '/api/v1/media/products/i1', altText: null, position: 0 }],
  skus: [{ id: 's1', sellerSku: 'TEE-1', options: {}, priceMinor: 99900, compareAtMinor: 129900, currency: 'PKR', active: true, stock: { onHand: 5, reserved: 0, available: 5 } }],
  history: [{ from: 'draft', to: 'pending', note: null, at: '2026-11-09T10:00:00.000Z' }], ...over,
})

describe('admin product queue', () => {
  it('lists pending products with store and price, linking to the review page', async () => {
    mockApi({ ...asAdmin, 'GET /api/v1/admin/products?status=pending': { json: { items: [{ id: 'p1', title: 'Cotton T-shirt', status: 'pending', storeName: 'Ali Traders', submittedAt: '2026-11-09T10:00:00.000Z', priceFromMinor: 99900, currency: 'PKR', imageCount: 2 }], nextCursor: null } } })
    renderApp('/admin/products')
    expect(await screen.findByRole('link', { name: 'Cotton T-shirt' })).toHaveAttribute('href', '/admin/products/p1')
    expect(screen.getByText('Ali Traders')).toBeInTheDocument()
  })

  it('shows an empty state, and blocks admins without the moderation permission', async () => {
    mockApi({ ...asAdmin, 'GET /api/v1/admin/products?status=pending': { json: { items: [], nextCursor: null } } })
    renderApp('/admin/products')
    expect(await screen.findByText('Nothing to review')).toBeInTheDocument()
    vi.unstubAllGlobals()
    mockApi({ 'GET /api/v1/me': { json: { account: { ...ACCOUNT, permissions: ['admin:access'] } } } })
    renderApp('/admin/products')
    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument()
  })
})

describe('admin product review', () => {
  const route = (p) => ({ ...asAdmin, 'GET /api/v1/admin/products/p1': { json: { product: p } } })

  it('shows the listing, photos and variants', async () => {
    mockApi(route(detail()))
    renderApp('/admin/products/p1')
    expect(await screen.findByRole('heading', { level: 1, name: 'Cotton T-shirt' })).toBeInTheDocument()
    expect(screen.getByText(/Store: Ali Traders/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /photo 1/ })).toHaveAttribute('src', '/api/v1/media/products/i1')
    expect(screen.getByText('TEE-1')).toBeInTheDocument()
  })

  it('approves without a reason', async () => {
    let status = 'pending'
    const { calls } = mockApi({
      ...asAdmin,
      'GET /api/v1/admin/products/p1': () => ({ json: { product: detail({ status }) } }),
      'POST /api/v1/admin/products/p1/moderate': () => { status = 'active'; return { json: { product: detail({ status }) } } },
    })
    renderApp('/admin/products/p1')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Approve' }))
    expect(await screen.findByText('Decision saved.')).toBeInTheDocument()
    expect(calls.find((c) => c.key.startsWith('POST')).body).toEqual({ decision: 'approve' })
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('will not ask for changes without a reason, then sends it', async () => {
    const { calls } = mockApi({ ...route(detail()), 'POST /api/v1/admin/products/p1/moderate': { json: { product: detail({ status: 'rejected' }) } } })
    renderApp('/admin/products/p1')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Ask for changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a reason')
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)
    await user.type(screen.getByLabelText(/Reason for the seller/), 'Photos are blurry')
    await user.click(screen.getByRole('button', { name: 'Ask for changes' }))
    expect(await screen.findByText('Decision saved.')).toBeInTheDocument()
    expect(calls.find((c) => c.key.startsWith('POST')).body).toEqual({ decision: 'reject', reason: 'Photos are blurry' })
  })

  it('shows the server error when a decision is refused', async () => {
    mockApi({ ...route(detail()), 'POST /api/v1/admin/products/p1/moderate': apiError(409, 'PRODUCT_INVALID_TRANSITION', 'A admin cannot move a product from active to active.') })
    renderApp('/admin/products/p1')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Approve' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('cannot move a product')
  })

  it('offers hide and remove on a live product', async () => {
    mockApi(route(detail({ status: 'active' })))
    renderApp('/admin/products/p1')
    expect(await screen.findByRole('button', { name: 'Hide from store' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove product' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })

  it('offers no decisions on a product that was already removed', async () => {
    mockApi(route(detail({ status: 'banned' })))
    renderApp('/admin/products/p1')
    await screen.findByRole('heading', { level: 1, name: 'Cotton T-shirt' })
    expect(screen.queryByRole('button', { name: 'Remove product' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })
})
