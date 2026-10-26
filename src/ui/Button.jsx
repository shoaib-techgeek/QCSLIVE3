import { Link } from 'react-router-dom'

/** variant: primary | secondary | ghost | danger. Pass `to` to render a router link styled as a button. */
export default function Button({ variant = 'primary', size, block, loading, icon, to, className = '', children, ...rest }) {
  const cls = [
    'button',
    variant !== 'primary' && `button-${variant}`,
    size === 'small' && 'button-small',
    block && 'button-block',
    icon && 'button-icon',
    className,
  ].filter(Boolean).join(' ')
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>
  return (
    <button type="button" className={cls} aria-busy={loading || undefined} disabled={loading || rest.disabled} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
