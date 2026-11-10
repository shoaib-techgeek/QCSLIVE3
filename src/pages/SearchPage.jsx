import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listProducts } from '../api/catalog.js'
import { ErrorMessage } from '../components/FormMessage.jsx'
import { CATEGORIES } from '../lib/categories.js'
import { parseMoney } from '../lib/money.js'
import EmptyState from '../ui/EmptyState.jsx'
import ProductCard from '../ui/ProductCard.jsx'

const SORTS = [
  { value: '', label: 'Best match' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
]

export const cardProps = (p) => ({ title: p.title, to: `/p/${p.slug}`, priceMinor: p.priceMinor, wasMinor: p.compareAtMinor ?? undefined, currency: p.currency, imageUrl: p.imageUrl ?? undefined })

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const sort = params.get('sort') ?? ''
  const minPrice = params.get('minPrice') ?? ''
  const maxPrice = params.get('maxPrice') ?? ''
  const [prices, setPrices] = useState({ min: minPrice, max: maxPrice })
  const [state, setState] = useState({ loading: true, items: [], next: null, error: '' })
  const [more, setMore] = useState(false)

  const query = { q, category, sort, minPrice, maxPrice }
  const key = JSON.stringify(query)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: '' }))
    listProducts(query)
      .then((r) => !cancelled && setState({ loading: false, items: r.items, next: r.nextCursor, error: '' }))
      .catch((e) => !cancelled && setState({ loading: false, items: [], next: null, error: e.message }))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  async function showMore() {
    setMore(true)
    try {
      const r = await listProducts({ ...query, cursor: state.next })
      setState((s) => ({ ...s, items: [...s.items, ...r.items], next: r.nextCursor }))
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }))
    } finally {
      setMore(false)
    }
  }

  function update(patch) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k))
    setParams(next)
  }

  function applyPrices(e) {
    e.preventDefault()
    const lo = prices.min.trim() ? parseMoney(prices.min) : null
    const hi = prices.max.trim() ? parseMoney(prices.max) : null
    update({ minPrice: lo === null ? '' : String(lo), maxPrice: hi === null ? '' : String(hi) })
  }

  const heading = q ? `Results for “${q}”` : category ? (CATEGORIES.find((c) => c.slug === category)?.name ?? 'Products') : 'All products'

  return (
    <div className="container-wide">
      <h1>{heading}</h1>
      <div className="filter-bar">
        <label>Sort by
          <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <label>Category
          <select value={category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <form onSubmit={applyPrices} className="price-filter">
          <label>Min price (Rs)<input inputMode="decimal" value={prices.min} onChange={(e) => setPrices((p) => ({ ...p, min: e.target.value }))} /></label>
          <label>Max price (Rs)<input inputMode="decimal" value={prices.max} onChange={(e) => setPrices((p) => ({ ...p, max: e.target.value }))} /></label>
          <button type="submit" className="button button-small">Apply</button>
        </form>
      </div>

      <ErrorMessage>{state.error}</ErrorMessage>
      {state.loading ? (
        <p className="muted" role="status">Loading…</p>
      ) : state.items.length === 0 && !state.error ? (
        <EmptyState title="No products found">Try different words or remove a filter. <Link to="/search">See all products</Link></EmptyState>
      ) : (
        <>
          <div className="product-grid explore-grid">
            {state.items.map((p) => <ProductCard key={p.id} {...cardProps(p)} />)}
          </div>
          {state.next && (
            <div className="load-more"><button type="button" className="button button-ghost" onClick={showMore} disabled={more}>{more ? 'Loading…' : 'Show more'}</button></div>
          )}
        </>
      )}
    </div>
  )
}
