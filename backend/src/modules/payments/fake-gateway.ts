import type { ChargeRequest, PaymentGateway, PaymentResult, RefundRequest, RefundResult } from './gateway.js';

/** Test/dev gateway: no network, no account. */
export class FakePaymentGateway implements PaymentGateway {
  readonly charges: PaymentResult[] = [];
  private readonly byKey = new Map<string, PaymentResult>();
  private readonly refundsByKey = new Map<string, RefundResult>();
  private readonly refunded = new Map<string, number>();
  private nextFailure: string | undefined;
  private seq = 0;

  failNext(code: string): void {
    this.nextFailure = code;
  }

  async charge(req: ChargeRequest): Promise<PaymentResult> {
    const existing = this.byKey.get(req.idempotencyKey);
    if (existing) return existing;
    const id = `fake_pay_${++this.seq}`;
    const result: PaymentResult = this.nextFailure
      ? { id, status: 'failed', amount: req.amount, failureCode: this.nextFailure }
      : { id, status: 'succeeded', amount: req.amount };
    this.nextFailure = undefined;
    this.byKey.set(req.idempotencyKey, result);
    this.charges.push(result);
    return result;
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    const existing = this.refundsByKey.get(req.idempotencyKey);
    if (existing) return existing;
    const payment = this.charges.find((c) => c.id === req.paymentId && c.status === 'succeeded');
    if (!payment) throw new Error(`Unknown or unpaid payment ${req.paymentId}`);
    const total = (this.refunded.get(req.paymentId) ?? 0) + req.amount.amount;
    if (total > payment.amount.amount) throw new Error('Refund exceeds charged amount');
    this.refunded.set(req.paymentId, total);
    const result: RefundResult = { id: `fake_ref_${++this.seq}`, status: 'succeeded', amount: req.amount };
    this.refundsByKey.set(req.idempotencyKey, result);
    return result;
  }
}
