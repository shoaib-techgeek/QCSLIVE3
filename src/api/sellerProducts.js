import { request } from './client.js'

const q = (params) => {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export const listMyProducts = (params = {}) => request(`/seller/products${q(params)}`)
export const getMyProduct = (id) => request(`/seller/products/${id}`)
export const createProduct = (body) => request('/seller/products', { method: 'POST', body })
export const updateProduct = (id, patch) => request(`/seller/products/${id}`, { method: 'PATCH', body: patch })
export const deleteProduct = (id) => request(`/seller/products/${id}`, { method: 'DELETE' })
export const submitProduct = (id) => request(`/seller/products/${id}/submit`, { method: 'POST', body: {} })
export const deactivateProduct = (id) => request(`/seller/products/${id}/deactivate`, { method: 'POST', body: {} })
export const activateProduct = (id) => request(`/seller/products/${id}/activate`, { method: 'POST', body: {} })
export const setStock = (skuId, onHand, note) => request(`/seller/skus/${skuId}/stock`, { method: 'PUT', body: note ? { onHand, note } : { onHand } })
export const deleteImage = (productId, imageId) => request(`/seller/products/${productId}/images/${imageId}`, { method: 'DELETE' })
export const uploadImage = (productId, file, altText) => {
  const form = new FormData()
  if (altText) form.append('altText', altText) // must come before the file
  form.append('file', file)
  return request(`/seller/products/${productId}/images`, { method: 'POST', form })
}
