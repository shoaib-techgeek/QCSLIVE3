/** Empty screens point at the next action. */
export default function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-art" aria-hidden="true">
        <span className="tile tile-mango" /><span className="tile tile-teal" /><span className="tile tile-coral" />
      </div>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}
