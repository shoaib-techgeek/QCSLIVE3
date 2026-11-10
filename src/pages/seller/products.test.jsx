import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT, apiError, mockApi, renderApp } from '../../test/utils.jsx'

afterEach(() => vi.unstubAllGlobals())

const SELLER = { ...ACCOUNT, permissions: ['seller:access'] }
const asSeller = { 'GET /api/v1/me': { json: { account: SELLER } } }
const sku = (id, size, price, over = {}) => ({ id, sellerSku: `TEE-${size}`, options: { Size: size }, priceMinor: price, compareAtMinor: null, currency: 'PKR', active: true, stock: { onHand: 5, reserved: 1, available: 4 }, ...over })
const product = (over = {}) => ({
  id: 'p1', title: 'Cotton T-shirt', slug: 'cotton-t-shirt-ab12', description: 'Soft.', status: 'draft', rejectionReason: null, category: { slug: 'men', name: 'Men' },
  options: [{ name: 'Size', values: ['S', 'M'] }], skus: [sku('s1', 'S', 99900), sku('s2', 'M', 109900)], images: [], ...over,
})

describe('seller product list', () => {
  it('lists products with status and price, and links to each one', async () => {
    mockApi({ ...asSeller, 'GET /api/v1/seller/products': { json: { items: [
      { id: 'p1', title: 'Cotton T-shirt', slug: 'x', status: 'draft', priceFromMinor: 99900, currency: 'PKR', imageUrl: null },
      { id: 'p2', title: 'Phone stand', slug: 'y', status: 'rejected', priceFromMinor: 49900, currency: 'PKR', imageUrl: null },
    ], nextCursor: null } } })
    renderApp('/seller/products')
    expect(await screen.findByRole('link', { name: 'Cotton T-shirt' })).toHaveAttribute('href', '/seller/products/p1')
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Needs changes')).toBeInTheDocument()
    expect(screen.getByText(/999/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add product' })).toHaveAttribute('href', '/seller/products/new')
  })

  it('invites the seller to add a first product', async () => {
    mockApi({ ...asSeller, 'GET /api/v1/seller/products': { json: { items: [], nextCursor: null } } })
    renderApp('/seller/products')
    expect(await screen.findByText('No products yet')).toBeInTheDocument()
  })

  it('keeps customers out of the seller center', async () => {
    mockApi({ 'GET /api/v1/me': { json: { account: ACCOUNT } } })
    renderApp('/seller/products')
    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument()
  })
})

describe('add product', () => {
  async function fillBasics(user) {
    await user.type(await screen.findByLabelText(/Product name/), 'Cotton T-shirt')
    await user.selectOptions(screen.getByLabelText(/Category/), 'men')
  }

  it('builds one price row per variant from the options', async () => {
    mockApi(asSeller)
    renderApp('/seller/products/new')
    const user = userEvent.setup()
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: 'Add option' }))
    await user.type(screen.getByLabelText('Option 1 name'), 'Color')
    await user.type(screen.getByLabelText('Option 1 values'), 'Red, Blue')
    await user.click(screen.getByRole('button', { name: 'Add option' }))
    await user.type(screen.getByLabelText('Option 2 name'), 'Size')
    await user.type(screen.getByLabelText('Option 2 values'), 'S, M, L')
    expect(screen.getAllByLabelText(/^Price for /)).toHaveLength(6)
    expect(screen.getByLabelText('Price for Red / S')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove option 2' }))
    expect(screen.getAllByLabelText(/^Price for /)).toHaveLength(2)
  })

  it('checks the form before sending anything', async () => {
    const { calls } = mockApi(asSeller)
    renderApp('/seller/products/new')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Save as draft' }))
    expect(await screen.findByText('Enter a product name.')).toBeInTheDocument()
    expect(screen.getByText('Choose a category.')).toBeInTheDocument()
    expect(screen.getByText('Enter a SKU code.')).toBeInTheDocument()
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)
  })

  it('rejects an original price that is not higher than the price', async () => {
    const { calls } = mockApi(asSeller)
    renderApp('/seller/products/new')
    const user = userEvent.setup()
    await fillBasics(user)
    await user.type(screen.getByLabelText('SKU code for Default'), 'TEE-1')
    await user.type(screen.getByLabelText('Price for Default'), '1000')
    await user.type(screen.getByLabelText('Original price for Default'), '900')
    await user.click(screen.getByRole('button', { name: 'Save as draft' }))
    expect(await screen.findByText('The original price must be higher than the price.')).toBeInTheDocument()
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)
  })

  it('sends prices as integer minor units and opens the new product', async () => {
    const { calls } = mockApi({
      ...asSeller,
      'POST /api/v1/seller/products': { status: 201, json: { product: product() } },
      'GET /api/v1/seller/products/p1': { json: { product: product() } },
    })
    renderApp('/seller/products/new')
    const user = userEvent.setup()
    await fillBasics(user)
    await user.click(screen.getByRole('button', { name: 'Add option' }))
    await user.type(screen.getByLabelText('Option 1 name'), 'Size')
    await user.type(screen.getByLabelText('Option 1 values'), 'S, M')
    await user.type(screen.getByLabelText('SKU code for S'), 'TEE-S')
    await user.type(screen.getByLabelText('Price for S'), '1,299.50')
    await user.type(screen.getByLabelText('Original price for S'), '1500')
    await user.type(screen.getByLabelText('SKU code for M'), 'TEE-M')
    await user.type(screen.getByLabelText('Price for M'), '1400')
    await user.click(screen.getByRole('button', { name: 'Save as draft' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Cotton T-shirt' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/seller/products').body).toEqual({
      title: 'Cotton T-shirt', categorySlug: 'men', options: [{ name: 'Size', values: ['S', 'M'] }],
      skus: [{ sellerSku: 'TEE-S', options: { Size: 'S' }, priceMinor: 129950, compareAtMinor: 150000 }, { sellerSku: 'TEE-M', options: { Size: 'M' }, priceMinor: 140000 }],
    })
  })

  it('shows the server message when saving fails', async () => {
    mockApi({ ...asSeller, 'POST /api/v1/seller/products': apiError(409, 'SKU_CODE_TAKEN', 'One of your SKU codes is already used by another product.') })
    renderApp('/seller/products/new')
    const user = userEvent.setup()
    await fillBasics(user)
    await user.type(screen.getByLabelText('SKU code for Default'), 'TEE-1')
    await user.type(screen.getByLabelText('Price for Default'), '1000')
    await user.click(screen.getByRole('button', { name: 'Save as draft' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already used by another product')
  })
})

describe('edit product', () => {
  const getP = (p) => ({ 'GET /api/v1/seller/products/p1': { json: { product: p } } })

  it('shows what to fix on a rejected product and lets the seller send it again', async () => {
    let status = 'rejected'
    mockApi({
      ...asSeller,
      'GET /api/v1/seller/products/p1': () => ({ json: { product: product({ status, rejectionReason: 'Photos are blurry' }) } }),
      'POST /api/v1/seller/products/p1/submit': () => { status = 'pending'; return { json: { product: product({ status }) } } },
    })
    renderApp('/seller/products/p1')
    expect(await screen.findByText(/Photos are blurry/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Send for review' }))
    expect(await screen.findByText(/being reviewed/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send for review' })).not.toBeInTheDocument()
  })

  it('shows the server reason when an unapproved seller tries to publish', async () => {
    mockApi({ ...asSeller, ...getP(product()), 'POST /api/v1/seller/products/p1/submit': apiError(403, 'SELLER_NOT_APPROVED', 'Your seller verification must be approved before you can publish products.') })
    renderApp('/seller/products/p1')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Send for review' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('must be approved')
  })

  it('saves a changed price and stock, and nothing for untouched rows', async () => {
    const { calls } = mockApi({
      ...asSeller, ...getP(product()),
      'PATCH /api/v1/seller/products/p1': { json: { product: product() } },
      'PUT /api/v1/seller/skus/s2/stock': { json: { stock: { onHand: 20, reserved: 1, available: 19 } } },
    })
    renderApp('/seller/products/p1')
    const user = userEvent.setup()
    const price = await screen.findByLabelText('Price for S')
    expect(price).toHaveValue('999')
    await user.clear(price)
    await user.type(price, '899.50')
    const stock = screen.getByLabelText('Stock for M')
    await user.clear(stock)
    await user.type(stock, '20')
    await user.click(screen.getByRole('button', { name: 'Save prices and stock' }))
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'PATCH /api/v1/seller/products/p1').body).toEqual({ skus: [{ id: 's1', priceMinor: 89950, compareAtMinor: null }] })
    expect(calls.find((c) => c.key === 'PUT /api/v1/seller/skus/s2/stock').body).toEqual({ onHand: 20 })
    expect(calls.filter((c) => c.key.startsWith('PUT')).length).toBe(1)
  })

  it('refuses a bad price or stock locally', async () => {
    const { calls } = mockApi({ ...asSeller, ...getP(product()) })
    renderApp('/seller/products/p1')
    const user = userEvent.setup()
    const price = await screen.findByLabelText('Price for S')
    await user.clear(price)
    await user.type(price, 'abc')
    await user.click(screen.getByRole('button', { name: 'Save prices and stock' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a price above zero for S.')
    expect(calls.some((c) => c.key.startsWith('PATCH') || c.key.startsWith('PUT'))).toBe(false)
  })

  it('locks details and photos while in review, but shows prices read-only', async () => {
    mockApi({ ...asSeller, ...getP(product({ status: 'pending' })) })
    renderApp('/seller/products/p1')
    expect(await screen.findByLabelText('Product name')).toBeDisabled()
    expect(screen.queryByLabelText('Add a photo')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Price for S')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Delete product' })).not.toBeInTheDocument()
  })

  it('uploads a photo and removes one', async () => {
    let images = []
    const { calls } = mockApi({
      ...asSeller,
      'GET /api/v1/seller/products/p1': () => ({ json: { product: product({ images }) } }),
      'POST /api/v1/seller/products/p1/images': () => { images = [{ id: 'i1', url: '/api/v1/media/products/i1', altText: null, position: 0 }]; return { status: 201, json: { image: images[0] } } },
      'DELETE /api/v1/seller/products/p1/images/i1': () => { images = []; return { status: 204 } },
    })
    renderApp('/seller/products/p1')
    const user = userEvent.setup()
    await user.upload(await screen.findByLabelText('Add a photo'), new File(['x'], 'front.png', { type: 'image/png' }))
    expect(await screen.findByRole('img', { name: /photo 1/ })).toHaveAttribute('src', '/api/v1/media/products/i1')
    expect([...calls.find((c) => c.key.startsWith('POST')).form.keys()]).toEqual(['file'])
    await user.click(screen.getByRole('button', { name: 'Remove photo 1' }))
    await screen.findByLabelText('Add a photo')
    expect(screen.queryByRole('img', { name: /photo 1/ })).not.toBeInTheDocument()
  })

  it('hides and shows a live product', async () => {
    let status = 'active'
    mockApi({
      ...asSeller,
      'GET /api/v1/seller/products/p1': () => ({ json: { product: product({ status }) } }),
      'POST /api/v1/seller/products/p1/deactivate': () => { status = 'inactive'; return { json: { product: product({ status }) } } },
      'POST /api/v1/seller/products/p1/activate': () => { status = 'active'; return { json: { product: product({ status }) } } },
    })
    renderApp('/seller/products/p1')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Hide from store' }))
    expect(await screen.findByText('Hidden. Shoppers can no longer see this product.')).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Show in store' }))
    expect(await screen.findByText('Live again. Shoppers can see this product.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Hide from store' })).toBeInTheDocument()
  })

  it('asks twice before deleting a draft, then returns to the list', async () => {
    const { calls } = mockApi({
      ...asSeller, ...getP(product()),
      'DELETE /api/v1/seller/products/p1': { status: 204 },
      'GET /api/v1/seller/products': { json: { items: [], nextCursor: null } },
    })
    renderApp('/seller/products/p1')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Delete product' }))
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Yes, delete this product' }))
    expect(await screen.findByText('No products yet')).toBeInTheDocument()
  })

  it('says so when the product is not yours or does not exist', async () => {
    mockApi({ ...asSeller, 'GET /api/v1/seller/products/p1': apiError(404, 'NOT_FOUND', 'Resource not found.') })
    renderApp('/seller/products/p1')
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not find this product.')
  })
})
