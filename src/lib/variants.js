/** Cartesian product of option values, in option order: [{ Color: 'Red', Size: 'S' }, ...]. Mirrors the server rule so the form can preview. */
export function buildVariants(options) {
  const clean = options
    .map((o) => ({ name: o.name.trim(), values: o.values.map((v) => v.trim()).filter(Boolean) }))
    .filter((o) => o.name && o.values.length > 0)
  return clean.reduce((acc, o) => acc.flatMap((v) => o.values.map((val) => ({ ...v, [o.name]: val }))), [{}])
}

/** "Red, Blue ,Black" -> ['Red', 'Blue', 'Black'] (duplicates and blanks dropped). */
export function splitValues(text) {
  const seen = new Set()
  return text.split(',').map((v) => v.trim()).filter((v) => v && !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()))
}

export const variantLabel = (options) => Object.values(options).join(' / ') || 'Default'
