import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiError, mockApi, renderApp } from '../test/utils.jsx'

afterEach(() => vi.unstubAllGlobals())

const anonymous = { 'GET /api/v1/me': apiError(401, 'UNAUTHENTICATED', 'Authentication required.') }
const item = (n, over = {}) => ({
  id: `id-${n}`, title: `Product ${n}`, slug: `product-${n}`, priceMinor: 50000, compareAtMinor: null, currency: 'PKR', imageUrl: null,
  category: { slug: 'men', name: 'Men' }, storeName: 'Ali Traders', inStock: true, ...over,
})

describe('search page', () => {
  it('searches from the header and shows the results', async () => {
    mockApi({ ...anonymous, 'GET /api/v1/products?limit=20': { json: { items: [], nextCursor: null } }, 'GET /api/v1/products?sort=newest&limit=5': { json: { items: [], nextCursor: null } },
      'GET /api/v1/products?q=bottle': { json: { items: [item(1, { title: 'Steel bottle' })], nextCursor: null } } })
    renderApp('/')
    const user = userEvent.setup()
    await user.type(await screen.findByRole('searchbox', { name: 'Search products' }), 'bottle{enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Results for “bottle”' })).toBeInTheDocument()
    expect(await screen.findByText('Steel bottle')).toBeInTheDocument()
  })

  it('names the category and passes it to the API', async () => {
    const { calls } = mockApi({ ...anonymous, 'GET /api/v1/products?category=sports': { json: { items: [item(1)], nextCursor: null } } })
    renderApp('/search?category=sports')
    expect(await screen.findByRole('heading', { level: 1, name: 'Sports and outdoors' })).toBeInTheDocument()
    await screen.findByText('Product 1')
    expect(calls.some((c) => c.key === 'GET /api/v1/products?category=sports')).toBe(true)
  })

  it('re-queries when the sort changes', async () => {
    const { calls } = mockApi({ ...anonymous, 'GET /api/v1/products': { json: { items: [item(1)], nextCursor: null } }, 'GET /api/v1/products?sort=price_asc': { json: { items: [item(2)], nextCursor: null } } })
    renderApp('/search')
    const user = userEvent.setup()
    await screen.findByText('Product 1')
    await user.selectOptions(screen.getByLabelText('Sort by'), 'price_asc')
    expect(await screen.findByText('Product 2')).toBeInTheDocument()
    expect(calls.map((c) => c.key)).toContain('GET /api/v1/products?sort=price_asc')
  })

  it('turns typed rupee prices into minor units for the API', async () => {
    const { calls } = mockApi({ ...anonymous, 'GET /api/v1/products': { json: { items: [item(1)], nextCursor: null } }, 'GET /api/v1/products?minPrice=100000&maxPrice=250050': { json: { items: [], nextCursor: null } } })
    renderApp('/search')
    const user = userEvent.setup()
    await screen.findByText('Product 1')
    await user.type(screen.getByLabelText('Min price (Rs)'), '1,000')
    await user.type(screen.getByLabelText('Max price (Rs)'), '2500.50')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(await screen.findByText('No products found')).toBeInTheDocument()
    expect(calls.map((c) => c.key)).toContain('GET /api/v1/products?minPrice=100000&maxPrice=250050')
  })

  it('loads more results with the cursor and appends them', async () => {
    mockApi({ ...anonymous, 'GET /api/v1/products': { json: { items: [item(1)], nextCursor: 'abc' } }, 'GET /api/v1/products?cursor=abc': { json: { items: [item(2)], nextCursor: null } } })
    renderApp('/search')
    const user = userEvent.setup()
    await screen.findByText('Product 1')
    await user.click(screen.getByRole('button', { name: 'Show more' }))
    expect(await screen.findByText('Product 2')).toBeInTheDocument()
    expect(screen.getByText('Product 1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
  })

  it('shows an empty state when nothing matches', async () => {
    mockApi({ ...anonymous, 'GET /api/v1/products?q=zzz': { json: { items: [], nextCursor: null } } })
    renderApp('/search?q=zzz')
    expect(await screen.findByText('No products found')).toBeInTheDocument()
  })

  it('shows the server error when the search fails', async () => {
    mockApi({ ...anonymous, 'GET /api/v1/products?q=boom': apiError(500, 'INTERNAL_ERROR', 'Something went wrong.') })
    renderApp('/search?q=boom')
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })
})

const PRODUCT = {
  id: 'p1', title: 'Cotton T-shirt', slug: 'cotton-t-shirt-ab12', description: 'Soft cotton.\nWashes well.', category: { slug: 'men', name: 'Men' }, store: { name: 'Ali Traders' },
  options: [{ name: 'Size', values: ['S', 'M'] }],
  skus: [
    { id: 's1', options: { Size: 'S' }, priceMinor: 99900, compareAtMinor: 129900, currency: 'PKR', inStock: true },
    { id: 's2', options: { Size: 'M' }, priceMinor: 109900, compareAtMinor: null, currency: 'PKR', inStock: false },
  ],
  images: [{ url: '/api/v1/media/products/i1', altText: 'Front' }, { url: '/api/v1/media/products/i2', altText: null }],
}

describe('product page', () => {
  const route = { ...anonymous, 'GET /api/v1/products/cotton-t-shirt-ab12': { json: { product: PRODUCT } } }

  it('shows the product, the lowest price and asks the shopper to choose options', async () => {
    mockApi(route)
    renderApp('/p/cotton-t-shirt-ab12')
    expect(await screen.findByRole('heading', { level: 1, name: 'Cotton T-shirt' })).toBeInTheDocument()
    expect(screen.getByText(/From/)).toHaveTextContent('999')
    expect(screen.getByText('Sold by Ali Traders')).toBeInTheDocument()
    expect(screen.getByText('Choose your options to see availability.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeDisabled()
    expect(screen.getByRole('img', { name: 'Front' })).toHaveAttribute('src', '/api/v1/media/products/i1')
  })

  it('shows price, old price and availability for the chosen variant', async () => {
    mockApi(route)
    renderApp('/p/cotton-t-shirt-ab12')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'S' }))
    expect(screen.getByText('In stock')).toBeInTheDocument()
    expect(screen.getByText(/1,299/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'M' }))
    expect(screen.getByText('Sold out')).toBeInTheDocument()
  })

  it('switches photos with the thumbnails', async () => {
    mockApi(route)
    renderApp('/p/cotton-t-shirt-ab12')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Show photo 2' }))
    expect(screen.getAllByRole('img').some((i) => i.getAttribute('src') === '/api/v1/media/products/i2' && i.getAttribute('alt') === 'Cotton T-shirt')).toBe(true)
  })

  it('shows a plain-text description and a friendly message for products that are not on sale', async () => {
    mockApi(route)
    renderApp('/p/cotton-t-shirt-ab12')
    expect(await screen.findByText(/Soft cotton\./)).toBeInTheDocument()
    vi.unstubAllGlobals()
    mockApi({ ...anonymous, 'GET /api/v1/products/gone': apiError(404, 'NOT_FOUND', 'Resource not found.') })
    renderApp('/p/gone')
    expect(await screen.findByText('This product is not available')).toBeInTheDocument()
  })
})
