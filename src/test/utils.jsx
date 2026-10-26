import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from '../App.jsx'

/** Queue of [matcher, response] pairs; each fetch call consumes the first match. */
export function mockApi(routes) {
  const calls = []
  const fn = vi.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET'
    const key = `${method} ${url}`
    calls.push({ key, init, body: init.body ? JSON.parse(init.body) : undefined })
    const handler = routes[key]
    if (!handler) throw new Error(`Unexpected request: ${key}`)
    const { status = 200, json } = typeof handler === 'function' ? handler(calls.at(-1)) : handler
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (json === undefined) throw new Error('no body')
        return json
      },
    }
  })
  vi.stubGlobal('fetch', fn)
  return { fn, calls }
}

export const apiError = (status, code, message, details = []) => ({
  status,
  json: { error: { code, message, requestId: 'r1', details } },
})

export const ACCOUNT = { id: 'u1', email: 'jane@example.com', fullName: 'Jane Doe', phone: null, status: 'active', permissions: [] }

export function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}
