import { catalogueVariantSchema, customerNeedsSchema, inventorySchema, type CatalogueVariant, type CustomerNeeds, type Inventory } from '@autoai/validation';
export type { CatalogueVariant, CustomerNeeds, Inventory, Provenance } from '@autoai/validation';

export interface VehicleOption { id: string; requires?: string[]; excludes?: string[] }
export function validateConfiguration(variant: CatalogueVariant, selected: string[], options: VehicleOption[]) {
  catalogueVariantSchema.parse(variant);
  const errors: string[] = [];
  if (new Set(selected).size !== selected.length) errors.push('Duplicate options are not allowed');
  for (const id of selected) {
    const option = options.find(o => o.id === id);
    if (!option || !variant.compatibleOptionIds.includes(id)) { errors.push(`Option ${id} is not compatible with this variant`); continue; }
    for (const required of option.requires ?? []) if (!selected.includes(required)) errors.push(`${id} requires ${required}`);
    for (const excluded of option.excludes ?? []) if (selected.includes(excluded)) errors.push(`${id} excludes ${excluded}`);
  }
  return { valid: errors.length === 0, errors };
}
function nonnegative(value: number, label: string) { if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite nonnegative number`); }
const round = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
export function estimateEmi(principalInr: number, annualRatePercent: number, months: number) {
  nonnegative(principalInr, 'Principal'); nonnegative(annualRatePercent, 'Interest rate');
  if (!Number.isInteger(months) || months < 1 || months > 600) throw new Error('Term must be 1–600 whole months');
  if (annualRatePercent > 100) throw new Error('Interest rate must not exceed 100%');
  const r = annualRatePercent / 1200;
  const monthly = r === 0 ? principalInr / months : principalInr * r / (1 - (1 + r) ** -months);
  return { monthlyInr: round(monthly), totalInr: round(monthly * months), interestInr: round(monthly * months - principalInr), disclaimer: 'Illustrative reducing-balance estimate; lender fees and terms excluded.' };
}
export interface OwnershipInputs { purchaseInr: number; registrationInr: number; annualInsuranceInr: number; annualMaintenanceInr: number; annualKm: number; energyCostPerKmInr: number; years: number; resaleInr: number; financeInterestInr?: number }
export function estimateOwnership(input: OwnershipInputs) {
  for (const [key, value] of Object.entries(input)) nonnegative(value, key);
  if (!Number.isInteger(input.years) || input.years < 1 || input.years > 30) throw new Error('Years must be 1–30');
  if (input.resaleInr > input.purchaseInr) throw new Error('Resale assumption exceeds purchase price');
  const runningInr = input.years * (input.annualInsuranceInr + input.annualMaintenanceInr + input.annualKm * input.energyCostPerKmInr);
  const totalInr = input.purchaseInr + input.registrationInr + runningInr + (input.financeInterestInr ?? 0) - input.resaleInr;
  return { totalInr: round(totalInr), monthlyInr: round(totalInr / (12 * input.years)), runningInr: round(runningInr), assumptions: { ...input }, disclaimer: 'Scenario estimate based on supplied assumptions, not a dealer quote or guaranteed resale value.' };
}
/** Hard constraints exclude candidates; preference points never override affordability. */
export interface CatalogueFreshnessPolicy { now?: Date; maxAgeDays?: number }
export function recommendVehicles(candidates: unknown[], needsInput: CustomerNeeds, policy: CatalogueFreshnessPolicy = {}) {
  const now = policy.now ?? new Date();
  const maxAgeDays = policy.maxAgeDays ?? 90;
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(maxAgeDays) || maxAgeDays <= 0) throw new Error('Invalid catalogue freshness policy');
  const needs = customerNeedsSchema.parse(needsInput);
  return candidates.flatMap(candidate => {
    const parsed = catalogueVariantSchema.safeParse(candidate);
    if (!parsed.success) return [];
    const v = parsed.data;
    const age = now.getTime() - Date.parse(v.provenance.verifiedAt);
    if (age < 0 || age > maxAgeDays * 86400000) return [];
    if (v.exShowroomInr > needs.budgetInr || v.seats < needs.minimumSeats || needs.requiredFeatures.some(f => !v.features.includes(f))) return [];
    let score = 50;
    const explanations = ['Verified source reviewed by ' + v.provenance.verifiedBy, 'Ex-showroom price fits your budget; taxes, insurance and fees are extra', `Meets minimum ${needs.minimumSeats} seats`];
    for (const [preference, actual, label] of [[needs.preferredFuel, v.fuel, 'fuel'], [needs.preferredTransmission, v.transmission, 'transmission'], [needs.preferredBodyStyle, v.bodyStyle, 'body style']] as const) {
      if (preference && preference === actual) { score += 15; explanations.push(`Matches preferred ${label}: ${actual}`); }
      else if (preference) explanations.push(`Tradeoff: ${actual} ${label} differs from ${preference}`);
    }
    score += 5 * (1 - v.exShowroomInr / needs.budgetInr);
    return [{ variant: v, score: round(score), explanations }];
  }).sort((a, b) => b.score - a.score || a.variant.id.localeCompare(b.variant.id));
}
export interface InventoryRequest { variantId: string; city: string; colourId?: string; optionIds?: string[]; neededBy: string }
export function matchInventory(stock: unknown[], request: InventoryRequest, now: Date = new Date(), maxAgeHours = 24) {
  const neededBy = Date.parse(request.neededBy);
  if (!Number.isFinite(neededBy) || neededBy < now.getTime() || !Number.isFinite(maxAgeHours) || maxAgeHours <= 0) throw new Error('Invalid delivery deadline or freshness window');
  return stock.flatMap(row => {
    const parsed = inventorySchema.safeParse(row);
    if (!parsed.success) return [];
    const i = parsed.data;
    const age = now.getTime() - Date.parse(i.checkedAt);
    if (i.status !== 'available' || age < 0 || age > maxAgeHours * 3600000 || Date.parse(i.availableFrom) > neededBy || i.variantId !== request.variantId || i.city.toLowerCase() !== request.city.toLowerCase() || (request.colourId && i.colourId !== request.colourId) || request.optionIds?.some(id => !i.optionIds.includes(id))) return [];
    return [{ inventory: i, explanation: 'Verified available stock matches configuration and stated availability date. Dealer confirmation is required before a delivery commitment.' }];
  });
}
export type BookingStatus = 'draft' | 'awaiting-payment' | 'confirmed' | 'fulfilment' | 'delivered' | 'cancelled' | 'refund-pending' | 'refunded';
export type BookingRole = 'customer' | 'dealer' | 'admin' | 'payment-service';
export type BookingEvent = 'submit' | 'payment-confirmed' | 'start-fulfilment' | 'deliver' | 'cancel' | 'request-refund' | 'refund-confirmed';
export interface PaymentEvidence { verified: boolean; eventId: string; bookingId: string; paymentId: string; amountPaise: number; currency: 'INR' }
export interface Booking { id: string; status: BookingStatus; amountPaise: number; paymentId?: string; processedEventIds: string[] }
export function transitionBooking(booking: Booking, event: BookingEvent, role: BookingRole, evidence?: PaymentEvidence): Booking {
  const transitions: Partial<Record<BookingStatus, Partial<Record<BookingEvent, { to: BookingStatus; roles: BookingRole[] }>>>> = {
    draft: { submit: { to: 'awaiting-payment', roles: ['customer', 'admin'] }, cancel: { to: 'cancelled', roles: ['customer', 'admin'] } },
    'awaiting-payment': { 'payment-confirmed': { to: 'confirmed', roles: ['payment-service'] }, cancel: { to: 'cancelled', roles: ['customer', 'admin'] } },
    confirmed: { 'start-fulfilment': { to: 'fulfilment', roles: ['dealer', 'admin'] }, cancel: { to: 'refund-pending', roles: ['customer', 'admin'] } },
    fulfilment: { deliver: { to: 'delivered', roles: ['dealer', 'admin'] }, cancel: { to: 'refund-pending', roles: ['admin'] } },
    delivered: { 'request-refund': { to: 'refund-pending', roles: ['admin'] } },
    cancelled: { 'payment-confirmed': { to: 'refund-pending', roles: ['payment-service'] } },
    'refund-pending': { 'refund-confirmed': { to: 'refunded', roles: ['payment-service'] } },
  };
  const isPayment = event === 'payment-confirmed' || event === 'refund-confirmed';
  if (isPayment) {
    if (role !== 'payment-service' || !evidence?.verified || !evidence.eventId || !evidence.paymentId || evidence.bookingId !== booking.id || evidence.currency !== 'INR' || !Number.isSafeInteger(evidence.amountPaise) || evidence.amountPaise <= 0 || evidence.amountPaise !== booking.amountPaise) throw new Error('Verified matching payment evidence is required');
    if (booking.paymentId && booking.paymentId !== evidence.paymentId) throw new Error('Payment identity mismatch');
    if (booking.processedEventIds.includes(evidence.eventId)) return booking;
  }
  const rule = transitions[booking.status]?.[event];
  if (!rule || !rule.roles.includes(role)) throw new Error(`Forbidden booking transition: ${booking.status} / ${event} / ${role}`);
  return { ...booking, status: rule.to, ...(isPayment && evidence ? { paymentId: evidence.paymentId, processedEventIds: [...booking.processedEventIds, evidence.eventId] } : {}) };
}
