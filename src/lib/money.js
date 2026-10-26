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
