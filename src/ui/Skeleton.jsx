export default function Skeleton({ width = '100%', height = '1rem', radius }) {
  return <span className="skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius }} />
}
