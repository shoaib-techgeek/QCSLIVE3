/** Money is held as integer minor units + ISO 4217 code; this is display-only formatting. */
const EXPONENT = { JPY: 0, KRW: 0, VND: 0, KWD: 3, BHD: 3, OMR: 3 } // ISO 4217; everything else is 2

export function formatMoney(minor, currency = 'PKR', locale = 'en-PK') {
  if (!Number.isInteger(minor)) throw new TypeError('Money must be an integer in minor units')
  const exponent = EXPONENT[currency] ?? 2
  const fmt = new Intl.NumberFormat(locale, {
    style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: exponent,
  })
  return fmt.format(minor / 10 ** exponent)
}

/** Parses what a person types ("1,299.50") into integer minor units without floats; null when it is not a valid amount. */
export function parseMoney(input, exponent = 2) {
  const clean = String(input).trim().replaceAll(',', '')
  const m = /^(\d+)(?:\.(\d+))?$/.exec(clean)
  if (!m || (m[2] ?? '').length > exponent) return null
  const minor = Number(m[1]) * 10 ** exponent + Number((m[2] ?? '').padEnd(exponent, '0') || 0)
  return Number.isSafeInteger(minor) ? minor : null
}

/** Minor units back to an editable string ("129950" -> "1299.5"). */
export function toInputMoney(minor, exponent = 2) {
  const s = String(minor).padStart(exponent + 1, '0')
  return `${s.slice(0, -exponent)}.${s.slice(-exponent)}`.replace(/\.?0+$/, '')
}
