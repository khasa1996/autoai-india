# Local licensed vehicle viewer

This is a Three.js runtime library, not a supplied vehicle or a CAD converter. The application must obtain a legitimate GLB and its matching interaction manifest before displaying a vehicle. License metadata is an owner declaration, not automatic legal verification.

Browser-only usage:

```ts
import { VehicleViewer } from './src/index';
const viewer = new VehicleViewer(canvas);
await viewer.loadLocalFile(userSelectedFile, ownerProvidedManifest);
viewer.setCamera('threeQuarter');
viewer.setPaint('body', '#1255aa');
viewer.setArticulation('driver-door', 0.8);
const saved = viewer.save(); // plain JSON; persistence belongs to caller
viewer.restore(saved);
// On unmount:
viewer.dispose();
```

Import this library in a client-only component or dynamic import. Give the canvas an explicit CSS width and height. A ResizeObserver updates camera aspect and rendering resolution. No external model or environment URLs are fetched. Standard lights, a perspective camera and OrbitControls are provided; no ground geometry or vehicle placeholder is created. Camera presets assume Y up and +Z front. Verify source axes when preparing the GLB.

The matching manifest uses schema version 1:

```json
{
  "version": 1,
  "assetId": "owner-vehicle-revision-1",
  "assetSha256": "<64 lowercase hexadecimal SHA-256 characters of the actual GLB>",
  "license": { "name": "Your actual license", "source": "License provenance record", "permittedUse": "licensed" },
  "paint": [{ "id": "body", "meshNames": ["Body"], "materialNames": ["Paint"] }],
  "articulations": [{ "id": "driver-door", "meshName": "DriverDoor", "pivot": [0, 0, 0], "axis": [0, 1, 0], "minRadians": 0, "maxRadians": 1.2, "closedRadians": 0 }]
}
```

The sample is a schema illustration, not a manifest for an actual asset. Names must match unique Mesh objects and PBR material names after GLTFLoader imports the GLB. Pivot and unit axis are expressed in the target mesh parent's local coordinates. The source mesh pose represents `closedRadians`; runtime rotation is relative to it. Bake nonuniform parent scales in the authoring tool before creating articulated meshes. All moving parts must be separate explicitly named meshes. No geometry inference, animated deformation, or manufacturer dimensional accuracy is claimed. Independent animation clips are structurally checked but not played.

The admission helper accepts GLB 2 only, max 50 MiB, one embedded binary buffer, PNG/JPEG embedded images and uncompressed nonsparse geometry. It rejects URI resources (including data URIs), extensions, skinned meshes, invalid structural references, basic accessor bounds violations and cyclic/multiple-parent node hierarchies. Draco, KTX2, sparse accessors and extension-based materials must be prepared offline as supported baseline GLB. This conservative structural checker is not full Khronos validation, a malware sandbox, or a geometry-quality certificate. Validate trusted source assets with the Khronos validator and review image/geometry complexity before distribution.

Saved configurations are schema-validated against both asset ID and byte hash. Unknown controls, out-of-range angles and invalid colors fail before mutation. Restore resets unspecified paint groups and articulation angles to the original baseline. The owner manifest and source GLB should be versioned together.

`services/asset-pipeline/src/index.ts` exposes `inspectGlb` and `exportCapabilities`. The capability matrix enables only retrieval of an available, redistribution-permitted source in its original format. It does not implement any conversions or downloads. GLB/glTF meshes cannot produce STEP; a STEP original can only be offered when separately supplied and licensed.

Unit validation: `npx vitest run tests/assets/validation.test.ts`. Actual rendering and articulation accuracy need a licensed sample and browser WebGL testing; this baseline intentionally contains none.

Browser runtime validation: `npx tsx tests/assets-browser/run.ts` bundles a test-only triangle harness into a temporary directory and starts a loopback HTTP server, then checks loading, real material and pivot updates, all camera presets, state restoration, invalid revisions, limits, resize and disposal in Chromium WebGL 2. The script defaults to `/usr/bin/chromium`; override `CHROMIUM_EXECUTABLE_PATH` for another installed Chromium. It uses the existing esbuild dependency provided by tsx and Playwright, performs no browser download, and removes its temporary harness on completion. This synthetic fixture proves runtime plumbing only; it is never offered as a user vehicle.
