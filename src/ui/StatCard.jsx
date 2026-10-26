/** delta: signed percentage; the sign is also spelled out so colour is never the only cue. */
export default function StatCard({ label, value, delta }) {
  const dir = delta === undefined ? null : delta >= 0 ? 'up' : 'down'
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {dir && (
        <p className={`stat-delta ${dir}`}>
          {dir === 'up' ? 'Up' : 'Down'} {Math.abs(delta)}% vs last week
        </p>
      )}
    </div>
  )
}
