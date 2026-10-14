import { z } from 'zod';
const vector = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);
const name = z.string().min(1).max(128);
export const interactionManifestSchema = z.object({
  version: z.literal(1), assetId: name, assetSha256: z.string().regex(/^[a-f0-9]{64}$/),
  license: z.object({ name, source: z.string().min(1).max(2048), permittedUse: z.enum(['owned', 'licensed', 'public-domain']) }).strict(),
  paint: z.array(z.object({ id: name, meshNames: z.array(name).min(1), materialNames: z.array(name).min(1) }).strict()).max(100),
  articulations: z.array(z.object({
    id: name, meshName: name, pivot: vector, axis: vector.refine(v => Math.abs(Math.hypot(...v) - 1) < 0.0001, 'Axis must be unit length'),
    minRadians: z.number().finite().min(-Math.PI * 2).max(Math.PI * 2),
    maxRadians: z.number().finite().min(-Math.PI * 2).max(Math.PI * 2),
    closedRadians: z.number().finite(),
  }).strict().refine(a => a.minRadians <= a.closedRadians && a.closedRadians <= a.maxRadians, 'Closed angle must be within ordered limits')).max(100),
}).strict().superRefine((m, ctx) => {
  for (const values of [m.paint.map(p => p.id), m.articulations.map(a => a.id), m.articulations.map(a => a.meshName)]) {
    if (new Set(values).size !== values.length) ctx.addIssue({ code: 'custom', message: 'Duplicate IDs or articulation mesh names' });
  }
});
export type InteractionManifest = z.infer<typeof interactionManifestSchema>;
export const savedConfigurationSchema = z.object({
  version: z.literal(1), assetId: name, assetSha256: z.string().regex(/^[a-f0-9]{64}$/),
  paint: z.record(z.string(), z.string().regex(/^#[0-9a-fA-F]{6}$/)),
  articulations: z.record(z.string(), z.number().finite()),
}).strict();
export type SavedConfiguration = z.infer<typeof savedConfigurationSchema>;
export function validateConfiguration(input: unknown, manifest: InteractionManifest): SavedConfiguration {
  const config = savedConfigurationSchema.parse(input);
  if (config.assetId !== manifest.assetId || config.assetSha256 !== manifest.assetSha256) throw new Error('Configuration belongs to a different asset revision');
  for (const id of Object.keys(config.paint)) if (!manifest.paint.some(p => p.id === id)) throw new Error(`Unknown paint group: ${id}`);
  for (const [id, angle] of Object.entries(config.articulations)) {
    const part = manifest.articulations.find(a => a.id === id);
    if (!part || angle < part.minRadians || angle > part.maxRadians) throw new Error(`Invalid articulation: ${id}`);
  }
  return config;
}
