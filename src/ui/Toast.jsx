import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)
const LIFETIME_MS = 5000

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => setToasts((all) => all.filter((t) => t.id !== id)), [])
  const show = useCallback((message, tone = 'success') => {
    const id = nextId.current++
    setToasts((all) => [...all, { id, message, tone }])
    setTimeout(() => dismiss(id), LIFETIME_MS)
  }, [dismiss])

  const api = useMemo(() => ({ success: (m) => show(m, 'success'), error: (m) => show(m, 'error') }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span>{t.message}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss notification">Dismiss</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
