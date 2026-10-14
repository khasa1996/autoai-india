import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/** Signature verification is only one boundary: merchant/order/amount binding follows it. */
export function verifyRazorpaySignature(raw: Uint8Array, signature: string, webhookSecret: string): boolean {
  if (raw.byteLength > 1_048_576 || webhookSecret.length < 16 || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', webhookSecret).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
const paymentEntity = z.object({
  id: z.string().min(1), order_id: z.string().min(1), amount: z.number().int().positive(),
  currency: z.literal('INR'), status: z.literal('captured'), captured: z.literal(true),
});
const capturedEvent = z.object({
  event: z.literal('payment.captured'), account_id: z.string().min(1),
  payload: z.object({ payment: z.object({ entity: paymentEntity }) }),
});
export interface ExpectedPayment { merchantAccountId: string; orderId: string; amountPaise: number; bookingId: string }
/** Internal normalized evidence only; never expose this as a client success endpoint. */
export function parseVerifiedCapture(raw: Uint8Array, signature: string, eventId: string, secret: string, expected: ExpectedPayment) {
  if (!verifyRazorpaySignature(raw, signature, secret)) throw new Error('Webhook signature rejected');
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(eventId)) throw new Error('Missing or invalid provider event identity');
  const event = capturedEvent.parse(JSON.parse(new TextDecoder().decode(raw)));
  const payment = event.payload.payment.entity;
  if (event.account_id !== expected.merchantAccountId || payment.order_id !== expected.orderId || payment.amount !== expected.amountPaise || !expected.bookingId) throw new Error('Payment does not match authorized merchant, order, amount and booking');
  return { eventId, bookingId: expected.bookingId, paymentId: payment.id, amountPaise: payment.amount, currency: 'INR' as const, verified: true as const };
}
