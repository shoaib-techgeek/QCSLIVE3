import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listKyc } from '../../api/admin.js'
import { ErrorMessage } from '../../components/FormMessage.jsx'
import { STATUS_LABELS } from '../seller/kyc-labels.js'
import Badge from '../../ui/Badge.jsx'
import DataTable from '../../ui/DataTable.jsx'
import EmptyState from '../../ui/EmptyState.jsx'

export default function KycQueuePage() {
  const [state, setState] = useState({ loading: true, items: [], error: '' })

  useEffect(() => {
    let cancelled = false
    listKyc()
      .then((r) => !cancelled && setState({ loading: false, items: r.items, error: '' }))
      .catch((e) => !cancelled && setState({ loading: false, items: [], error: e.message }))
    return () => { cancelled = true }
  }, [])

  const columns = [
    { key: 'storeName', header: 'Store', render: (r) => <Link to={`/admin/kyc/${r.id}`}>{r.storeName}</Link> },
    { key: 'status', header: 'Status', render: (r) => <Badge tone={STATUS_LABELS[r.status].tone}>{STATUS_LABELS[r.status].label}</Badge> },
    { key: 'submittedAt', header: 'Submitted', render: (r) => (r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '—') },
    { key: 'flags', header: 'Flags', render: (r) => (r.flags.includes('ntn_missing') ? <Badge tone="warning">No tax number</Badge> : '—') },
  ]

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Seller verification</h1>
          <p className="muted">Applications waiting for review.</p>
        </div>
      </div>
      <ErrorMessage>{state.error}</ErrorMessage>
      {state.loading ? (
        <p className="muted" role="status">Loading…</p>
      ) : state.items.length === 0 && !state.error ? (
        <EmptyState title="Nothing to review">New seller applications will show up here.</EmptyState>
      ) : (
        <DataTable caption="Seller applications" columns={columns} rows={state.items} />
      )}
    </div>
  )
}
