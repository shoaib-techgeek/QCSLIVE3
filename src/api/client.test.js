import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request } from './client.js'

afterEach(() => vi.unstubAllGlobals())

describe('request', () => {
  it('sends credentials, the CSRF header and a JSON body', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: 1 }) }))
    vi.stubGlobal('fetch', fetchMock)
    await request('/x', { method: 'POST', body: { a: 1 } })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/v1/x')
    expect(init.credentials).toBe('same-origin')
    expect(init.headers['X-Requested-With']).toBe('XMLHttpRequest')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"a":1}')
  })

  it('returns null for 204', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 204 }))
    expect(await request('/x')).toBeNull()
  })

  it('maps the API error shape to ApiError with field errors', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 'VALIDATION_ERROR', message: 'bad', requestId: 'r', details: [{ path: 'email', message: 'Invalid' }, { path: 'email', message: 'second' }] } }),
    }))
    const err = await request('/x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', requestId: 'r' })
    expect(err.fieldErrors).toEqual({ email: 'Invalid' })
  })

  it('handles non-JSON error bodies', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 502, json: async () => { throw new Error('html') } }))
    const err = await request('/x').catch((e) => e)
    expect(err).toMatchObject({ status: 502, code: 'UNKNOWN' })
  })

  it('reports network failures with a friendly message', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('fail') })
    const err = await request('/x').catch((e) => e)
    expect(err).toMatchObject({ status: 0, code: 'NETWORK_ERROR' })
  })
})
