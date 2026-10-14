import { describe, it, expect, vi } from 'vitest';
import { createApiClient, ApiError, recommendFromApiVehicles } from '../../packages/api-client/src/index';
import { catalogueVariantSchema } from '@autoai/validation';
import { recommendVehicles } from '@autoai/automotive-domain';
const now = new Date();
const yesterday = new Date(now.getTime() - 86400000).toISOString();
const twoDaysAgo = new Date(now.getTime() - 172800000).toISOString();
// Synthetic test data, never served or seeded.
const row = { id: 'synthetic', make: 'Test', model: 'Synthetic', variant: 'Fixture', fuel: 'electric', bodyType: 'suv', pricePaise: 100000000, sourceUrl: 'https://manufacturer.example.test/spec', verifiedAt: yesterday, specifications: { seats: 5, transmission: 'automatic', features: '["airbags"]', compatibleOptionIds: '[]', sourceType: 'manufacturer', retrievedAt: twoDaysAgo, verifiedBy: 'fixture-reviewer' } };
const needs = { budgetInr: 1200000, minimumSeats: 5, requiredFeatures: ['airbags'] };
describe('API advisor adapter', () => {
  it('maps price units and explicit reviewed facts', () => {
    const result = recommendFromApiVehicles([row], needs);
    expect(result.excludedCount).toBe(0);
    expect(result.recommendations[0]?.variant.exShowroomInr).toBe(1000000);
    expect(result.recommendations[0]?.variant.seats).toBe(5);
  });
  it('does not infer missing facts or reviewer identity', () => {
    const result = recommendFromApiVehicles([{ ...row, specifications: {} }], needs);
    expect(result.recommendations).toEqual([]);
    expect(result.exclusions[0]?.reason).toBe('missing-specifications');
    expect(result.exclusions[0]?.detail).toContain('verifiedBy');
  });
  it('does not coerce seat strings or unknown transmission values', () => {
    expect(recommendFromApiVehicles([{ ...row, specifications: { ...row.specifications, seats: '5' } }], needs).exclusions[0]?.reason).toBe('invalid-provenance-or-specifications');
    expect(recommendFromApiVehicles([{ ...row, specifications: { ...row.specifications, transmission: 'unknown' } }], needs).recommendations).toEqual([]);
  });
  it('rejects insecure sources and future verification', () => {
    expect(recommendFromApiVehicles([{ ...row, sourceUrl: 'http://manufacturer.example.test/spec' }], needs).recommendations).toEqual([]);
    expect(recommendFromApiVehicles([{ ...row, verifiedAt: new Date(now.getTime() + 86400000).toISOString() }], needs).recommendations).toEqual([]);
  });
  it('applies default and configurable freshness without inventing updates', () => {
    const old = { ...row, verifiedAt: new Date(now.getTime() - 91 * 86400000).toISOString(), specifications: { ...row.specifications, retrievedAt: new Date(now.getTime() - 92 * 86400000).toISOString() } };
    expect(recommendFromApiVehicles([old], needs).exclusions[0]?.reason).toBe('stale-verification');
    expect(recommendFromApiVehicles([old], needs, { maxAgeDays: 100 }).recommendations).toHaveLength(1);
    expect(() => recommendFromApiVehicles([], needs, { maxAgeDays: NaN })).toThrow();
  });
  it('counts unmet needs separately from invalid records', () => {
    const result = recommendFromApiVehicles([row, {}], { ...needs, minimumSeats: 7 });
    expect(result.excludedCount).toBe(2);
    expect(result.exclusions.map(e => e.reason)).toEqual(['invalid-api-record', 'does-not-meet-needs']);
  });
  it('preserves optional rich fields and validates asset rights', () => {
    const base = recommendFromApiVehicles([row], needs).recommendations[0]!.variant;
    const rich = catalogueVariantSchema.parse({ ...base, modelYear: 2026, generation: 'Synthetic generation', specificationGroups: { dimensions: { lengthMm: 4000 } }, assets: [{ url: 'https://assets.example.test/car.glb', kind: 'model-3d', alt: 'Synthetic test car', licence: { name: 'Test licence', attribution: 'Test author', sourceUrl: 'https://assets.example.test/licence', usageApproved: true } }] });
    expect(rich.country).toBe('IN');
    expect(rich.specificationGroups?.dimensions?.lengthMm).toBe(4000);
    expect(catalogueVariantSchema.safeParse({ ...rich, country: 'US' }).success).toBe(false);
    expect(catalogueVariantSchema.safeParse({ ...rich, assets: [{ ...rich.assets![0], licence: { ...rich.assets![0]!.licence, usageApproved: false } }] }).success).toBe(false);
    expect(recommendVehicles([rich], needs, { maxAgeDays: 0.1 })).toEqual([]);
  });
});
describe('portable fetch client', () => {
  it('rejects remote plain HTTP and credential URLs', () => {
    expect(() => createApiClient({ baseUrl: 'http://api.example.test' })).toThrow();
    expect(() => createApiClient({ baseUrl: 'https://user:pass@api.example.test' })).toThrow();
    expect(() => createApiClient({ baseUrl: 'http://localhost:4100' })).not.toThrow();
  });
  it('encodes filters, includes credentials, rejects redirects, validates catalogue', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ vehicles: [row] }), { status: 200 }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: mock });
    expect((await client.catalogue({ query: 'a&b' })).vehicles).toHaveLength(1);
    expect(mock.mock.calls[0]?.[0]).toBe('https://api.example.test/api/catalogue?query=a%26b');
    expect(mock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include', redirect: 'error' });
  });
  it('exposes sanitized typed errors and rejects invalid bodies', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ error: 'secret internal stack' }), { status: 403 })).mockResolvedValueOnce(new Response(JSON.stringify({ vehicles: [{}] }), { status: 200 }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: mock });
    await expect(client.catalogue()).rejects.toMatchObject({ name: 'ApiError', message: 'Access denied', status: 403 });
    await expect(client.catalogue()).rejects.toMatchObject({ code: 'invalid-response' });
  });
  it('rejects arbitrary external paths without issuing a request', async () => {
    const mock = vi.fn<typeof fetch>();
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: mock });
    await expect(client.request('//evil.example.test/api/')).rejects.toThrow();
    await expect(client.request('/api/../private')).rejects.toThrow();
    await expect(client.request('/api/%2e%2e/private')).rejects.toThrow();
    expect(mock).not.toHaveBeenCalled();
  });
  it('preserves the caller booking key unchanged across retries', async () => {
    const payload = { booking: { id: 'booking-test', status: 'requested', pricePaise: 10000 } };
    const mock = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('connection lost')).mockResolvedValueOnce(new Response(JSON.stringify({ ...payload, replayed: true }), { status: 200 }));
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: mock });
    const stableKey = 'intent_12345678';
    await expect(client.requestBooking('offer-test', stableKey)).rejects.toBeInstanceOf(ApiError);
    expect(await client.requestBooking('offer-test', stableKey)).toMatchObject({ replayed: true });
    expect(mock).toHaveBeenCalledTimes(2);
    for (const call of mock.mock.calls) {
      expect(new Headers(call[1]?.headers).get('Idempotency-Key')).toBe(stableKey);
      expect(call[1]?.body).toBe(JSON.stringify({ offerId: 'offer-test' }));
    }
  });
  it('rejects malformed or absent booking keys before network access', async () => {
    const mock = vi.fn<typeof fetch>();
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: mock });
    for (const key of ['', 'short', 'a'.repeat(129), 'bad key here', 'bad:key-123', undefined, null, 12345678]) {
      await expect(client.requestBooking('offer-test', key as string)).rejects.toThrow('Idempotency key');
    }
    expect(mock).not.toHaveBeenCalled();
  });
  it('maps transport failures to ApiError without leaking the underlying error', async () => {
    const client = createApiClient({ baseUrl: 'https://api.example.test', fetch: vi.fn<typeof fetch>().mockRejectedValue(new Error('secret')) });
    await expect(client.catalogue()).rejects.toBeInstanceOf(ApiError);
  });
});
