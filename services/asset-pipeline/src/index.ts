/** Conservative local GLB admission checks; not a substitute for a DCC geometry/quality review. */
export const MAX_GLB_BYTES = 50 * 1024 * 1024;
type Entry = Record<string, any>;
export interface GlbInspection { json: Entry; binaryBytes: number; meshCount: number; materialCount: number; }
export function inspectGlb(bytes: ArrayBuffer): GlbInspection {
  const fail = (reason: string): never => { throw new Error(`Invalid GLB: ${reason}`); };
  if (bytes.byteLength < 20 || bytes.byteLength > MAX_GLB_BYTES) fail('size must be between 20 bytes and 50 MiB');
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) fail('header');
  let offset = 12; let json: Entry | undefined; let binaryBytes = 0; let chunks = 0;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) fail('truncated chunk');
    const length = view.getUint32(offset, true); const type = view.getUint32(offset + 4, true); offset += 8;
    if (length % 4 || offset + length > bytes.byteLength) fail('chunk bounds or alignment');
    if (chunks === 0 && type !== 0x4e4f534a) fail('first chunk must be JSON');
    if (type === 0x4e4f534a) {
      if (json || chunks !== 0) fail('duplicate JSON');
      try { json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes, offset, length))); } catch { fail('JSON'); }
    } else if (type === 0x004e4942 && chunks === 1) binaryBytes = length;
    else fail('unsupported chunk');
    chunks++; offset += length;
  }
  if (!json || typeof json !== 'object' || Array.isArray(json) || json.asset?.version !== '2.0') fail('asset version');
  const doc = json as Entry;
  const arrays = ['buffers', 'bufferViews', 'accessors', 'meshes', 'materials', 'nodes', 'scenes', 'animations', 'textures', 'images', 'samplers'];
  for (const key of arrays) if (doc[key] !== undefined && !Array.isArray(doc[key])) fail(`${key} must be an array`);
  const list = (key: string): Entry[] => doc[key] ?? [];
  const ref = (key: string, index: unknown) => { if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= list(key).length) fail(`${key} reference`); };
  const optionalRef = (key: string, index: unknown) => { if (index !== undefined) ref(key, index); };
  const integer = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  // Reject all URI resources, including data URIs, and extensions that can introduce external resources.
  const walk = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'uri') fail('URI resources are prohibited; use embedded BIN resources');
      if (key === 'extensions' && child && Object.keys(child).length) fail('extensions are not admitted by this baseline loader');
      walk(child);
    }
  }; walk(doc);
  if (doc.extensionsRequired?.length || doc.extensionsUsed?.length) fail('extensions are unsupported');
  if (list('buffers').length !== 1) fail('exactly one embedded buffer is required');
  const bufferLength = list('buffers')[0]?.byteLength;
  if (!integer(bufferLength) || bufferLength > binaryBytes || binaryBytes - bufferLength > 3) fail('embedded buffer length');
  for (const b of list('bufferViews')) {
    ref('buffers', b.buffer);
    if (!integer(b.byteLength) || !integer(b.byteOffset ?? 0) || (b.byteOffset ?? 0) + b.byteLength > bufferLength) fail('buffer view bounds');
    if (b.byteStride !== undefined && (!integer(b.byteStride) || b.byteStride < 4 || b.byteStride > 252 || b.byteStride % 4)) fail('buffer stride');
  }
  const componentBytes: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const components: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  for (const a of list('accessors')) {
    if (a.sparse) fail('sparse accessors unsupported');
    ref('bufferViews', a.bufferView);
    const width = componentBytes[a.componentType] * components[a.type]; const b = list('bufferViews')[a.bufferView];
    if (!width || !integer(a.count) || a.count < 1 || !integer(a.byteOffset ?? 0) || (b.byteStride ?? width) < width || (a.byteOffset ?? 0) + (a.count - 1) * (b.byteStride ?? width) + width > b.byteLength) fail('accessor layout');
  }
  if (!list('meshes').length) fail('no meshes');
  for (const m of list('meshes')) {
    if (!Array.isArray(m.primitives) || !m.primitives.length) fail('mesh primitives');
    for (const p of m.primitives) {
      if (!p.attributes || typeof p.attributes !== 'object' || p.attributes.POSITION === undefined) fail('primitive POSITION');
      for (const index of Object.values(p.attributes)) ref('accessors', index);
      const position = list('accessors')[p.attributes.POSITION];
      if (position.type !== 'VEC3' || position.componentType !== 5126) fail('POSITION must be float VEC3');
      if (p.mode !== undefined && (!integer(p.mode) || p.mode > 6)) fail('primitive mode');
      optionalRef('accessors', p.indices); optionalRef('materials', p.material);
      if (p.indices !== undefined) { const index = list('accessors')[p.indices]; if (index.type !== 'SCALAR' || ![5121, 5123, 5125].includes(index.componentType)) fail('index accessor'); }
      if (p.targets) for (const target of p.targets) for (const index of Object.values(target)) ref('accessors', index);
    }
  }
  for (const n of list('nodes')) { optionalRef('meshes', n.mesh); if (n.skin !== undefined) fail('skinned meshes unsupported'); for (const c of n.children ?? []) ref('nodes', c); }
  const visiting = new Set<number>(); const visited = new Set<number>(); const parents = new Set<number>();
  const visit = (i: number): void => { if (visiting.has(i)) fail('cyclic nodes'); if (visited.has(i)) return; visiting.add(i); for (const c of list('nodes')[i].children ?? []) { if (parents.has(c)) fail('multiple node parents'); parents.add(c); visit(c); } visiting.delete(i); visited.add(i); };
  list('nodes').forEach((_, i) => visit(i));
  if (!list('scenes').length || !list('nodes').length) fail('scene and nodes required');
  for (const s of list('scenes')) for (const n of s.nodes ?? []) ref('nodes', n);
  optionalRef('scenes', doc.scene);
  for (const image of list('images')) { ref('bufferViews', image.bufferView); if (!['image/png', 'image/jpeg'].includes(image.mimeType)) fail('image MIME'); }
  for (const t of list('textures')) { ref('images', t.source); optionalRef('samplers', t.sampler); }
  for (const m of list('materials')) {
    for (const tex of [m.normalTexture, m.occlusionTexture, m.emissiveTexture, m.pbrMetallicRoughness?.baseColorTexture, m.pbrMetallicRoughness?.metallicRoughnessTexture]) if (tex) ref('textures', tex.index);
  }
  for (const a of list('animations')) {
    if (!Array.isArray(a.samplers) || !Array.isArray(a.channels)) fail('animation structure');
    for (const s of a.samplers) { ref('accessors', s.input); ref('accessors', s.output); }
    for (const c of a.channels) {
      if (!integer(c.sampler) || c.sampler >= a.samplers.length) fail('animation sampler');
      ref('nodes', c.target?.node); if (!['translation', 'rotation', 'scale', 'weights'].includes(c.target?.path)) fail('animation target');
    }
  }
  return { json: doc, binaryBytes, meshCount: list('meshes').length, materialCount: list('materials').length };
}
export function exportCapabilities(source: { format: 'glb' | 'gltf' | 'step'; originalAvailable: boolean; redistributionAllowed: boolean }) {
  const allowed = source.originalAvailable && source.redistributionAllowed;
  return { glb: allowed && source.format === 'glb', gltf: allowed && source.format === 'gltf', step: allowed && source.format === 'step', conversionImplemented: false as const };
}
