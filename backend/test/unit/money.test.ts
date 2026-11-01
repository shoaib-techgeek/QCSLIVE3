import { describe, expect, it } from 'vitest';
import { Money } from '../../src/shared/money.js';

const pkr = (n: number) => Money.of(n, 'PKR');

describe('Money', () => {
  it('rejects non-integer amounts', () => {
    expect(() => Money.of(10.5, 'PKR')).toThrow();
  });
  it('rejects invalid currency codes', () => {
    expect(() => Money.of(1, 'pk')).toThrow();
  });
  it('adds and subtracts same currency', () => {
    expect(pkr(500).add(pkr(250)).amount).toBe(750);
    expect(pkr(500).subtract(pkr(250)).amount).toBe(250);
  });
  it('throws on currency mismatch', () => {
    expect(() => pkr(1).add(Money.of(1, 'USD'))).toThrow(/currency/i);
  });
  it('takes a percentage in basis points with half-even rounding', () => {
    expect(pkr(10_000).percentage(1000).amount).toBe(1000); // 10%
    expect(pkr(25).percentage(1000).amount).toBe(2); // 2.5 -> 2 (even)
    expect(pkr(35).percentage(1000).amount).toBe(4); // 3.5 -> 4 (even)
    expect(pkr(26).percentage(1000).amount).toBe(3); // 2.6 -> 3
  });
  it('allocates without losing or creating a minor unit', () => {
    const parts = pkr(100).allocate([1, 1, 1]);
    expect(parts.map((p) => p.amount)).toEqual([34, 33, 33]);
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBe(100);
  });
  it('allocates any ratios to the exact total', () => {
    for (const [total, ratios] of [[1, [3, 7]], [999, [1, 2, 3, 4]], [0, [1, 1]]] as const) {
      const sum = pkr(total).allocate([...ratios]).reduce((s, p) => s + p.amount, 0);
      expect(sum).toBe(total);
    }
  });
  it('rejects allocation with no positive ratio', () => {
    expect(() => pkr(100).allocate([0, 0])).toThrow();
  });
});
