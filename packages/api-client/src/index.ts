import { z } from 'zod';
import { catalogueVariantSchema, type CustomerNeeds } from '@autoai/validation';
import { recommendVehicles, type CatalogueFreshnessPolicy } from '@autoai/automotive-domain';

export const apiVehicleSchema = z.object({
  id: z.string().min(1), make: z.string().min(1), model: z.string().min(1), variant: z.string().min(1),
  fuel: z.enum(['petrol', 'diesel', 'electric', 'hybrid', 'cng']), bodyType: z.string(),
  pricePaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), sourceUrl: z.string().url(),
  verifiedAt: z.string().datetime(), specifications: z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()])),
});
export type ApiVehicle = z.infer<typeof apiVehicleSchema>;
export interface ApiUser { id: string; email: string; name: string; role: 'customer' | 'dealer' | 'admin' }
export interface ApiBooking { id: string; status: string; pricePaise: number; createdAt?: string; make?: string; model?: string; variant?: string }
export interface ApiOffer { id: string; vehicle_id: string; dealer_id: string; price_paise: number; stock: number; source_url: string; verified_at: string; expires_at: string }
export interface CatalogueResponse { vehicles: ApiVehicle[] }
export interface VehicleResponse { vehicle: ApiVehicle; offers: ApiOffer[] }
export interface BookingsResponse { bookings: ApiBooking[] }
export interface AdvisorExclusion { id: string | null; reason: 'invalid-api-record' | 'missing-specifications' | 'invalid-provenance-or-specifications' | 'stale-verification' | 'does-not-meet-needs'; detail: string }
function stringArray(value: unknown): string[] | undefined {
  if (typeof value !== 'string') return undefined;
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) && parsed.every(v => typeof v === 'string' && v.length > 0) ? parsed : undefined; } catch { return undefined; }
}
/** Flat API specification maps encode array fields as JSON strings. No vehicle facts are inferred. */
export function recommendFromApiVehicles(rows: unknown[], needs: CustomerNeeds, policy: CatalogueFreshnessPolicy = {}) {
  const candidates: unknown[] = [];
  const excluded: AdvisorExclusion[] = [];
  const now = policy.now ?? new Date();
  const maxAgeDays = policy.maxAgeDays ?? 90;
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(maxAgeDays) || maxAgeDays <= 0) throw new Error('Invalid catalogue freshness policy');
  for (const row of rows) {
    const parsed = apiVehicleSchema.safeParse(row);
    if (!parsed.success) { excluded.push({ id: null, reason: 'invalid-api-record', detail: 'Required API vehicle fields are invalid or missing' }); continue; }
    const v = parsed.data;
    const specs = v.specifications;
    const features = stringArray(specs.features);
    const compatibleOptionIds = stringArray(specs.compatibleOptionIds);
    const required = ['seats', 'transmission', 'sourceType', 'retrievedAt', 'verifiedBy'] as const;
    const missing: string[] = required.filter(key => specs[key] === undefined);
    if (!features) missing.push('features (JSON string array)');
    if (!compatibleOptionIds) missing.push('compatibleOptionIds (JSON string array)');
    if (missing.length) { excluded.push({ id: v.id, reason: 'missing-specifications', detail: `Missing reviewed fields: ${missing.join(', ')}` }); continue; }
    const candidate = catalogueVariantSchema.safeParse({
      id: v.id, manufacturer: v.make, model: v.model, name: v.variant, fuel: v.fuel, bodyStyle: v.bodyType,
      exShowroomInr: v.pricePaise / 100, seats: specs.seats, transmission: specs.transmission, features, compatibleOptionIds,
      provenance: { sourceUrl: v.sourceUrl, sourceType: specs.sourceType, retrievedAt: specs.retrievedAt, verifiedAt: v.verifiedAt, verifiedBy: specs.verifiedBy, status: 'verified' },
    });
    if (!candidate.success) { excluded.push({ id: v.id, reason: 'invalid-provenance-or-specifications', detail: candidate.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') }); continue; }
    const age = now.getTime() - Date.parse(v.verifiedAt);
    if (age < 0 || age > maxAgeDays * 86400000) { excluded.push({ id: v.id, reason: 'stale-verification', detail: `Verification must be within ${maxAgeDays} days of evaluation` }); continue; }
    candidates.push(candidate.data);
  }
  const recommendations = recommendVehicles(candidates, needs, policy);
  const matchedIds = new Set(recommendations.map(r => r.variant.id));
  for (const candidate of candidates as { id: string }[]) if (!matchedIds.has(candidate.id)) excluded.push({ id: candidate.id, reason: 'does-not-meet-needs', detail: 'Exceeds budget or does not meet required seats/features' });
  return { recommendations, excludedCount: excluded.length, exclusions: excluded, freshnessPolicy: { maxAgeDays, evaluatedAt: now.toISOString() } };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: 'http' | 'network' | 'invalid-response';
  constructor(message: string, status: number, code: 'http' | 'network' | 'invalid-response') { super(message); this.name = 'ApiError'; this.status = status; this.code = code; }
}
export interface ApiClientOptions { baseUrl: string; fetch?: typeof fetch; }
/** Platform-neutral transport using the API cookie session. Native callers must supply a cookie-capable fetch. */
export function createApiClient(options: ApiClientOptions) {
  const base = new URL(options.baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('API base URL must be an HTTP(S) URL without credentials');
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) throw new Error('Remote APIs require HTTPS');
  const fetcher = options.fetch ?? globalThis.fetch;
  if (!fetcher) throw new Error('A fetch implementation is required');
  async function request<T>(path: string, init: RequestInit = {}, schema?: z.ZodType<T>): Promise<T> {
    if (!path.startsWith('/api/') || path.includes('..') || path.includes('\\') || path.includes('#')) throw new Error('Only local /api/ paths are allowed');
    const url = new URL(path, base);
    if (url.origin !== base.origin || !url.pathname.startsWith('/api/')) throw new Error('Cross-origin or escaped API paths are forbidden');
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body) headers.set('Content-Type', 'application/json');
    let response: Response;
    try { response = await fetcher(url.toString(), { ...init, headers, credentials: 'include', redirect: 'error' }); }
    catch { throw new ApiError('Unable to reach the API', 0, 'network'); }
    let data: unknown;
    try { data = await response.json(); } catch { throw new ApiError('The API returned an invalid response', response.status, 'invalid-response'); }
    if (!response.ok) {
      // Do not surface untrusted server bodies containing secrets or stack traces.
      throw new ApiError(response.status === 401 ? 'Sign in to continue' : response.status === 403 ? 'Access denied' : response.status === 409 ? 'The request conflicts with current availability or state' : 'The API request failed', response.status, 'http');
    }
    if (schema) { const result = schema.safeParse(data); if (!result.success) throw new ApiError('The API response does not match its contract', response.status, 'invalid-response'); return result.data; }
    return data as T;
  }
  return {
    request,
    catalogue: (filters: { query?: string; fuel?: string; bodyType?: string } = {}) => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value !== undefined) params.set(key, value);
      return request<CatalogueResponse>(`/api/catalogue?${params}`, {}, z.object({ vehicles: z.array(apiVehicleSchema) }));
    },
    vehicle: (id: string) => request<VehicleResponse>(`/api/catalogue/${encodeURIComponent(id)}`),
    me: () => request<{ user: ApiUser }>('/api/auth/me'),
    bookings: () => request<BookingsResponse>('/api/bookings'),
    requestBooking: (offerId: string, idempotencyKey: string) => {
      if (typeof idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(idempotencyKey)) return Promise.reject(new Error('Idempotency key must be 8–128 letters, digits, underscores or hyphens'));
      return request<{ booking: ApiBooking; message?: string; replayed?: boolean }>('/api/bookings', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ offerId }) });
    },
    logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  };
}
