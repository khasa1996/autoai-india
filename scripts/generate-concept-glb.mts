import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createHash } from "node:crypto";
import { chmod, mkdir, writeFile } from "node:fs/promises";

class NodeFileReader {
  result: string | ArrayBuffer | null = null;
  onloadend: null | (() => void) = null;
  async readAsArrayBuffer(blob: Blob) {
    this.result = await blob.arrayBuffer();
    this.onloadend?.();
  }
  async readAsDataURL(blob: Blob) {
    this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`;
    this.onloadend?.();
  }
}
Object.assign(globalThis, { FileReader: NodeFileReader });

const scene = new THREE.Scene();
scene.name = "AutoAI_Original_Concept";
const paint = new THREE.MeshStandardMaterial({
  name: "concept_paint",
  color: "#aeb7bd",
  metalness: 0.78,
  roughness: 0.24,
});
const glass = new THREE.MeshStandardMaterial({
  name: "concept_glass",
  color: "#101820",
  metalness: 0.15,
  roughness: 0.08,
});
const dark = new THREE.MeshStandardMaterial({
  name: "concept_trim",
  color: "#15181b",
  metalness: 0.35,
  roughness: 0.52,
});
const light = new THREE.MeshStandardMaterial({
  name: "concept_light",
  color: "#e8f7ff",
  emissive: "#9bdcff",
  emissiveIntensity: 1,
  roughness: 0.2,
});

function mesh(
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
) {
  const value = new THREE.Mesh(geometry, material);
  value.name = name;
  value.position.set(...position);
  value.scale.set(...scale);
  value.rotation.set(...rotation);
  scene.add(value);
}

mesh(
  "body_shell",
  new THREE.CapsuleGeometry(0.78, 2.6, 8, 20),
  paint,
  [0, 0.76, 0],
  [1.3, 0.52, 1],
  [0, 0, Math.PI / 2],
);
mesh(
  "cabin",
  new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
  glass,
  [-0.2, 1.03, 0],
  [1.42, 0.72, 0.78],
);
mesh("lower_trim", new THREE.BoxGeometry(3.8, 0.16, 1.62), dark, [0, 0.37, 0]);
mesh(
  "front_light",
  new THREE.BoxGeometry(0.08, 0.1, 1.3),
  light,
  [2.02, 0.9, 0],
);
mesh(
  "rear_light",
  new THREE.BoxGeometry(0.08, 0.1, 1.28),
  light,
  [-2.02, 0.88, 0],
);
for (const x of [-1.35, 1.35])
  for (const z of [-0.82, 0.82]) {
    const side = z < 0 ? "left" : "right";
    mesh(
      `wheel_${x < 0 ? "rear" : "front"}_${side}`,
      new THREE.CylinderGeometry(0.43, 0.43, 0.24, 28),
      dark,
      [x, 0.43, z],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );
    mesh(
      `hub_${x < 0 ? "rear" : "front"}_${side}`,
      new THREE.CylinderGeometry(0.23, 0.23, 0.25, 12),
      paint,
      [x, 0.43, z],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );
  }

const exporter = new GLTFExporter();
const data = await new Promise<ArrayBuffer>((resolve, reject) =>
  exporter.parse(scene, (value) => resolve(value as ArrayBuffer), reject, {
    binary: true,
    onlyVisible: true,
  }),
);
const bytes = Buffer.from(data);
const directory = "apps/web/public/models";
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/original-concept.glb`, bytes);
const hash = createHash("sha256").update(bytes).digest("hex");
await writeFile(
  `${directory}/original-concept.manifest.json`,
  JSON.stringify(
    {
      version: 1,
      assetId: "autoai-original-concept-001",
      assetSha256: hash,
      license: {
        name: "AutoAI Original Asset",
        source: "Procedurally generated in this repository",
        permittedUse: "owned",
      },
      paint: [
        {
          id: "exterior",
          meshNames: ["body_shell"],
          materialNames: ["concept_paint"],
        },
      ],
      articulations: [],
    },
    null,
    2,
  ),
);
await Promise.all([
  chmod(`${directory}/original-concept.glb`, 0o644),
  chmod(`${directory}/original-concept.manifest.json`, 0o644),
]);
console.log(
  `Generated ${directory}/original-concept.glb (${bytes.length} bytes, sha256 ${hash})`,
);
