import { request } from './client.js'

export const getCart = () => request('/cart')
export const addToCart = (skuId, qty) => request('/cart/items', { method: 'POST', body: { skuId, qty } })
export const updateCartItem = (itemId, patch) => request(`/cart/items/${itemId}`, { method: 'PATCH', body: patch })
export const removeCartItem = (itemId) => request(`/cart/items/${itemId}`, { method: 'DELETE' })
