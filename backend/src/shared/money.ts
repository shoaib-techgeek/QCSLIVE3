/** Integer minor units + ISO 4217 code. Never floats. */
export class Money {
  private constructor(
    readonly amount: number,
    readonly currency: string,
  ) {}

  static of(amount: number, currency: string): Money {
    if (!Number.isSafeInteger(amount)) throw new Error('Money amount must be an integer in minor units');
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Currency must be an ISO 4217 code');
    return new Money(amount, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.amount - other.amount, this.currency);
  }

  /** basisPoints: 1000 = 10%. Rounds half to even. */
  percentage(basisPoints: number): Money {
    if (!Number.isInteger(basisPoints)) throw new Error('basisPoints must be an integer');
    const num = BigInt(this.amount) * BigInt(basisPoints);
    const den = 10000n;
    let q = num / den;
    const r2 = (num % den) * 2n;
    const absR2 = r2 < 0n ? -r2 : r2;
    if (absR2 > den || (absR2 === den && q % 2n !== 0n)) q += num < 0n ? -1n : 1n;
    return Money.of(Number(q), this.currency);
  }

  /** Splits into len(ratios) parts that sum exactly to this amount (largest-remainder; earlier parts get the extra unit). */
  allocate(ratios: number[]): Money[] {
    const total = ratios.reduce((s, r) => s + r, 0);
    if (ratios.some((r) => !(r >= 0)) || total <= 0) throw new Error('Ratios must be non-negative with a positive sum');
    const shares = ratios.map((r) => Math.floor((this.amount * r) / total));
    let left = this.amount - shares.reduce((s, n) => s + n, 0);
    for (let i = 0; left > 0; i = (i + 1) % shares.length) {
      if ((ratios[i] ?? 0) > 0) {
        shares[i] = (shares[i] ?? 0) + 1;
        left--;
      }
    }
    return shares.map((n) => Money.of(n, this.currency));
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
  }
}
