/** Market-stall mark: striped awning over a counter. Decorative; the wordmark carries the name. */
export default function Logo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="3" y="13" width="26" height="15" rx="3" fill="currentColor" opacity=".18" />
      <path d="M3 13 5.5 5h21L29 13z" fill="var(--primary)" />
      <path d="M9.5 5 8 13h5.5L14.5 5zM17.5 5 18.5 13H24L22.5 5z" fill="var(--mango)" />
      <path d="M3 13a3.25 3.25 0 0 0 6.5 0 3.25 3.25 0 0 0 6.5 0 3.25 3.25 0 0 0 6.5 0A3.25 3.25 0 0 0 29 13z" fill="var(--primary)" />
      <rect x="13" y="19" width="6" height="9" rx="1.5" fill="var(--ink)" opacity=".85" />
    </svg>
  )
}
