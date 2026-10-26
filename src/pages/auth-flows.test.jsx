import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT, apiError, mockApi, renderApp } from '../test/utils.jsx'

const anonymous = { 'GET /api/v1/me': apiError(401, 'UNAUTHENTICATED', 'Authentication required.') }
afterEach(() => vi.unstubAllGlobals())

describe('route protection', () => {
  it('redirects anonymous visitors from /account to the sign-in page', async () => {
    mockApi(anonymous)
    renderApp('/account')
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })

  it('shows the account page for an authenticated session', async () => {
    mockApi({ 'GET /api/v1/me': { json: { account: ACCOUNT } } })
    renderApp('/account')
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument()
    expect(screen.getByText(/Signed in as jane@example.com/)).toBeInTheDocument()
  })

  it('renders a not-found page for unknown routes', async () => {
    mockApi(anonymous)
    renderApp('/nope')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

describe('login', () => {
  it('signs in, then lands on the account page', async () => {
    const { calls } = mockApi({
      ...anonymous,
      'POST /api/v1/auth/login': { json: { account: ACCOUNT } },
    })
    renderApp('/login')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), ' jane@example.com ')
    await user.type(screen.getByLabelText('Password'), 'a-reasonably-long-passphrase')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/auth/login').body).toEqual({
      email: 'jane@example.com',
      password: 'a-reasonably-long-passphrase',
    })
  })

  it('shows the server error and stays on the page when credentials are wrong', async () => {
    mockApi({
      ...anonymous,
      'POST /api/v1/auth/login': apiError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
    })
    renderApp('/login')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password-1')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })

  it('disables submit until both fields are filled', async () => {
    mockApi(anonymous)
    renderApp('/login')
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeDisabled()
  })
})

describe('registration', () => {
  it('validates on the client without calling the API', async () => {
    const { calls } = mockApi(anonymous)
    renderApp('/register')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 10 characters.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)
  })

  it('shows the check-your-email confirmation on success', async () => {
    const { calls } = mockApi({ ...anonymous, 'POST /api/v1/auth/register': { status: 202, json: { message: 'ok' } } })
    renderApp('/register')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'a-reasonably-long-passphrase')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/auth/register').body).not.toHaveProperty('fullName')
  })

  it('skips the email step when the server says verification is not required', async () => {
    mockApi({ ...anonymous, 'POST /api/v1/auth/register': { status: 201, json: { verificationRequired: false, message: 'ok' } } })
    renderApp('/register')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'a-reasonably-long-passphrase')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('heading', { name: 'Account created' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to login' })).toHaveAttribute('href', '/login')
    expect(screen.queryByText(/verification link/)).not.toBeInTheDocument()
  })

  it('shows a clear error when the email is already registered', async () => {
    mockApi({ ...anonymous, 'POST /api/v1/auth/register': apiError(409, 'EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.') })
    renderApp('/register')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'a-reasonably-long-passphrase')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
  })

  it('renders server-side field errors', async () => {
    mockApi({
      ...anonymous,
      'POST /api/v1/auth/register': apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [{ path: 'password', message: 'Password is too common.' }]),
    })
    renderApp('/register')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Password'), 'password1234')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Password is too common.')).toBeInTheDocument()
  })
})

describe('email verification', () => {
  it('verifies exactly once and offers sign-in', async () => {
    const { calls } = mockApi({ ...anonymous, 'POST /api/v1/auth/verify-email': { status: 204 } })
    renderApp('/verify-email?token=abc')
    expect(await screen.findByText('Your email is verified.')).toBeInTheDocument()
    expect(calls.filter((c) => c.key === 'POST /api/v1/auth/verify-email')).toHaveLength(1)
  })

  it('shows the server message for an expired link', async () => {
    mockApi({ ...anonymous, 'POST /api/v1/auth/verify-email': apiError(400, 'INVALID_TOKEN', 'This link is invalid or has expired.') })
    renderApp('/verify-email?token=abc')
    expect(await screen.findByRole('alert')).toHaveTextContent('invalid or has expired')
  })

  it('handles a link with no token without calling the API', async () => {
    const { calls } = mockApi(anonymous)
    renderApp('/verify-email')
    expect(await screen.findByRole('alert')).toHaveTextContent('incomplete')
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)
  })
})

