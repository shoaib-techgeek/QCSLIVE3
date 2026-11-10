import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT, EMPTY_CART, apiError, mockApi, renderApp } from '../test/utils.jsx'

afterEach(() => vi.unstubAllGlobals())

const signedIn = { 'GET /api/v1/me': { json: { account: ACCOUNT } } }
const anonymous = { 'GET /api/v1/me': apiError(401, 'UNAUTHENTICATED', 'Authentication required.') }

const item = (id, title, over = {}) => ({
  id, selected: true, qty: 2, priceMinor: 50000, compareAtMinor: null, currency: 'PKR', lineTotalMinor: 100000, available: 5,
  product: { title, slug: `${id}-slug`, imageUrl: null }, sku: { id: `sku-${id}`, options: {} }, changes: [], ...over,
})
const cartOf = (groups, summary) => ({
  groups, summary: summary ?? { itemCount: 2, subtotalMinor: 100000, currency: 'PKR' },
  changes: groups.flatMap((g) => g.items.flatMap((i) => i.changes.map((c) => ({ itemId: i.id, ...c })))),
})
const oneItem = (over) => cartOf([{ storeName: 'Ali Traders', subtotalMinor: 100000, items: [item('i1', 'Cotton shirt', over)] }])

describe('cart page', () => {
  it('sends signed-out visitors to sign in', async () => {
    mockApi(anonymous)
    renderApp('/cart')
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })

  it('shows an empty state', async () => {
    mockApi(signedIn)
    renderApp('/cart')
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
  })

  it('groups items by store and shows line prices and the summary from the server', async () => {
    const cart = cartOf([
      { storeName: 'Ali Traders', subtotalMinor: 100000, items: [item('i1', 'Cotton shirt', { sku: { id: 's1', options: { Size: 'M' } } })] },
      { storeName: 'Sara Shop', subtotalMinor: 90000, items: [item('i2', 'Desk lamp', { qty: 1, priceMinor: 90000, lineTotalMinor: 90000 })] },
    ], { itemCount: 3, subtotalMinor: 190000, currency: 'PKR' })
    mockApi({ ...signedIn, 'GET /api/v1/cart': { json: cart } })
    renderApp('/cart')
    const ali = within(await screen.findByRole('region', { name: 'Items from Ali Traders' }))
    expect(ali.getByRole('link', { name: 'Cotton shirt' })).toHaveAttribute('href', '/p/i1-slug')
    expect(ali.getByText('M')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Items from Sara Shop' })).getByText('Desk lamp')).toBeInTheDocument()
    const summary = within(screen.getByRole('complementary', { name: 'Order summary' }))
    expect(summary.getByText('3')).toBeInTheDocument()
    expect(summary.getByText(/1,900/)).toBeInTheDocument()
  })

  it('changes the quantity and the selection through the API', async () => {
    let cart = oneItem()
    const { calls } = mockApi({
      ...signedIn,
      'GET /api/v1/cart': () => ({ json: cart }),
      'PATCH /api/v1/cart/items/i1': ({ body }) => { cart = oneItem({ ...(body.qty ? { qty: body.qty, lineTotalMinor: 50000 * body.qty } : {}), ...(body.selected !== undefined ? { selected: body.selected } : {}) }); return { json: cart } },
    })
    renderApp('/cart')
    const user = userEvent.setup()
    await user.selectOptions(await screen.findByLabelText('Quantity of Cotton shirt'), '4')
    await user.click(screen.getByLabelText('Select Cotton shirt'))
    expect(calls.filter((c) => c.key === 'PATCH /api/v1/cart/items/i1').map((c) => c.body)).toEqual([{ qty: 4 }, { selected: false }])
    expect(await screen.findByLabelText('Select Cotton shirt')).not.toBeChecked()
  })

  it('removes an item and shows the empty cart', async () => {
    let cart = oneItem()
    mockApi({ ...signedIn, 'GET /api/v1/cart': () => ({ json: cart }), 'DELETE /api/v1/cart/items/i1': () => { cart = EMPTY_CART; return { status: 204 } } })
    renderApp('/cart')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Remove Cotton shirt' }))
    expect(await screen.findByText('Your cart is empty')).toBeInTheDocument()
  })

  it('explains a price change and lets the buyer accept it', async () => {
    let cart = oneItem({ priceMinor: 60000, lineTotalMinor: 120000, changes: [{ code: 'PRICE_CHANGED', oldMinor: 50000, newMinor: 60000 }] })
    const { calls } = mockApi({
      ...signedIn, 'GET /api/v1/cart': () => ({ json: cart }),
      'PATCH /api/v1/cart/items/i1': () => { cart = oneItem({ priceMinor: 60000, lineTotalMinor: 120000 }); return { json: cart } },
    })
    renderApp('/cart')
    expect(await screen.findByText(/The price changed from .*500 to .*600/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'OK, keep this item' }))
    expect(calls.find((c) => c.key.startsWith('PATCH')).body).toEqual({ acceptPrice: true })
    expect(screen.queryByText(/The price changed/)).not.toBeInTheDocument()
  })

  it('explains items that can no longer be bought', async () => {
    const cart = cartOf([{ storeName: 'Ali Traders', subtotalMinor: 0, items: [
      item('i1', 'Gone item', { available: null, changes: [{ code: 'UNAVAILABLE' }] }),
      item('i2', 'Sold out item', { available: 0, changes: [{ code: 'OUT_OF_STOCK' }] }),
      item('i3', 'Low stock item', { qty: 4, available: 1, changes: [{ code: 'QTY_EXCEEDS_STOCK', available: 1 }] }),
    ] }], { itemCount: 0, subtotalMinor: 0, currency: 'PKR' })
    mockApi({ ...signedIn, 'GET /api/v1/cart': { json: cart } })
    renderApp('/cart')
    expect(await screen.findByText('This item is no longer available. Remove it to continue.')).toBeInTheDocument()
    expect(screen.getByText('Sold out.')).toBeInTheDocument()
    expect(screen.getByText('Only 1 left. Lower the quantity to continue.')).toBeInTheDocument()
    expect(screen.getByLabelText('Select Gone item')).toBeDisabled()
    expect(screen.getByLabelText('Quantity of Sold out item')).toBeDisabled()
  })

  it('shows the server message when a change is refused', async () => {
    mockApi({ ...signedIn, 'GET /api/v1/cart': { json: oneItem() }, 'PATCH /api/v1/cart/items/i1': apiError(409, 'OUT_OF_STOCK', 'Only 2 left.') })
    renderApp('/cart')
    await userEvent.setup().selectOptions(await screen.findByLabelText('Quantity of Cotton shirt'), '5')
    expect(await screen.findByRole('alert')).toHaveTextContent('Only 2 left.')
  })

  it('shows the cart count in the header and links to the cart', async () => {
    mockApi({ ...signedIn, 'GET /api/v1/cart': { json: oneItem() }, 'GET /api/v1/products?sort=newest&limit=5': { json: { items: [], nextCursor: null } }, 'GET /api/v1/products?limit=20': { json: { items: [], nextCursor: null } } })
    renderApp('/')
    const link = await screen.findByRole('link', { name: 'Cart, 2 items' })
    expect(link).toHaveAttribute('href', '/cart')
  })
})

