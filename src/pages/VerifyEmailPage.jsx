import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail } from '../api/auth.js'
import { ErrorMessage, SuccessMessage } from '../components/FormMessage.jsx'
import AuthShell from '../components/AuthShell.jsx'

export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState(token ? 'verifying' : 'missing')
  const [error, setError] = useState('')
  const started = useRef(false) // tokens are single-use: StrictMode must not fire the request twice

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verifyEmail(token)
      .then(() => setState('done'))
      .catch((e) => {
        setError(e.message)
        setState('failed')
      })
  }, [token])

  return (
    <AuthShell>
      <h1>Email verification</h1>
      {state === 'verifying' && <p role="status">Verifying…</p>}
      {state === 'missing' && <ErrorMessage>This verification link is incomplete.</ErrorMessage>}
      {state === 'failed' && <ErrorMessage>{error}</ErrorMessage>}
      {state === 'done' && (
        <>
          <SuccessMessage>Your email is verified.</SuccessMessage>
          <p><Link to="/login" className="button">Sign in</Link></p>
        </>
      )}
    </AuthShell>
  )
}
