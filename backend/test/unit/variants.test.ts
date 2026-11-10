import { describe, expect, it } from 'vitest';
import { generateVariants, matchSkusToVariants, type VariantOption } from '../../src/modules/catalog/variants.js';

const LIMITS = { maxOptions: 3, maxValuesPerOption: 20, maxVariants: 100 };
const opt = (name: string, values: string[]): VariantOption => ({ name, values });

describe('variant matrix', () => {
  it('builds 3 colours x 4 sizes = 12 variants, in option order', () => {
    const r = generateVariants([opt('Color', ['Red', 'Blue', 'Black']), opt('Size', ['S', 'M', 'L', 'XL'])], LIMITS);
    expect(r.ok && r.variants).toHaveLength(12);
    expect(r.ok && r.variants[0]).toEqual({ Color: 'Red', Size: 'S' });
    expect(r.ok && r.variants[11]).toEqual({ Color: 'Black', Size: 'XL' });
  });

  it('gives one default variant when the product has no options', () => {
    expect(generateVariants([], LIMITS)).toEqual({ ok: true, variants: [{}] });
  });

  it('trims names and values', () => {
    const r = generateVariants([opt('  Color ', [' Red '])], LIMITS);
    expect(r.ok && r.variants).toEqual([{ Color: 'Red' }]);
  });

  it.each([
    ['empty option name', [opt('', ['A'])]],
    ['option without values', [opt('Color', [])]],
    ['blank value', [opt('Color', ['Red', ' '])]],
    ['duplicate option names (case-insensitive)', [opt('Color', ['A']), opt('color', ['B'])]],
    ['duplicate values within an option (case-insensitive)', [opt('Color', ['Red', 'red'])]],
  ])('rejects %s', (_label, options) => {
    expect(generateVariants(options, LIMITS).ok).toBe(false);
  });

  it('enforces the limits it is given', () => {
    expect(generateVariants([opt('A', ['1']), opt('B', ['1']), opt('C', ['1']), opt('D', ['1'])], LIMITS).ok).toBe(false);
    expect(generateVariants([opt('A', Array.from({ length: 21 }, (_, i) => `v${i}`))], LIMITS).ok).toBe(false);
    const big = [opt('A', Array.from({ length: 11 }, (_, i) => `a${i}`)), opt('B', Array.from({ length: 10 }, (_, i) => `b${i}`))];
    expect(generateVariants(big, LIMITS)).toMatchObject({ ok: false });
    expect(generateVariants(big, { ...LIMITS, maxVariants: 110 }).ok).toBe(true);
  });
});

describe('matching SKUs to the variant matrix', () => {
  const variants = [{ Color: 'Red' }, { Color: 'Blue' }];
  it('accepts exactly one SKU per variant, in any order', () => {
    expect(matchSkusToVariants(variants, [{ Color: 'Blue' }, { Color: 'Red' }])).toEqual({ ok: true });
  });
  it('reports a missing variant', () => {
    expect(matchSkusToVariants(variants, [{ Color: 'Red' }])).toMatchObject({ ok: false, message: expect.stringContaining('Blue') });
  });
  it('reports a duplicate SKU for the same variant', () => {
    expect(matchSkusToVariants(variants, [{ Color: 'Red' }, { Color: 'Red' }, { Color: 'Blue' }]).ok).toBe(false);
  });
  it('reports a SKU that is not part of the matrix', () => {
    expect(matchSkusToVariants(variants, [{ Color: 'Red' }, { Color: 'Blue' }, { Color: 'Green' }]).ok).toBe(false);
  });
  it('matches a product without options to a single empty SKU', () => {
    expect(matchSkusToVariants([{}], [{}])).toEqual({ ok: true });
  });
  it('is not fooled by key order or case in values', () => {
    const v = [{ Color: 'Red', Size: 'S' }];
    expect(matchSkusToVariants(v, [{ Size: 'S', Color: 'Red' }])).toEqual({ ok: true });
    expect(matchSkusToVariants(v, [{ Color: 'red', Size: 's' }])).toEqual({ ok: true });
  });
});
