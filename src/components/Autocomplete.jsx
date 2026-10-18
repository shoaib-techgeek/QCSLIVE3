import { useId, useMemo, useRef, useState } from 'react'
import './Autocomplete.css'

/**
 * Searchable single-select (ARIA 1.2 combobox with listbox popup).
 *
 * @param {object} props
 * @param {string} props.label
 * @param {{value: string, label: string}[]} props.options
 * @param {string} props.value                 selected option value
 * @param {(value: string) => void} props.onChange
 * @param {string} [props.placeholder]
 */
export default function Autocomplete({ label, options, value, onChange, placeholder = 'Search…' }) {
  const id = useId()
  const listId = `${id}-list`
  const inputRef = useRef(null)

  const selected = options.find((o) => o.value === value)
  const [text, setText] = useState(selected?.label ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  // Show every option until the user actually types something new.
  const [dirty, setDirty] = useState(false)

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase()
    if (!dirty || !q) return options
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, text, dirty])

  const close = () => {
    setOpen(false)
    setDirty(false)
    setText(selected?.label ?? '')
  }

  const choose = (option) => {
    onChange(option.value)
    setText(option.label)
    setDirty(false)
    setOpen(false)
  }

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) setOpen(true)
        else setActive((i) => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((i) => Math.max(i - 1, 0))
        break
      case 'Enter':
        if (open && filtered[active]) {
          e.preventDefault()
          choose(filtered[active])
        }
        break
      case 'Escape':
        if (open) {
          e.preventDefault()
          close()
        }
        break
      case 'Tab':
        if (open) close()
        break
    }
  }

  return (
    <div
      className="ac"
      onBlur={(e) => {
        // Close only when focus leaves the whole widget.
        if (!e.currentTarget.contains(e.relatedTarget)) close()
      }}
    >
      <label className="ac__label" htmlFor={id}>
        {label}
      </label>
      <div className="ac__field">
        <input
          ref={inputRef}
          id={id}
          className="ac__input"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[active] ? `${id}-opt-${active}` : undefined}
          placeholder={placeholder}
          value={text}
          onFocus={(e) => {
            e.target.select()
            setOpen(true)
          }}
          onClick={() => setOpen(true)}
          onChange={(e) => {
            setText(e.target.value)
            setDirty(true)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="ac__toggle"
          tabIndex={-1}
          aria-label={open ? 'Close options' : 'Show options'}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) close()
            else {
              inputRef.current?.focus()
              setOpen(true)
            }
          }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <ul className="ac__list" id={listId} role="listbox" aria-label={label}>
          {filtered.length ? (
            filtered.map((o, i) => (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`ac__option${i === active ? ' is-active' : ''}${o.value === value ? ' is-selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
              >
                {o.label}
                {o.value === value && (
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path d="m5 12 5 5L20 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            ))
          ) : (
            <li className="ac__empty" role="option" aria-disabled="true" aria-selected="false">
              No matches
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
