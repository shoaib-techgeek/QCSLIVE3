import { request } from './client.js'

export const listKyc = (status) => request(`/admin/kyc${status ? `?status=${encodeURIComponent(status)}` : ''}`)
export const getKycDetail = (sellerId) => request(`/admin/kyc/${sellerId}`)
export const decideKyc = (sellerId, decision, note) =>
  request(`/admin/kyc/${sellerId}/decision`, { method: 'POST', body: note ? { decision, note } : { decision } })
export const kycDocumentUrl = (sellerId, documentId) => `/api/v1/admin/kyc/${sellerId}/documents/${documentId}`
