import { request } from './client.js'

export const register = (input) => request('/auth/register', { method: 'POST', body: input })
export const verifyEmail = (token) => request('/auth/verify-email', { method: 'POST', body: { token } })
export const login = (input) => request('/auth/login', { method: 'POST', body: input })
export const logout = () => request('/auth/logout', { method: 'POST', body: {} })
export const forgotPassword = (email) => request('/auth/forgot-password', { method: 'POST', body: { email } })
export const resetPassword = (token, password) => request('/auth/reset-password', { method: 'POST', body: { token, password } })
export const changePassword = (input) => request('/auth/change-password', { method: 'POST', body: input })
export const getMe = () => request('/me')
export const updateMe = (patch) => request('/me', { method: 'PATCH', body: patch })
