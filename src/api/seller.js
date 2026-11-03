import { request } from './client.js'

export const getSeller = () => request('/seller/profile')
export const createSeller = (input) => request('/seller/profile', { method: 'POST', body: input })
export const getKyc = () => request('/seller/kyc')
export const saveKycPii = (input) => request('/seller/kyc/pii', { method: 'PUT', body: input })
export const submitKyc = () => request('/seller/kyc/submit', { method: 'POST', body: {} })
export const deleteKycDocument = (id) => request(`/seller/kyc/documents/${id}`, { method: 'DELETE' })
export const uploadKycDocument = (kind, file) => {
  const form = new FormData()
  form.append('kind', kind) // must come before the file
  form.append('file', file)
  return request('/seller/kyc/documents', { method: 'POST', form })
}
