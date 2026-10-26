import { useId, useRef } from 'react'

/** tabs: [{ id, label, panel }]. Arrow keys move between tabs (WAI-ARIA tabs pattern). */
export default function Tabs({ tabs, value, onChange, label }) {
  const base = useId()
  const refs = useRef([])
  const index = Math.max(0, tabs.findIndex((t) => t.id === value))

  function onKeyDown(e) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = (index + step + tabs.length) % tabs.length
    onChange(tabs[next].id)
    refs.current[next]?.focus()
  }

  return (
    <>
      <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((t, i) => (
          <button
            key={t.id} ref={(el) => (refs.current[i] = el)} type="button" role="tab" className="tab" id={`${base}-t-${t.id}`}
            aria-selected={i === index} aria-controls={`${base}-p-${t.id}`} tabIndex={i === index ? 0 : -1} onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-p-${tabs[index].id}`} aria-labelledby={`${base}-t-${tabs[index].id}`}>
        {tabs[index].panel}
      </div>
    </>
  )
}
