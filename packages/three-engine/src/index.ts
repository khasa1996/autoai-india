import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { interactionManifestSchema, validateConfiguration, type InteractionManifest, type SavedConfiguration } from '../../configurator/src/index';
import { inspectGlb, MAX_GLB_BYTES } from '../../../services/asset-pipeline/src/index';
export type CameraPreset = 'front' | 'rear' | 'left' | 'right' | 'threeQuarter' | 'top';
const presets: Record<CameraPreset, [number, number, number]> = { front: [0, .2, 1], rear: [0, .2, -1], left: [-1, .2, 0], right: [1, .2, 0], threeQuarter: [1, .45, 1], top: [0, 1, .001] };
/** Coordinates follow the source asset: Y up, +Z front. Pivots/axes use the target mesh parent's local coordinates. */
export class VehicleViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, .01, 10000);
  private controls: OrbitControls;
  private root?: THREE.Group;
  private manifest?: InteractionManifest;
  private pivots = new Map<string, THREE.Group>();
  private paintGroups = new Map<string, THREE.MeshStandardMaterial[]>();
  private config?: SavedConfiguration;
  private originalColors = new Map<THREE.MeshStandardMaterial, THREE.Color>();
  private observer: ResizeObserver;
  private disposed = false;
  private loadGeneration = 0;
  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = new THREE.Color('#11151d');
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3); light.position.set(3, 5, 4); this.scene.add(light);
    this.controls = new OrbitControls(this.camera, canvas); this.controls.enableDamping = true;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas); this.resize();
    this.renderer.setAnimationLoop(() => { this.controls.update(); this.renderer.render(this.scene, this.camera); });
  }
  private resize() { const { width, height } = this.canvas.getBoundingClientRect(); this.renderer.setSize(Math.max(1, width), Math.max(1, height), false); this.camera.aspect = Math.max(1, width) / Math.max(1, height); this.camera.updateProjectionMatrix(); }
  async loadLocalFile(file: File, manifestInput: unknown): Promise<void> {
    if (this.disposed) throw new Error('Viewer disposed');
    if (!file.name.toLowerCase().endsWith('.glb') || file.size > MAX_GLB_BYTES) throw new Error('Select a local GLB no larger than 50 MiB');
    const manifest = interactionManifestSchema.parse(manifestInput);
    const generation = ++this.loadGeneration;
    const bytes = await file.arrayBuffer(); inspectGlb(bytes);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (hash !== manifest.assetSha256) throw new Error('Asset SHA-256 does not match the licensed interaction manifest');
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => { if (!url.startsWith('blob:')) throw new Error('Remote asset requests prohibited'); return url; });
    const gltf = await new GLTFLoader(manager).parseAsync(bytes, '');
    if (this.disposed || generation !== this.loadGeneration) { this.disposeObject(gltf.scene); throw new Error('Load cancelled'); }
    // Resolve every semantic target before changing the active asset.
    const names = new Map<string, THREE.Object3D[]>();
    gltf.scene.traverse(object => { if (object.name) names.set(object.name, [...(names.get(object.name) ?? []), object]); });
    const resolveMesh = (name: string): THREE.Mesh => {
      const matches = names.get(name); if (matches?.length !== 1 || !(matches[0] instanceof THREE.Mesh)) throw new Error(`Mesh name must resolve uniquely: ${name}`); return matches[0];
    };
    try {
      for (const articulation of manifest.articulations) resolveMesh(articulation.meshName);
      for (const group of manifest.paint) for (const meshName of group.meshNames) {
        const mesh = resolveMesh(meshName); const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const materialName of group.materialNames) if (!materials.some(m => m.name === materialName && m instanceof THREE.MeshStandardMaterial)) throw new Error(`Missing PBR material ${materialName} on ${meshName}`);
      }
    } catch (error) { this.disposeObject(gltf.scene); throw error; }
    this.clear(); this.root = gltf.scene; this.manifest = manifest; this.scene.add(this.root);
    // Clone materials per mesh so paint does not leak to meshes outside the explicit selection.
    const oldMaterials = new Set<THREE.Material>();
    this.root.traverse(object => { if (object instanceof THREE.Mesh) { const all = Array.isArray(object.material) ? object.material : [object.material]; all.forEach(m => oldMaterials.add(m)); object.material = Array.isArray(object.material) ? all.map(m => m.clone()) : all[0].clone(); } });
    oldMaterials.forEach(m => m.dispose());
    for (const group of manifest.paint) this.paintGroups.set(group.id, group.meshNames.flatMap(name => { const m = resolveMesh(name).material; return (Array.isArray(m) ? m : [m]).filter((m): m is THREE.MeshStandardMaterial => m instanceof THREE.MeshStandardMaterial && group.materialNames.includes(m.name)); }));
    for (const materials of this.paintGroups.values()) for (const material of materials) this.originalColors.set(material, material.color.clone());
    for (const part of manifest.articulations) {
      const mesh = resolveMesh(part.meshName); const parent = mesh.parent!; const pivot = new THREE.Group(); pivot.position.fromArray(part.pivot); parent.add(pivot);
      parent.updateWorldMatrix(true, true); pivot.attach(mesh); this.pivots.set(part.id, pivot);
    }
    this.config = { version: 1, assetId: manifest.assetId, assetSha256: hash, paint: {}, articulations: Object.fromEntries(manifest.articulations.map(a => [a.id, a.closedRadians])) };
    this.setCamera('threeQuarter');
  }
  setCamera(preset: CameraPreset) {
    if (!this.root) return;
    const box = new THREE.Box3().setFromObject(this.root); const center = box.getCenter(new THREE.Vector3()); const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, .01);
    const distance = radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.2 / Math.min(this.camera.aspect, 1);
    this.controls.target.copy(center); this.camera.position.copy(center).add(new THREE.Vector3(...presets[preset]).normalize().multiplyScalar(distance));
    this.camera.near = Math.max(radius / 1000, .00001); this.camera.far = radius * 1000; this.camera.updateProjectionMatrix(); this.controls.maxDistance = radius * 20; this.controls.minDistance = radius * .2; this.controls.update();
  }
  setPaint(id: string, color: string) {
    if (!this.config || !this.manifest) throw new Error('No asset loaded');
    validateConfiguration({ ...this.config, paint: { ...this.config.paint, [id]: color } }, this.manifest);
    this.paintGroups.get(id)!.forEach(material => material.color.set(color)); this.config.paint[id] = color;
  }
  setArticulation(id: string, radians: number) {
    if (!this.config || !this.manifest) throw new Error('No asset loaded');
    validateConfiguration({ ...this.config, articulations: { ...this.config.articulations, [id]: radians } }, this.manifest);
    const part = this.manifest.articulations.find(a => a.id === id)!;
    // Source mesh pose is the declared closed angle, so rotations are relative to that baseline.
    this.pivots.get(id)!.quaternion.setFromAxisAngle(new THREE.Vector3(...part.axis), radians - part.closedRadians); this.config.articulations[id] = radians;
  }
  save(): SavedConfiguration { if (!this.config) throw new Error('No asset loaded'); return structuredClone(this.config); }
  restore(input: unknown) {
    if (!this.manifest || !this.config) throw new Error('No asset loaded'); const config = validateConfiguration(input, this.manifest);
    this.originalColors.forEach((color, material) => material.color.copy(color)); this.config.paint = {};
    for (const part of this.manifest.articulations) this.setArticulation(part.id, part.closedRadians);
    for (const [id, color] of Object.entries(config.paint)) this.setPaint(id, color);
    for (const [id, angle] of Object.entries(config.articulations)) this.setArticulation(id, angle);
  }
  private disposeObject(root: THREE.Object3D) {
    const materials = new Set<THREE.Material>(); const textures = new Set<THREE.Texture>();
    root.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); } });
    materials.forEach(m => { for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value); m.dispose(); }); textures.forEach(t => { const data = t.source.data; if (typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap) data.close(); t.dispose(); });
  }
  private clear() { if (this.root) { this.scene.remove(this.root); this.disposeObject(this.root); } this.root = undefined; this.manifest = undefined; this.config = undefined; this.pivots.clear(); this.paintGroups.clear(); this.originalColors.clear(); }
  dispose() { if (this.disposed) return; this.disposed = true; ++this.loadGeneration; this.observer.disconnect(); this.renderer.setAnimationLoop(null); this.controls.dispose(); this.clear(); this.renderer.dispose(); }
}
