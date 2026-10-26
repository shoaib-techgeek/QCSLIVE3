import EmptyState from '../../ui/EmptyState.jsx'
import StatCard from '../../ui/StatCard.jsx'

export default function SellerDashboardPage() {
  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Sales and orders for your store.</p>
        </div>
      </div>
      <div className="stat-grid">
        <StatCard label="Orders to ship" value="0" />
        <StatCard label="Active products" value="0" />
        <StatCard label="Sales this week" value="Rs 0" />
      </div>
      <EmptyState title="Your store is empty">Product listing opens with the catalogue module. Seller onboarding comes first.</EmptyState>
    </div>
  )
}
