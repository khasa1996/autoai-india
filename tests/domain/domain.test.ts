import { describe, expect, it } from 'vitest';
import { catalogueVariantSchema } from '@autoai/validation';
import { estimateEmi, estimateOwnership, recommendVehicles, validateConfiguration, matchInventory, transitionBooking, type Booking } from '@autoai/automotive-domain';
import { languages, translate } from '@autoai/i18n';
// Synthetic fixtures exclusively for tests. These are not actual vehicle claims or sale stock.
const provenance = { sourceUrl: 'https://manufacturer.example.test/spec', sourceType: 'manufacturer' as const, retrievedAt: '2026-01-01T00:00:00Z', verifiedAt: new Date(Date.now() - 86400000).toISOString(), verifiedBy: 'synthetic-test-reviewer', status: 'verified' as const };
const vehicle = { id: 'synthetic-1', manufacturer: 'Test Manufacturer', model: 'Synthetic Model', name: 'Test Variant', bodyStyle: 'suv' as const, fuel: 'electric' as const, transmission: 'automatic' as const, seats: 5, exShowroomInr: 1000000, features: ['test-feature'], compatibleOptionIds: ['a', 'b', 'c'], provenance };
const needs = { budgetInr: 1200000, minimumSeats: 5, preferredFuel: 'electric' as const, requiredFeatures: [] };
const booking: Booking = { id: 'b1', status: 'awaiting-payment', amountPaise: 10000, processedEventIds: [] };
const evidence = { verified: true, eventId: 'event-1', bookingId: 'b1', paymentId: 'pay-1', amountPaise: 10000, currency: 'INR' as const };
describe('verified catalogue and recommendations', () => {
  it('rejects missing or unverified provenance', () => {
    expect(catalogueVariantSchema.safeParse({ ...vehicle, provenance: undefined }).success).toBe(false);
    expect(recommendVehicles([{ ...vehicle, provenance: { ...provenance, status: 'pending' } }], needs)).toEqual([]);
  });
  it('never lets preferences override hard constraints', () => {
    expect(recommendVehicles([vehicle], { ...needs, budgetInr: 900000 })).toEqual([]);
    expect(recommendVehicles([vehicle], { ...needs, requiredFeatures: ['missing'] })).toEqual([]);
    expect(recommendVehicles([vehicle], { ...needs, minimumSeats: 7 })).toEqual([]);
  });
  it('explains matches with source and price caveats', () => {
    const [result] = recommendVehicles([vehicle], needs);
    expect(result?.score).toBeGreaterThan(50);
    expect(result?.explanations.join(' ')).toContain('taxes, insurance and fees');
  });
  it('enforces option requirements and exclusions', () => {
    const options = [{ id: 'a', requires: ['b'], excludes: ['c'] }, { id: 'b' }, { id: 'c' }];
    expect(validateConfiguration(vehicle, ['a'], options).valid).toBe(false);
    expect(validateConfiguration(vehicle, ['a', 'b'], options).valid).toBe(true);
    expect(validateConfiguration(vehicle, ['a', 'b', 'c'], options).valid).toBe(false);
  });
});
describe('estimates', () => {
  it('handles zero interest and a standard reducing-balance loan', () => {
    expect(estimateEmi(120000, 0, 12).monthlyInr).toBe(10000);
    expect(estimateEmi(1000000, 9, 60).monthlyInr).toBeCloseTo(20758.36, 2);
    expect(() => estimateEmi(1, -1, 12)).toThrow();
    expect(() => estimateEmi(1, 1, 0)).toThrow();
  });
  it('keeps ownership assumptions explicit', () => {
    const result = estimateOwnership({ purchaseInr: 1000000, registrationInr: 100000, annualInsuranceInr: 20000, annualMaintenanceInr: 10000, annualKm: 10000, energyCostPerKmInr: 2, years: 5, resaleInr: 400000 });
    expect(result.totalInr).toBe(950000);
    expect(result.assumptions.years).toBe(5);
  });
});
describe('inventory feasibility', () => {
  const now = new Date('2026-01-03T12:00:00Z');
  const row = { id: 'stock-test', dealerId: 'dealer-test', variantId: vehicle.id, city: 'Pune', colourId: 'blue', optionIds: ['a'], status: 'available', availableFrom: '2026-01-03T00:00:00Z', checkedAt: '2026-01-03T10:00:00Z', provenance: { ...provenance, verifiedAt: '2026-01-02T00:00:00Z' } };
  const request = { variantId: vehicle.id, city: 'pune', neededBy: '2026-01-04T00:00:00Z', optionIds: ['a'] };
  it('requires verified fresh available matching stock', () => {
    expect(matchInventory([row], request, now)).toHaveLength(1);
    expect(matchInventory([{ ...row, status: 'sold' }, { ...row, checkedAt: '2026-01-01T00:00:00Z' }, { ...row, availableFrom: '2026-02-01T00:00:00Z' }], request, now)).toHaveLength(0);
    expect(matchInventory([row], { ...request, colourId: 'red' }, now)).toHaveLength(0);
  });
});
describe('booking lifecycle', () => {
  it('rejects client confirmation and unverified payment events', () => {
    expect(() => transitionBooking(booking, 'payment-confirmed', 'customer', evidence)).toThrow();
    expect(() => transitionBooking(booking, 'payment-confirmed', 'payment-service', { ...evidence, verified: false })).toThrow();
    expect(() => transitionBooking(booking, 'payment-confirmed', 'payment-service', { ...evidence, amountPaise: 1 })).toThrow();
  });
  it('deduplicates provider events and preserves refund accounting', () => {
    const paid = transitionBooking(booking, 'payment-confirmed', 'payment-service', evidence);
    expect(paid.status).toBe('confirmed');
    expect(transitionBooking(paid, 'payment-confirmed', 'payment-service', evidence)).toBe(paid);
    const cancelled = transitionBooking(paid, 'cancel', 'customer');
    expect(cancelled.status).toBe('refund-pending');
    const refunded = transitionBooking(cancelled, 'refund-confirmed', 'payment-service', { ...evidence, eventId: 'refund-1' });
    expect(refunded.status).toBe('refunded');
    expect(() => transitionBooking(refunded, 'deliver', 'dealer')).toThrow();
  });
  it('sends a late captured payment on a cancelled booking to refund', () => {
    const cancelled = transitionBooking(booking, 'cancel', 'customer');
    expect(transitionBooking(cancelled, 'payment-confirmed', 'payment-service', evidence).status).toBe('refund-pending');
  });
});
describe('language support is honest', () => {
  it('registers all scheduled languages plus English', () => expect(new Set(languages.map(l => l.code)).size).toBe(23));
  it('returns real Hindi and explicit fallback for untranslated languages', () => {
    expect(translate('compare', 'hi').text).toBe('तुलना करें');
    expect(translate('compare', 'hi').reviewStatus).toBe('awaiting-native-review');
    expect(translate('compare', 'ta')).toMatchObject({ text: 'Compare', fallback: true, resolvedLanguage: 'en' });
  });
});
