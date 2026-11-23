import { useEffect, useRef } from 'react'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let gisPromise

function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve()
  gisPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = resolve
    s.onerror = () => {
      gisPromise = undefined
      reject(new Error('Could not load Google sign-in.'))
    }
    document.head.appendChild(s)
  })
  return gisPromise
}

/** Google Identity Services button. Renders nothing when VITE_GOOGLE_CLIENT_ID is unset. */
export default function GoogleButton({ onCredential, onError }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const host = useRef(null)
  const handlers = useRef({ onCredential, onError })
  useEffect(() => {
    handlers.current = { onCredential, onError }
  })

  useEffect(() => {
    if (!clientId) return undefined
    let cancelled = false
    loadGis()
      .then(() => {
        if (cancelled) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            try {
              await handlers.current.onCredential(credential)
            } catch (err) {
              handlers.current.onError(err.message)
            }
          },
        })
        window.google.accounts.id.renderButton(host.current, { theme: 'outline', size: 'large', text: 'continue_with' })
      })
      .catch((err) => !cancelled && handlers.current.onError(err.message))
    return () => {
      cancelled = true
    }
  }, [clientId])

  if (!clientId) return null
  return (
    <>
      <p className="auth-divider">or</p>
      <div ref={host} data-testid="google-button" className="google-button" />
    </>
  )
}
