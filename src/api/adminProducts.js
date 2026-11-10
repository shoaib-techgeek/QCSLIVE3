import { request } from './client.js'

export const listProductQueue = (status = 'pending') => request(`/admin/products?status=${encodeURIComponent(status)}`)
export const getProductForReview = (id) => request(`/admin/products/${id}`)
export const moderateProduct = (id, decision, reason) => request(`/admin/products/${id}/moderate`, { method: 'POST', body: reason ? { decision, reason } : { decision } })
