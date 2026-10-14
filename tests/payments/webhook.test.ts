import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { parseVerifiedCapture, verifyRazorpaySignature } from '../../services/payments/src/webhook';
const secret = 'test-only-synthetic-webhook-secret';
const expected = { merchantAccountId:'acc_test', orderId:'order_test', amountPaise:10000, bookingId:'booking_test' };
const raw = Buffer.from(JSON.stringify({event:'payment.captured',account_id:'acc_test',payload:{payment:{entity:{id:'pay_test',order_id:'order_test',amount:10000,currency:'INR',status:'captured',captured:true}}}}));
const sign = (bytes:Uint8Array) => createHmac('sha256',secret).update(bytes).digest('hex');
describe('sandbox webhook authentication boundary',()=>{
 it('validates raw signed bytes and recipient/order/amount mapping',()=>{
  expect(parseVerifiedCapture(raw,sign(raw),'evt_test',secret,expected)).toMatchObject({verified:true,bookingId:'booking_test',amountPaise:10000});
 });
 it('rejects tampering, wrong secrets and malformed signature without throwing timing errors',()=>{
  expect(verifyRazorpaySignature(Buffer.concat([raw,Buffer.from(' ')]),sign(raw),secret)).toBe(false);
  expect(verifyRazorpaySignature(raw,sign(raw),'different-test-secret')).toBe(false);
  expect(verifyRazorpaySignature(raw,'abc',secret)).toBe(false);
  expect(verifyRazorpaySignature(raw,'z'.repeat(64),secret)).toBe(false);
 });
 it('rejects mismatched amounts, merchant accounts and orders despite valid signatures',()=>{
  for(const mismatch of [{amountPaise:1},{merchantAccountId:'attacker'},{orderId:'another'}]) expect(()=>parseVerifiedCapture(raw,sign(raw),'evt_test',secret,{...expected,...mismatch})).toThrow('does not match');
 });
 it('rejects authorized-only events and missing event identity',()=>{
  const authorized=Buffer.from(raw.toString().replace('payment.captured','payment.authorized'));
  expect(()=>parseVerifiedCapture(authorized,sign(authorized),'evt_test',secret,expected)).toThrow();
  expect(()=>parseVerifiedCapture(raw,sign(raw),'',secret,expected)).toThrow();
 });
});
