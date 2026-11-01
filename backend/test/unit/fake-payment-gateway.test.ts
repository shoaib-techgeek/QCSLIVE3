import { describe, expect, it } from 'vitest';
import { FakePaymentGateway } from '../../src/modules/payments/fake-gateway.js';
import { Money } from '../../src/shared/money.js';

describe('FakePaymentGateway', () => {
  it('charges and returns a succeeded payment', async () => {
    const gw = new FakePaymentGateway();
    const r = await gw.charge({ idempotencyKey: 'k1', amount: Money.of(1000, 'PKR'), reference: 'order-1' });
    expect(r.status).toBe('succeeded');
  });
  it('is idempotent: same key returns the same payment, charged once', async () => {
    const gw = new FakePaymentGateway();
    const req = { idempotencyKey: 'k1', amount: Money.of(1000, 'PKR'), reference: 'order-1' };
    const a = await gw.charge(req);
    const b = await gw.charge(req);
    expect(b.id).toBe(a.id);
    expect(gw.charges).toHaveLength(1);
  });
  it('can be told to fail the next charge', async () => {
    const gw = new FakePaymentGateway();
    gw.failNext('card_declined');
    const r = await gw.charge({ idempotencyKey: 'k2', amount: Money.of(1, 'PKR'), reference: 'o' });
    expect(r).toMatchObject({ status: 'failed', failureCode: 'card_declined' });
  });
  it('refunds at most the charged amount', async () => {
    const gw = new FakePaymentGateway();
    const p = await gw.charge({ idempotencyKey: 'k3', amount: Money.of(1000, 'PKR'), reference: 'o' });
    expect((await gw.refund({ idempotencyKey: 'r1', paymentId: p.id, amount: Money.of(400, 'PKR') })).status).toBe('succeeded');
    await expect(gw.refund({ idempotencyKey: 'r2', paymentId: p.id, amount: Money.of(700, 'PKR') })).rejects.toThrow(/exceeds/);
  });
});
