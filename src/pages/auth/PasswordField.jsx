import { useId, useState } from 'react'
import Icon from '../../components/Icon'

export default function PasswordField({ label, error, hint, autoComplete, ...inputProps }) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <input
          id={id}
          className="field__input"
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        <button
          type="button"
          className="field__toggle"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
        </button>
      </div>
      {error ? (
        <p className="field__error" id={`${id}-err`}>
          {error}
        </p>
      ) : (
        hint && (
          <p className="field__hint" id={`${id}-hint`}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}
