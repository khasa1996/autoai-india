import { z } from 'zod';

/** A review record is mandatory; ingestion is not equivalent to verification. */
export const provenanceSchema = z.object({
  sourceUrl: z.string().url().refine(url => new URL(url).protocol === 'https:', 'Source must use HTTPS'),
  sourceType: z.enum(['manufacturer', 'dealer', 'regulator']),
  retrievedAt: z.string().datetime(),
  verifiedAt: z.string().datetime(),
  verifiedBy: z.string().min(1),
  status: z.literal('verified'),
}).strict().refine(p => Date.parse(p.retrievedAt) <= Date.now() && Date.parse(p.verifiedAt) <= Date.now(), { message: 'Provenance dates cannot be in the future' }).refine(p => Date.parse(p.verifiedAt) >= Date.parse(p.retrievedAt), {
  message: 'Verification must follow retrieval', path: ['verifiedAt'],
});
export const moneySchema = z.number().finite().nonnegative();
export const catalogueVariantSchema = z.object({
  country: z.literal('IN').default('IN'),
  modelYear: z.number().int().min(1900).max(2200).optional(),
  generation: z.string().min(1).max(100).optional(),
  specificationGroups: z.record(z.string(), z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()]))).optional(),
  onRoadEstimate: z.object({
    city: z.string().min(1), totalInr: moneySchema.positive(), registrationInr: moneySchema, insuranceInr: moneySchema, otherFeesInr: moneySchema,
    assumptions: z.array(z.string().min(1)).min(1), provenance: provenanceSchema,
  }).strict().optional(),
  assets: z.array(z.object({
    url: z.string().url().refine(url => new URL(url).protocol === 'https:', 'Asset must use HTTPS'),
    kind: z.enum(['image', 'model-3d', 'brochure']), alt: z.string().min(1),
    licence: z.object({ name: z.string().min(1), attribution: z.string().min(1), sourceUrl: z.string().url(), usageApproved: z.literal(true) }).strict(),
  }).strict()).optional(),
  id: z.string().min(1), manufacturer: z.string().min(1), model: z.string().min(1), name: z.string().min(1),
  bodyStyle: z.enum(['hatchback', 'sedan', 'suv', 'mpv', 'coupe', 'pickup']),
  fuel: z.enum(['petrol', 'diesel', 'cng', 'electric', 'hybrid']),
  transmission: z.enum(['manual', 'automatic']),
  seats: z.number().int().min(1).max(20),
  exShowroomInr: moneySchema.positive(),
  rangeKm: z.number().finite().positive().optional(),
  features: z.array(z.string().min(1)),
  compatibleOptionIds: z.array(z.string().min(1)),
  provenance: provenanceSchema,
}).strict();
export type CatalogueVariant = z.input<typeof catalogueVariantSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export const inventorySchema = z.object({
  id: z.string().min(1), dealerId: z.string().min(1), variantId: z.string().min(1),
  city: z.string().min(1), colourId: z.string().min(1), optionIds: z.array(z.string()),
  status: z.enum(['available', 'reserved', 'sold', 'in-transit']),
  availableFrom: z.string().datetime(), checkedAt: z.string().datetime(),
  provenance: provenanceSchema,
}).strict();
export type Inventory = z.infer<typeof inventorySchema>;
export const customerNeedsSchema = z.object({
  budgetInr: moneySchema.positive(), minimumSeats: z.number().int().min(1).max(20),
  preferredFuel: catalogueVariantSchema.shape.fuel.optional(),
  preferredTransmission: catalogueVariantSchema.shape.transmission.optional(),
  preferredBodyStyle: catalogueVariantSchema.shape.bodyStyle.optional(),
  requiredFeatures: z.array(z.string()).default([]),
}).strict();
export type CustomerNeeds = z.infer<typeof customerNeedsSchema>;
