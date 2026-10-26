import { describe, expect, it } from 'vitest'
import { formatMoney } from './money.js'

describe('formatMoney', () => {
  it('formats integer minor units as major units', () => {
    expect(formatMoney(349900, 'PKR')).toMatch(/3,499/)
  })
  it('uses the currency exponent (JPY has none)', () => {
    expect(formatMoney(500, 'JPY', 'en')).toMatch(/500/)
  })
  it('rejects floats so money is never imprecise', () => {
    expect(() => formatMoney(10.5)).toThrow(TypeError)
  })
})
