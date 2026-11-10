import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import * as cartApi from '../api/cart.js'
import { useAuth } from '../auth/AuthContext.jsx'

const CartContext = createContext(null)
const EMPTY = { groups: [], summary: { itemCount: 0, subtotalMinor: 0, currency: 'PKR' }, changes: [] }

/** The signed-in buyer's cart. The server owns every number in it; this only holds the latest copy. */
export function CartProvider({ children }) {
  const { status } = useAuth()
  const [cart, setCart] = useState(EMPTY)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setCart(await cartApi.getCart())
    } catch {
      // The badge simply stays as it was; the cart page shows its own error if loading fails there.
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') {
      setCart(EMPTY)
      return
    }
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [status, refresh])

  const add = useCallback(async (skuId, qty) => { setCart(await cartApi.addToCart(skuId, qty)) }, [])
  const update = useCallback(async (itemId, patch) => { setCart(await cartApi.updateCartItem(itemId, patch)) }, [])
  const remove = useCallback(async (itemId) => { await cartApi.removeCartItem(itemId); await refresh() }, [refresh])

  /** Everything in the cart, selected or not: this is what the header badge counts. */
  const count = useMemo(() => cart.groups.reduce((n, g) => n + g.items.reduce((m, i) => m + i.qty, 0), 0), [cart])

  const value = useMemo(() => ({ cart, count, loading, refresh, add, update, remove }), [cart, count, loading, refresh, add, update, remove])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
