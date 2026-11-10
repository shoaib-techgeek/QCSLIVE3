import { request } from './client.js'

/** params: { q, category, minPrice, maxPrice, sort, cursor, limit }; empty values are left out. */
export function listProducts(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  const s = qs.toString()
  return request(`/products${s ? `?${s}` : ''}`)
}
export const getProduct = (slug) => request(`/products/${encodeURIComponent(slug)}`)
