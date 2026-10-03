import * as THREE from 'three';

/** User-supplied drawings, 2026-09-28. All coordinates are millimetres.
 * This is a dimensioned reference reconstruction, NOT production CAD.
 * Exact photographed annotations: cap 30×30×4.8 / Ø8.5; second cap 30×30×4,
 * M8 designation; block 60×60×11.4 / M16 / 30×30 four-hole pitch / M8
 * clearance designation; foot D100 / M16 / 100mm threaded length.
 * Unspecified sinks, counterbores, recesses, corners, thread form, nut sizes
 * and 20mm foot base height are explicitly visual estimates.
 * Do not scale here: the shared designer mm-to-scene transform owns scaling.
 */
export const REFERENCE_HARDWARE_GEOMETRY_DATUM = {
  diecast_cap_3030_t48: { envelopeMm: [30, 30, 4.8], boreMm: 8.5 },
  diecast_cap_3030_t4: { envelopeMm: [30, 30, 4], boreMm: 8.5 },
  end_mount_6060_m16: { envelopeMm: [60, 60, 11.4], threadNominalMm: 16, fixingPitchMm: 30, fixingClearanceMm: 8.5 },
  leveling_foot_d100_m16_l100: { envelopeMm: [100, 120, 100], threadNominalMm: 16, threadLengthMm: 100, inferredBaseHeightMm: 20 },
} as const;

type Hole = { x: number; y: number; rings: readonly (readonly [z: number, radius: number])[] };
const segments = 64;
const turn = Math.PI * 2;

function roundedRectangle(width: number, height: number, radius: number) {
  const points: THREE.Vector2[] = [];
  for (let corner = 0; corner < 4; corner++) {
    const cx = (corner === 0 || corner === 3 ? 1 : -1) * (width / 2 - radius);
    const cy = (corner < 2 ? 1 : -1) * (height / 2 - radius);
    for (let step = 0; step <= 8; step++) {
      const angle = corner * Math.PI / 2 + step * Math.PI / 16;
      points.push(new THREE.Vector2(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)));
    }
  }
  return points;
}

/** Closed plate skin with genuine through voids, optional conical sink or stepped
 * counterbore. Planar faces and bore walls are meshed, never covered with discs. */
