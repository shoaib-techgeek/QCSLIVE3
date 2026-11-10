import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMyProducts } from '../../api/sellerProducts.js'
import { ErrorMessage } from '../../components/FormMessage.jsx'
import { formatMoney } from '../../lib/money.js'
import Badge from '../../ui/Badge.jsx'
import Button from '../../ui/Button.jsx'
import DataTable from '../../ui/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'
import { PRODUCT_STATUS } from './product-labels.js'

export default function SellerProductsPage() {
  const [state, setState] = useState({ loading: true, items: [], next: null, error: '' })
  const [more, setMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    listMyProducts()
      .then((r) => !cancelled && setState({ loading: false, items: r.items, next: r.nextCursor, error: '' }))
      .catch((e) => !cancelled && setState({ loading: false, items: [], next: null, error: e.message }))
    return () => { cancelled = true }
  }, [])

  async function showMore() {
    setMore(true)
    try {
      const r = await listMyProducts({ cursor: state.next })
      setState((s) => ({ ...s, items: [...s.items, ...r.items], next: r.nextCursor }))
    } catch (e) {
      setState((s) => ({ ...s, error: e.message }))
    } finally {
      setMore(false)
    }
  }

  const columns = [
    { key: 'title', header: 'Product', render: (r) => <Link to={`/seller/products/${r.id}`}>{r.title}</Link> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={PRODUCT_STATUS[r.status].tone}>{PRODUCT_STATUS[r.status].label}</Badge> },
    { key: 'price', header: 'Price', numeric: true, render: (r) => (r.priceFromMinor === null ? '—' : formatMoney(r.priceFromMinor, r.currency)) },
  ]

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p className="muted">Create products, add photos and stock, then send them for review.</p>
        </div>
        <Button to="/seller/products/new">Add product</Button>
      </div>
      <ErrorMessage>{state.error}</ErrorMessage>
      {state.loading ? (
        <p className="muted" role="status">Loading…</p>
      ) : state.items.length === 0 && !state.error ? (
        <EmptyState title="No products yet">Add your first product. It stays a draft until you send it for review.</EmptyState>
      ) : (
        <>
          <DataTable caption="Your products" columns={columns} rows={state.items} />
          {state.next && <div className="load-more"><button type="button" className="button button-ghost" onClick={showMore} disabled={more}>{more ? 'Loading…' : 'Show more'}</button></div>}
        </>
      )}
    </div>
  )
}
