import { useState } from 'react'
import Field from '../components/Field.jsx'
import Badge from '../ui/Badge.jsx'
import Button from '../ui/Button.jsx'
import DataTable from '../ui/DataTable.jsx'
import EmptyState from '../ui/EmptyState.jsx'
import Icon, { ICON_NAMES } from '../ui/Icon.jsx'
import Modal from '../ui/Modal.jsx'
import ProductCard from '../ui/ProductCard.jsx'
import Skeleton from '../ui/Skeleton.jsx'
import StatCard from '../ui/StatCard.jsx'
import Tabs from '../ui/Tabs.jsx'
import ThemeToggle from '../ui/ThemeToggle.jsx'
import { useToast } from '../ui/Toast.jsx'

const SWATCHES = ['primary', 'brand', 'mango', 'teal', 'coral', 'success', 'warning', 'error', 'info']
const ORDERS = [
  { id: 'A-1001', buyer: 'Ayesha K.', status: 'Shipped', totalMinor: 459900 },
  { id: 'A-1002', buyer: 'Bilal R.', status: 'Pending', totalMinor: 129900 },
]
const TONE = { Shipped: 'success', Pending: 'warning' }

function Section({ title, children }) {
  return (
    <section className="card stack" aria-labelledby={`s-${title}`}>
      <h2 id={`s-${title}`}>{title}</h2>
      {children}
    </section>
  )
}

/** Dev-only gallery of every UI kit piece, for design review. */
export default function DesignPage() {
  const toast = useToast()
  const [tab, setTab] = useState('one')
  const [modal, setModal] = useState(false)
  const [loading, setLoading] = useState(false)

  return (
    <div className="container-wide stack">
      <div className="page-head">
        <div>
          <h1>Design system</h1>
          <p className="muted">Tokens and components shared by the storefront, seller center and admin.</p>
        </div>
        <ThemeToggle />
      </div>

      <Section title="Colour">
        <div className="row">
          {SWATCHES.map((n) => (
            <div key={n}>
              <span className="tile" style={{ display: 'block', width: 72, height: 48, background: `var(--${n})` }} />
              <small className="muted">{n}</small>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Buttons">
        <div className="row">
          <Button>Save changes</Button>
          <Button variant="secondary">Add to cart</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete product</Button>
          <Button size="small">Small</Button>
          <Button loading={loading} onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1200) }}>Publish</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="row">
          <Badge>Active</Badge><Badge tone="success">Delivered</Badge><Badge tone="warning">Pending review</Badge>
          <Badge tone="danger">Rejected</Badge><Badge tone="info">In transit</Badge><Badge tone="neutral">Draft</Badge>
        </div>
      </Section>

      <Section title="Form fields">
        <div style={{ maxWidth: 420 }}>
          <Field label="Product title" hint="Up to 120 characters." />
          <Field label="Category" as="select"><option>Fashion</option><option>Electronics</option></Field>
          <Field label="Description" as="textarea" />
          <Field label="SKU" error="That SKU is already used in your store." defaultValue="SKU-1" />
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs label="Example" value={tab} onChange={setTab} tabs={[
          { id: 'one', label: 'Details', panel: <p>Details panel</p> },
          { id: 'two', label: 'Variants', panel: <p>Variants panel</p> },
        ]} />
      </Section>

      <Section title="Table">
        <DataTable caption="Recent orders" rows={ORDERS} columns={[
          { key: 'id', header: 'Order' },
          { key: 'buyer', header: 'Buyer' },
          { key: 'status', header: 'Status', render: (r) => <Badge tone={TONE[r.status]}>{r.status}</Badge> },
          { key: 'totalMinor', header: 'Total', numeric: true, render: (r) => `Rs ${(r.totalMinor / 100).toLocaleString('en-PK')}` },
        ]} />
      </Section>

      <Section title="Product cards">
        <div className="product-grid">
          <ProductCard title="Linen shirt, relaxed fit" to="/design" priceMinor={349900} wasMinor={499900} rating={4.6} />
          <ProductCard title="Wireless earbuds with charging case" to="/design" priceMinor={289900} rating={4.2} flag="New" />
          <ProductCard title="Ceramic pour-over coffee set" to="/design" priceMinor={159900} />
        </div>
      </Section>

      <Section title="Stats and loading">
        <div className="stat-grid">
          <StatCard label="Sales" value="Rs 1.2M" delta={12} />
          <StatCard label="Returns" value="14" delta={-3} />
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <Skeleton width="60%" height="1.2rem" /><Skeleton height="0.9rem" /><Skeleton width="80%" height="0.9rem" />
        </div>
      </Section>

      <Section title="Feedback">
        <div className="row">
          <Button variant="secondary" onClick={() => toast.success('Product published')}>Success toast</Button>
          <Button variant="secondary" onClick={() => toast.error('Could not save. Check your connection and try again.')}>Error toast</Button>
          <Button variant="secondary" onClick={() => setModal(true)}>Open dialog</Button>
        </div>
        <EmptyState title="No orders yet" action={<Button size="small" to="/">Browse the store</Button>}>
          Orders appear here as soon as a buyer checks out.
        </EmptyState>
      </Section>

      <Section title="Icons">
        <div className="row">
          {ICON_NAMES.map((n) => <span key={n} title={n}><Icon name={n} /></span>)}
        </div>
      </Section>

      <Modal open={modal} onClose={() => setModal(false)} title="Delete this product?"
        actions={<><Button variant="ghost" onClick={() => setModal(false)}>Keep product</Button><Button variant="danger" onClick={() => setModal(false)}>Delete product</Button></>}>
        <p>Buyers will no longer see it. Past orders keep their own copy of the details.</p>
      </Modal>
    </div>
  )
}
