import { useId, useState } from 'react'

/** `as` selects the control: input (default), select (pass <option> children) or textarea. */
export default function Field({ label, error, hint, type = 'text', as: Control = 'input', children, ...inputProps }) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)
  const isPassword = Control === 'input' && type === 'password'
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <Control
          id={id}
          type={Control === 'input' ? (isPassword && revealed ? 'text' : type) : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        >
          {children}
        </Control>
        {isPassword && (
          <button
            type="button"
            className="reveal"
            aria-pressed={revealed}
            aria-label={`${revealed ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {hint && <p id={`${id}-hint`} className="hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
    </div>
  )
}