describe('adding to the cart from the product page', () => {
  const PRODUCT = {
    id: 'p1', title: 'Cotton T-shirt', slug: 'tee', description: null, category: { slug: 'men', name: 'Men' }, store: { name: 'Ali Traders' },
    options: [{ name: 'Size', values: ['S', 'M'] }],
    skus: [
      { id: 'sku-s', options: { Size: 'S' }, priceMinor: 99900, compareAtMinor: null, currency: 'PKR', inStock: true },
      { id: 'sku-m', options: { Size: 'M' }, priceMinor: 99900, compareAtMinor: null, currency: 'PKR', inStock: false },
    ],
    images: [],
  }
  const product = { 'GET /api/v1/products/tee': { json: { product: PRODUCT } } }

  it('adds the chosen variant and quantity, then links to the cart', async () => {
    const { calls } = mockApi({ ...signedIn, ...product, 'POST /api/v1/cart/items': { status: 201, json: oneItem() } })
    renderApp('/p/tee')
    const user = userEvent.setup()
    expect(await screen.findByRole('button', { name: 'Add to cart' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'S' }))
    await user.selectOptions(screen.getByLabelText('Quantity'), '3')
    await user.click(screen.getByRole('button', { name: 'Add to cart' }))
    expect(await screen.findByText(/Added to your cart/)).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/cart/items').body).toEqual({ skuId: 'sku-s', qty: 3 })
    expect(screen.getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart')
  })

  it('does not allow adding a sold-out variant', async () => {
    mockApi({ ...signedIn, ...product })
    renderApp('/p/tee')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'M' }))
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled()
  })

  it('shows the server message when adding fails', async () => {
    mockApi({ ...signedIn, ...product, 'POST /api/v1/cart/items': apiError(409, 'QTY_LIMIT', 'You can buy at most 10 of this item at a time.') })
    renderApp('/p/tee')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'S' }))
    await user.click(screen.getByRole('button', { name: 'Add to cart' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('at most 10')
  })

  it('sends signed-out shoppers to sign in instead of adding', async () => {
    const { calls } = mockApi({ ...anonymous, ...product })
    renderApp('/p/tee')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'S' }))
    await user.click(screen.getByRole('button', { name: 'Add to cart' }))
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)
  })
})