describe('password reset', () => {
  it('always confirms the request without revealing whether the account exists', async () => {
    mockApi({ ...anonymous, 'POST /api/v1/auth/forgot-password': { status: 202, json: { message: 'ok' } } })
    renderApp('/forgot-password')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'ghost@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists')
  })

  it('submits the token and new password', async () => {
    const { calls } = mockApi({ ...anonymous, 'POST /api/v1/auth/reset-password': { status: 204 } })
    renderApp('/reset-password?token=tok123')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('New password'), 'another-long-passphrase-9')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText(/Your password has been changed/)).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'POST /api/v1/auth/reset-password').body).toEqual({
      token: 'tok123',
      password: 'another-long-passphrase-9',
    })
  })

  it('rejects a short password client-side', async () => {
    const { calls } = mockApi(anonymous)
    renderApp('/reset-password?token=tok123')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('New password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByText('Password must be at least 10 characters.')).toBeInTheDocument()
    expect(calls.some((c) => c.key.startsWith('POST'))).toBe(false)
  })
})

describe('account page', () => {
  it('saves the profile and sends null for cleared fields', async () => {
    const updated = { ...ACCOUNT, fullName: 'Jane Q', phone: '+92 300 1234567' }
    const { calls } = mockApi({
      'GET /api/v1/me': { json: { account: ACCOUNT } },
      'PATCH /api/v1/me': { json: { account: updated } },
    })
    renderApp('/account')
    const user = userEvent.setup()
    const name = await screen.findByLabelText('Full name')
    await user.clear(name)
    await user.type(name, 'Jane Q')
    await user.type(screen.getByLabelText('Phone'), '+92 300 1234567')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Profile saved.')).toBeInTheDocument()
    expect(calls.find((c) => c.key === 'PATCH /api/v1/me').body).toEqual({ fullName: 'Jane Q', phone: '+92 300 1234567' })
  })

  it('shows phone validation errors from the server', async () => {
    mockApi({
      'GET /api/v1/me': { json: { account: ACCOUNT } },
      'PATCH /api/v1/me': apiError(400, 'VALIDATION_ERROR', 'Request validation failed.', [{ path: 'phone', message: 'Enter a valid phone number.' }]),
    })
    renderApp('/account')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Phone'), 'abc')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Enter a valid phone number.')).toBeInTheDocument()
  })

  it('signs out and returns to anonymous navigation', async () => {
    mockApi({
      'GET /api/v1/me': { json: { account: ACCOUNT } },
      'POST /api/v1/auth/logout': { status: 204 },
    })
    renderApp('/account')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument()
  })

  it('reports a wrong current password', async () => {
    mockApi({
      'GET /api/v1/me': { json: { account: ACCOUNT } },
      'POST /api/v1/auth/change-password': apiError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect.'),
    })
    renderApp('/account')
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Current password'), 'old-password-1')
    await user.type(screen.getByLabelText('New password'), 'another-long-passphrase-9')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect.')
  })
})

describe('seller and admin areas', () => {
  const customer = { 'GET /api/v1/me': { json: { account: ACCOUNT } } }

  it('sends anonymous visitors to sign in', async () => {
    mockApi(anonymous)
    renderApp('/seller')
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument()
  })

  it('blocks accounts without the permission', async () => {
    mockApi(customer)
    renderApp('/admin')
    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument()
  })

  it('opens the seller center for a seller', async () => {
    mockApi({ 'GET /api/v1/me': { json: { account: { ...ACCOUNT, permissions: ['seller:access'] } } } })
    renderApp('/seller')
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Seller center' })).toBeInTheDocument()
  })
})
