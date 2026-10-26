export class ApiError extends Error {
  constructor(status, code, message, details = [], requestId = null) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }

  /** Server validation messages keyed by field name. */
  get fieldErrors() {
    const out = {}
    for (const d of this.details) if (d?.path && !out[d.path]) out[d.path] = d.message
    return out
  }
}

/**
 * Thin fetch wrapper. The session lives in an HttpOnly cookie, so no token is handled here.
 * `X-Requested-With` is required by the API for state-changing requests (CSRF guard).
 */
export async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.')
  }

  if (res.status === 204) return null
  let data = null
  try {
    data = await res.json()
  } catch {
    // non-JSON body; handled below
  }
  if (!res.ok) {
    const e = data?.error
    throw new ApiError(res.status, e?.code ?? 'UNKNOWN', e?.message ?? 'Something went wrong.', e?.details ?? [], e?.requestId ?? null)
  }
  return data
}
