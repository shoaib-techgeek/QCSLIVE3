import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProductQueue } from '../../api/adminProducts.js'
import { ErrorMessage } from '../../components/FormMessage.jsx'
import { formatMoney } from '../../lib/money.js'
import DataTable from '../../ui/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'

export default function ProductQueuePage() {
  const [state, setState] = useState({ loading: true, items: [], error: '' })

  useEffect(() => {
    let cancelled = false
    listProductQueue()
      .then((r) => !cancelled && setState({ loading: false, items: r.items, error: '' }))
      .catch((e) => !cancelled && setState({ loading: false, items: [], error: e.message }))
    return () => { cancelled = true }
  }, [])

  const columns = [
    { key: 'title', header: 'Product', render: (r) => <Link to={`/admin/products/${r.id}`}>{r.title}</Link> },
    { key: 'storeName', header: 'Store' },
    { key: 'price', header: 'Price', numeric: true, render: (r) => (r.priceFromMinor === null ? '—' : formatMoney(r.priceFromMinor, r.currency)) },
    { key: 'imageCount', header: 'Photos', numeric: true },
    { key: 'submittedAt', header: 'Added', render: (r) => new Date(r.submittedAt).toLocaleDateString() },
  ]

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Product review</h1>
          <p className="muted">Products waiting for approval, oldest first.</p>
        </div>
      </div>
      <ErrorMessage>{state.error}</ErrorMessage>
      {state.loading ? (
        <p className="muted" role="status">Loading…</p>
      ) : state.items.length === 0 && !state.error ? (
        <EmptyState title="Nothing to review">Products that sellers send for review will show up here.</EmptyState>
      ) : (
        <DataTable caption="Products waiting for review" columns={columns} rows={state.items} />
      )}
    </div>
  )
}
