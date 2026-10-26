import EmptyState from '../../ui/EmptyState.jsx'
import StatCard from '../../ui/StatCard.jsx'

export default function AdminDashboardPage() {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">Marketplace health at a glance.</p>
        </div>
      </div>
      <div className="stat-grid">
        <StatCard label="Orders today" value="0" />
        <StatCard label="Sellers awaiting review" value="0" />
        <StatCard label="Products awaiting review" value="0" />
      </div>
      <EmptyState title="Nothing needs attention">Review queues appear here as sellers and products arrive.</EmptyState>
    </div>
  )
}
