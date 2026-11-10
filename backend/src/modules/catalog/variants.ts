export interface VariantOption { name: string; values: string[] }
export interface VariantLimits { maxOptions: number; maxValuesPerOption: number; maxVariants: number }
export type Variant = Record<string, string>;
export type VariantResult = { ok: true; variants: Variant[] } | { ok: false; message: string };

const fail = (message: string): VariantResult => ({ ok: false, message });

/** Cartesian product of the option values, in option order. No options gives one default variant. */
export function generateVariants(options: VariantOption[], limits: VariantLimits): VariantResult {
  if (options.length > limits.maxOptions) return fail(`A product can have at most ${limits.maxOptions} options.`);
  const clean: VariantOption[] = [];
  const names = new Set<string>();
  for (const o of options) {
    const name = o.name.trim();
    if (!name) return fail('Every option needs a name.');
    if (names.has(name.toLowerCase())) return fail(`The option "${name}" is listed twice.`);
    names.add(name.toLowerCase());
    if (o.values.length === 0) return fail(`The option "${name}" needs at least one value.`);
    if (o.values.length > limits.maxValuesPerOption) return fail(`The option "${name}" can have at most ${limits.maxValuesPerOption} values.`);
    const values = o.values.map((v) => v.trim());
    if (values.some((v) => !v)) return fail(`The option "${name}" has an empty value.`);
    if (new Set(values.map((v) => v.toLowerCase())).size !== values.length) return fail(`The option "${name}" repeats a value.`);
    clean.push({ name, values });
  }
  const total = clean.reduce((n, o) => n * o.values.length, 1);
  if (total > limits.maxVariants) return fail(`These options make ${total} variants; the limit is ${limits.maxVariants}.`);
  const variants = clean.reduce<Variant[]>((acc, o) => acc.flatMap((v) => o.values.map((val) => ({ ...v, [o.name]: val }))), [{}]);
  return { ok: true, variants };
}

const keyOf = (v: Variant): string =>
  JSON.stringify(Object.entries(v).map(([k, val]) => [k.trim().toLowerCase(), val.trim().toLowerCase()]).sort(([a], [b]) => String(a).localeCompare(String(b))));

export type SkuMatch = { ok: true } | { ok: false; message: string };

/** Every variant must have exactly one SKU, and no SKU may fall outside the matrix. */
export function matchSkusToVariants(variants: Variant[], skuOptions: Variant[]): SkuMatch {
  const wanted = new Map(variants.map((v) => [keyOf(v), v]));
  const seen = new Set<string>();
  for (const s of skuOptions) {
    const k = keyOf(s);
    if (!wanted.has(k)) return { ok: false, message: `The combination ${describe(s)} is not one of the product's variants.` };
    if (seen.has(k)) return { ok: false, message: `The combination ${describe(s)} is listed more than once.` };
    seen.add(k);
  }
  for (const [k, v] of wanted) if (!seen.has(k)) return { ok: false, message: `The combination ${describe(v)} has no price yet.` };
  return { ok: true };
}

const describe = (v: Variant): string => (Object.keys(v).length ? Object.entries(v).map(([k, val]) => `${k} ${val}`).join(', ') : 'default');
