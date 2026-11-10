import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT, apiError, mockApi, renderApp } from '../test/utils.jsx'

afterEach(() => vi.unstubAllGlobals())

const anonymous = { 'GET /api/v1/me': apiError(401, 'UNAUTHENTICATED', 'Authentication required.') }
const item = (n, over = {}) => ({
  id: `id-${n}`, title: `Product ${n}`, slug: `product-${n}`, priceMinor: 129900, compareAtMinor: null, currency: 'PKR', imageUrl: null,
  category: { slug: 'men', name: 'Men' }, storeName: 'Ali Traders', inStock: true, ...over,
})
const page = (items) => ({ json: { items, nextCursor: null } })
const catalog = (items = [item(1), item(2)]) => ({
  ...anonymous,
  'GET /api/v1/products?sort=newest&limit=5': page(items.slice(0, 5)),
  'GET /api/v1/products?limit=20': page(items),
})

describe('storefront home', () => {
  it('shows the hero, trust band, new arrivals, the explore grid and the seller band from the live catalogue', async () => {
    mockApi(catalog())
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: /Everything a market has/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Why shop with us' })).toHaveTextContent('14-day returns')
    expect(await screen.findByRole('heading', { level: 2, name: 'New in' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Explore your interests' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sell on QCS Store' })).toBeInTheDocument()
    expect((await screen.findAllByRole('article')).length).toBe(4) // 2 in "New in" + 2 in the grid
  })

  it('links each product card to its page and formats prices from minor units', async () => {
    mockApi(catalog([item(1, { slug: 'steel-bottle-ab12', title: 'Steel bottle' })]))
    renderApp('/')
    const links = await screen.findAllByRole('link', { name: 'Steel bottle' })
    expect(links[0]).toHaveAttribute('href', '/p/steel-bottle-ab12')
    expect(screen.getAllByText(/1,299/).length).toBeGreaterThan(0)
  })

  it('filters the explore grid by category with the interest chips', async () => {
    mockApi({ ...catalog(), 'GET /api/v1/products?category=sports&limit=20': page([item(9, { title: 'Yoga mat', slug: 'yoga-mat' })]) })
    renderApp('/')
    const user = userEvent.setup()
    const chips = within(await screen.findByRole('group', { name: 'Filter products by category' }))
    expect(chips.getByRole('button', { name: 'Recommended' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(chips.getByRole('button', { name: 'Sports and outdoors' }))
    const grid = within(screen.getByRole('region', { name: 'Explore your interests' }))
    expect(await grid.findByText('Yoga mat')).toBeInTheDocument()
    expect(chips.getByRole('button', { name: 'Sports and outdoors' })).toHaveAttribute('aria-pressed', 'true')
    expect(grid.getByRole('link', { name: 'See all products' })).toHaveAttribute('href', '/search?category=sports')
  })

  it('invites sellers when the catalogue is empty', async () => {
    mockApi(catalog([]))
    renderApp('/')
    expect(await screen.findByText('The store is opening soon')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'New in' })).not.toBeInTheDocument()
  })

  it('shows an error instead of fake products when the catalogue cannot load', async () => {
    mockApi({ ...anonymous, 'GET /api/v1/products?sort=newest&limit=5': apiError(500, 'INTERNAL_ERROR', 'Something went wrong.'), 'GET /api/v1/products?limit=20': apiError(500, 'INTERNAL_ERROR', 'Something went wrong.') })
    renderApp('/')
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('links "Sell on QCS Store" to onboarding in the promise bar, hero, band and footer, but not in the header', async () => {
    mockApi(catalog())
    renderApp('/')
    await screen.findByRole('heading', { level: 1 })
    const links = screen.getAllByRole('link', { name: 'Sell on QCS Store' })
    expect(links.length).toBeGreaterThanOrEqual(4)
    for (const l of links) expect(l).toHaveAttribute('href', '/seller/onboarding')
    expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Sell on QCS Store' })).not.toBeInTheDocument()
  })

  it('sends approved sellers to their seller center instead', async () => {
    mockApi({ ...catalog(), 'GET /api/v1/me': { json: { account: { ...ACCOUNT, permissions: ['seller:access'] } } } })
    renderApp('/')
    const links = await screen.findAllByRole('link', { name: 'Seller center' })
    for (const l of links) expect(l).toHaveAttribute('href', '/seller')
    expect(screen.queryByRole('link', { name: 'Sell on QCS Store' })).not.toBeInTheDocument()
  })

  it('has a skip link, a labelled search that goes to the results page, and a categories menu', async () => {
    mockApi(catalog())
    renderApp('/')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('search')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Women' })).toHaveAttribute('href', '/search?category=women')
  })
})
