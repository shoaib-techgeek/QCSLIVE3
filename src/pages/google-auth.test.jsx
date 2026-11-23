import { screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT, apiError, mockApi, renderApp } from '../test/utils.jsx'

const anonymous = { 'GET /api/v1/me': apiError(401, 'UNAUTHENTICATED', 'Authentication required.') }
let gis

beforeEach(() => {
  gis = { initialize: vi.fn(), renderButton: vi.fn() }
  window.google = { accounts: { id: gis } }
})
afterEach(() => {
  delete window.google
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Google sign-in', () => {
  it('shows the Google button on LoginPage only when VITE_GOOGLE_CLIENT_ID is set', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '')
    mockApi(anonymous)
    const off = renderApp('/login')
    await screen.findByRole('heading', { name: 'Login' })
    expect(gis.renderButton).not.toHaveBeenCalled()
    expect(screen.queryByTestId('google-button')).toBeNull()
    off.unmount()

    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
    mockApi(anonymous)
    renderApp('/login')
    expect(await screen.findByTestId('google-button')).toBeInTheDocument()
    expect(gis.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'client-123' }))
    expect(gis.renderButton).toHaveBeenCalled()
  })

  it('shows the same button on RegisterPage', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
    mockApi(anonymous)
    renderApp('/register')
    expect(await screen.findByTestId('google-button')).toBeInTheDocument()
    expect(gis.renderButton).toHaveBeenCalled()
  })

  it('a credential callback calls the API with the idToken and navigates to /account', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
    const { calls } = mockApi({
      ...anonymous,
      'POST /api/v1/auth/oauth/google': { json: { account: ACCOUNT } },
    })
    renderApp('/login')
    await screen.findByTestId('google-button')
    await gis.initialize.mock.calls[0][0].callback({ credential: 'id-token-abc' })
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/auth/oauth/google').body).toEqual({ idToken: 'id-token-abc' })
  })

  it('an API error shows a role="alert" message', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'client-123')
    mockApi({
      ...anonymous,
      'POST /api/v1/auth/oauth/google': apiError(401, 'INVALID_GOOGLE_TOKEN', 'Google sign-in failed.'),
    })
    renderApp('/login')
    await screen.findByTestId('google-button')
    await gis.initialize.mock.calls[0][0].callback({ credential: 'bad' })
    expect(await screen.findByRole('alert')).toHaveTextContent('Google sign-in failed.')
  })
})
