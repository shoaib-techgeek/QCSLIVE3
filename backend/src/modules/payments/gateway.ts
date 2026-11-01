import type { Money } from '../../shared/money.js';

export interface ChargeRequest {
  idempotencyKey: string;
  amount: Money;
  reference: string; // our order/payment reference
}

export interface PaymentResult {
  id: string;
  status: 'succeeded' | 'failed';
  amount: Money;
  failureCode?: string;
}

export interface RefundRequest {
  idempotencyKey: string;
  paymentId: string;
  amount: Money;
}

export interface RefundResult {
  id: string;
  status: 'succeeded' | 'failed';
  amount: Money;
}

/** Every payment provider (Stripe, PayFast, COD, Fake) implements this. Retrying with the same idempotencyKey must not charge twice. */
export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<PaymentResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
}
