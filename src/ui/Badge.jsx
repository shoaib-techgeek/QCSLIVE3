/** tone: default | success | warning | danger | info | neutral. Always carries text, never colour alone. */
export default function Badge({ tone = 'default', children }) {
  return <span className={`badge${tone === 'default' ? '' : ` badge-${tone}`}`}>{children}</span>
}
