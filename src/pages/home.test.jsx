import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT, apiError, mockApi, renderApp } from '../test/utils.jsx'

afterEach(() => vi.unstubAllGlobals())

const anonymous = { 'GET /api/v1/me': apiError(401, 'UNAUTHENTICATED', 'Authentication required.') }

describe('storefront home', () => {
  it('shows the hero, trust points, categories, product shelves and the seller band', async () => {
    mockApi(anonymous)
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: /Everything a market has/ })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Why shop with us' })).toHaveTextContent('14-day returns')
    expect(screen.getByRole('heading', { name: 'Shop by category' })).toBeInTheDocument()
    for (const name of ['Best sellers', 'New in', 'Top rated']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('article').length).toBe(18)
    expect(screen.getByRole('heading', { name: 'Sell on QCS Store' })).toBeInTheDocument()
  })

  it('says the products are samples', async () => {
    mockApi(anonymous)
    renderApp('/')
    expect(await screen.findByRole('note')).toHaveTextContent('samples')
  })

  it('formats sample prices from integer minor units', async () => {
    mockApi(anonymous)
    renderApp('/')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getAllByText(/1,299/).length).toBeGreaterThan(0)
  })

  it('links "Sell on QCS Store" to onboarding in the header, hero, band and footer', async () => {
    mockApi(anonymous)
    renderApp('/')
    await screen.findByRole('heading', { level: 1 })
    const links = screen.getAllByRole('link', { name: 'Sell on QCS Store' })
    expect(links.length).toBeGreaterThanOrEqual(4)
    for (const l of links) expect(l).toHaveAttribute('href', '/seller/onboarding')
    expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Sell on QCS Store' })).not.toBeInTheDocument()
  })

  it('sends approved sellers to their seller center instead', async () => {
    mockApi({ 'GET /api/v1/me': { json: { account: { ...ACCOUNT, permissions: ['seller:access'] } } } })
    renderApp('/')
    const links = await screen.findAllByRole('link', { name: 'Seller center' })
    for (const l of links) expect(l).toHaveAttribute('href', '/seller')
    expect(screen.queryByRole('link', { name: 'Sell on QCS Store' })).not.toBeInTheDocument()
  })

  it('offers a skip link, a labelled search and a category navigation', async () => {
    mockApi(anonymous)
    renderApp('/')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('search')).toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Women' })).toHaveAttribute('href', '/?category=women')
  })
})