function boredPlate(width: number, height: number, cornerRadius: number, zMin: number, zMax: number, holes: Hole[]) {
  const outline = roundedRectangle(width, height, cornerRadius);
  const vertices: number[] = [];
  const triangle = (a: number[], b: number[], c: number[]) => vertices.push(...a, ...b, ...c);
  for (const [z, top] of [[zMin, false], [zMax, true]] as const) {
    const circularHoles = holes.map(hole => {
      const radius = hole.rings[top ? hole.rings.length - 1 : 0][1];
      return Array.from({ length: segments }, (_, index) => {
        const angle = -index * turn / segments;
        return new THREE.Vector2(hole.x + radius * Math.cos(angle), hole.y + radius * Math.sin(angle));
      });
    });
    const flat = [...outline, ...circularHoles.flat()];
    THREE.ShapeUtils.triangulateShape(outline, circularHoles).forEach(face => {
      const order = top ? face : [face[2], face[1], face[0]];
      triangle(...order.map(index => [flat[index].x, flat[index].y, z]) as [number[], number[], number[]]);
    });
  }
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index]; const b = outline[(index + 1) % outline.length];
    triangle([a.x, a.y, zMin], [b.x, b.y, zMin], [b.x, b.y, zMax]);
    triangle([a.x, a.y, zMin], [b.x, b.y, zMax], [a.x, a.y, zMax]);
  }
  holes.forEach(hole => {
    for (let section = 0; section < hole.rings.length - 1; section++) {
      const [za, ra] = hole.rings[section]; const [zb, rb] = hole.rings[section + 1];
      for (let index = 0; index < segments; index++) {
        const a = index * turn / segments; const b = (index + 1) * turn / segments;
        const point = (angle: number, r: number, z: number) => [hole.x + r * Math.cos(angle), hole.y + r * Math.sin(angle), z];
        triangle(point(a, ra, za), point(b, rb, zb), point(b, ra, za));
        triangle(point(a, ra, za), point(a, rb, zb), point(b, rb, zb));
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function addMesh(group: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.userData = { referenceReconstruction: true, productionGeometry: false };
  group.add(mesh);
  return mesh;
}

function openRing(outer: number, inner: number, zMin: number, zMax: number) {
  const shape = new THREE.Shape(); shape.absarc(0, 0, outer, 0, turn, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, turn, true); shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: zMax - zMin, bevelEnabled: false, curveSegments: 48 });
  geometry.translate(0, 0, zMin);
  return geometry;
}

function cap(group: THREE.Group, thickness: number, material: THREE.Material) {
  const front = thickness / 2; const back = -front;
  const faceBack = back + 1.4;
  // Sink outer Ø15 and depth1.8, rear rim1.3/bossØ15 are photograph estimates.
  addMesh(group, 'cap-face-open-countersink', boredPlate(30, 30, 2, faceBack, front, [
    { x: 0, y: 0, rings: [[faceBack, 4.25], [front - 1.8, 4.25], [front, 7.5]] },
  ]), material);
  const rim = new THREE.Shape(roundedRectangle(30, 30, 2));
  const cavity = new THREE.Path(roundedRectangle(27.4, 27.4, 1.1).reverse());
  rim.holes.push(cavity);
  const rear = new THREE.ExtrudeGeometry(rim, { depth: 1.4, bevelEnabled: false, curveSegments: 32 });
  rear.translate(0, 0, back);
  addMesh(group, 'cap-rear-perimeter-rim-estimated', rear, material);
  addMesh(group, 'cap-rear-open-boss-estimated', openRing(7.5, 4.25, back, faceBack), material);
  // Local locating tongue remains inside the stated 30×30 envelope. Its
  // position/width are only a restrained visual interpretation of image 2.
  if (thickness === 4) {
    const tab = new THREE.BoxGeometry(6, 2.3, 1.4).translate(0, -13.85, back + 0.7);
    addMesh(group, 'cap-rear-locating-tongue-estimated', tab, material);
  }
}

function endMount(group: THREE.Group, material: THREE.Material) {
  const half = 11.4 / 2;
  const holes: Hole[] = [{ x: 0, y: 0, rings: [[-half, 8], [half, 8]] }];
  for (const x of [-15, 15]) for (const y of [-15, 15]) {
    // Image labels M8 clearance; Ø8.5 and Ø14/depth4 counterbore are inferred.
    holes.push({ x, y, rings: [[-half, 4.25], [half - 4, 4.25], [half - 4, 7], [half, 7]] });
  }
  addMesh(group, '6060-mount-open-center-and-four-counterbores', boredPlate(60, 60, 0.7, -half, half, holes), material);
}

function foot(group: THREE.Group, material: THREE.Material) {
  // Base height20 is not annotated; total120 is therefore an inferred envelope.
  const profile = [[0, -60], [49, -60], [50, -59], [50, -54], [48, -52],
    [30, -46], [17, -41], [11, -40], [0, -40]].map(([r, y]) => new THREE.Vector2(r, y));
  addMesh(group, 'foot-turned-d100-base-height20-estimated', new THREE.LatheGeometry(profile, 96), material);
  addMesh(group, 'm16-l100-reference-shank', new THREE.CylinderGeometry(7.55, 7.55, 100, 48).translate(0, 10, 0), material);
  // Subtle helical crest is visual only; no thread class, pitch or root profile
  // is asserted. End stations and 16mm nominal diameter stay within envelope.
  class ThreadCurve extends THREE.Curve<THREE.Vector3> {
    constructor() { super(); }
    getPoint(t: number, target = new THREE.Vector3()) {
      const angle = t * turn * 50;
      return target.set(7.7 * Math.cos(angle), -39.75 + t * 99.5, 7.7 * Math.sin(angle));
    }
  }
  addMesh(group, 'm16-visual-thread-form-unverified', new THREE.TubeGeometry(new ThreadCurve(), 1200, 0.25, 3, false), material);
  addMesh(group, 'upper-hex-jam-nut-estimated', new THREE.CylinderGeometry(13.8564, 13.8564, 12, 6).translate(0, 37, 0), material);
  addMesh(group, 'lower-hex-collar-estimated', new THREE.CylinderGeometry(11.55, 11.55, 7, 6).translate(0, -36.5, 0), material);
  addMesh(group, 'upper-washer-estimated', new THREE.CylinderGeometry(13.5, 13.5, 1.5, 48).translate(0, 30.25, 0), material);
}

export function createReferenceHardwareGeometry(sceneType: string, material: THREE.Material): THREE.Group | null {
  if (!Object.prototype.hasOwnProperty.call(REFERENCE_HARDWARE_GEOMETRY_DATUM, sceneType)) return null;
  const group = new THREE.Group();
  group.name = `reference-hardware:${sceneType}`;
  group.userData = { units: 'mm', geometryVersion: 'photo-dimension-v1', productionGeometry: false,
    sourceManifest: 'assets/references/hardware/20260928/source-manifest.json',
    localDatum: sceneType === 'leveling_foot_d100_m16_l100' ? 'centered,+Y-thread' : 'centered,XY-face,+Z-counterbore' };
  if (sceneType === 'diecast_cap_3030_t48') cap(group, 4.8, material);
  if (sceneType === 'diecast_cap_3030_t4') cap(group, 4, material);
  if (sceneType === 'end_mount_6060_m16') endMount(group, material);
  if (sceneType === 'leveling_foot_d100_m16_l100') foot(group, material);
  return group;
}
