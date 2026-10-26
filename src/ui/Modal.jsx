import { useEffect, useId, useRef } from 'react'

/** Native <dialog>: focus trap, Esc to close and inert background come from the browser. */
export default function Modal({ open, onClose, title, children, actions }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (dialog.showModal) dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    if (!open && dialog.open) {
      if (dialog.close) dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={(e) => { if (e.target === ref.current) onClose() }}
    >
      {open && (
        <div className="modal-body">
          <h2 id={titleId}>{title}</h2>
          {children}
          {actions && <div className="modal-actions">{actions}</div>}
        </div>
      )}
    </dialog>
  )
}
