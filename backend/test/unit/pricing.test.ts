import { describe, expect, it } from 'vitest';
import { validatePrice } from '../../src/modules/catalog/pricing.js';

const base = { priceMinor: 129900, currency: 'PKR', platformCurrency: 'PKR' };

describe('price rules', () => {
  it('accepts a positive integer price in the platform currency', () => {
    expect(validatePrice(base)).toEqual([]);
  });
  it.each([0, -1, 10.5, Number.NaN])('rejects price %s', (priceMinor) => {
    expect(validatePrice({ ...base, priceMinor }).map((e) => e.path)).toContain('priceMinor');
  });
  it('rejects a currency other than the platform currency', () => {
    expect(validatePrice({ ...base, currency: 'USD' }).map((e) => e.path)).toContain('currency');
  });
  it('requires the compare-at price to be higher than the price', () => {
    expect(validatePrice({ ...base, compareAtMinor: 129900 }).map((e) => e.path)).toContain('compareAtMinor');
    expect(validatePrice({ ...base, compareAtMinor: 100000 }).map((e) => e.path)).toContain('compareAtMinor');
    expect(validatePrice({ ...base, compareAtMinor: 179900 })).toEqual([]);
  });
  it('rejects a non-integer compare-at price', () => {
    expect(validatePrice({ ...base, compareAtMinor: 200000.5 }).map((e) => e.path)).toContain('compareAtMinor');
  });
});
