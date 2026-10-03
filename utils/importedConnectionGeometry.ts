import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { ImportedSourceMesh } from './importedSourceMesh';

export type ImportedConnectionVector = [number, number, number];
type V = ImportedConnectionVector;
type Axes = [V, V, V];
export interface ImportedConnectionItem {
  id: string;
  kind?: string;
  position?: readonly number[];
  /** Designer Euler XYZ degrees, not radians. */
  rotation?: readonly number[];
  sourceMesh?: ImportedSourceMesh;
}
export interface ImportedConnectionProfile {
  id: string;
  sourcePartId: string;
  variantId: string;
  lengthMm: number;
  position: V;
  rotation: V;
  axes: Axes;
  halfSizes: V;
  eligibleForNative: boolean;
  issues: string[];
  ends: { start: 'square' | 'oblique' | 'unknown'; end: 'square' | 'oblique' | 'unknown' };
  geometryVerified: boolean;
  visible: boolean;
}
export interface ImportedConnectionObstacle {
  id: string;
  sourcePartId: string;
  semanticType: string;
  position: V;
  axes: Axes;
  halfSizes: V;
  referenceOnly: boolean;
}
export interface ImportedConnectionNode {
  id: string;
  memberIds: string[];
  pointMm: V;
  status: 'candidate' | 'existing' | 'review';
  reason: string;
  issues: string[];
  existingSourceAccessoryIds: string[];
  /** Only associated IDs enter existingSourceAccessoryIds; proximity alone is not a connection. */
  sourceAccessoryRelations?: ImportedSourceAccessoryRelation[];
}
export interface ImportedSourceAccessoryContact {
  profileId: string;
  areaMm2: number;
  planeNormalMm: V;
  planeOffsetMm: number;
  planeGapMm: number;
  pointMm: V;
  seat: 'end' | 'side' | 'internal';
  /** Whole accessory lies outside this profile's supporting face (no box-only overlap proof). */
  externalSupport: boolean;
}
export interface ImportedSourceAccessoryRelation {
  accessoryId: string;
  relation: 'associated' | 'nearby_review' | 'unrelated';
  memberIds: string[];
  evidence: string[];
  contacts: ImportedSourceAccessoryContact[];
  manufacturingVerified: false;
}
export interface ImportedConnectionGeometry {
  profiles: ImportedConnectionProfile[];
  nodes: ImportedConnectionNode[];
  accessories: ImportedConnectionObstacle[];
  obstacles: ImportedConnectionObstacle[];
}

const SECTION: Record<string, [number, number]> = {
  '2020': [20, 20], '3030': [30, 30], '3060': [30, 60], '6060': [60, 60], '30120': [30, 120],
};
const UNIT: Axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: V) => Math.sqrt(dot(v, v));
const unit = (v: V): V => mul(v, 1 / (norm(v) || 1));
const canonical = (v: V): V => {
  const n = unit(v); const first = n.find((x) => Math.abs(x) > 1e-5) || 1;
  return first < 0 ? mul(n, -1) : n;
};
const point = (positions: number[], index: number): V => [positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2]];
const finiteV = (v?: readonly number[]): v is V => !!v && v.length === 3 && v.every(Number.isFinite);
const pose = (item: ImportedConnectionItem) => new Quaternion().setFromEuler(new Euler(...(finiteV(item.rotation)
  ? item.rotation.map((n) => n * Math.PI / 180) as V : [0, 0, 0] as V), 'XYZ'));
const transform = (v: V, q: Quaternion): V => new Vector3(...v).applyQuaternion(q).toArray() as V;

interface Face { n: V; area: number; center: V; }
interface LocalFit {
  axes: Axes; position: V; halfSizes: V; verified: boolean; issues: string[];
  ends: ImportedConnectionProfile['ends'];
}
// Source mesh objects are immutable in designer history. Moving/rotating an item only
// recomputes its world transform; triangle analysis is shared by that mesh reference.
const fits = new WeakMap<ImportedSourceMesh, LocalFit>();

function extents(positions: number[], axes: Axes) {
  const min: V = [Infinity, Infinity, Infinity]; const max: V = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let j = 0; j < 3; j += 1) {
      const t = positions[i] * axes[j][0] + positions[i + 1] * axes[j][1] + positions[i + 2] * axes[j][2];
      min[j] = Math.min(min[j], t); max[j] = Math.max(max[j], t);
    }
  }
  return { min, max, size: sub(max, min) };
}

function fitProfile(mesh: ImportedSourceMesh): LocalFit {
  const prior = fits.get(mesh); if (prior) return prior;
  const faces: Face[] = [];
  const directions = new Map<string, { n: V; area: number }>();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = point(mesh.positionsMm, mesh.indices[i]); const b = point(mesh.positionsMm, mesh.indices[i + 1]); const c = point(mesh.positionsMm, mesh.indices[i + 2]);
    const raw = cross(sub(b, a), sub(c, a)); const twiceArea = norm(raw);
    if (!Number.isFinite(twiceArea) || twiceArea < 1e-8) continue;
    const n = canonical(raw); const area = twiceArea / 2;
    faces.push({ n, area, center: mul(add(add(a, b), c), 1 / 3) });
    const key = n.map((x) => Math.round(x * 10000)).join(',');
    const group = directions.get(key);
    if (group) group.area += area; else directions.set(key, { n, area });
  }
  const expected = SECTION[mesh.source.profileVariantId || ''];
  const sourceLength = mesh.source.dimensionsMm?.sourceLocalX;
  const normals = [...directions.values()].sort((a, b) => b.area - a.area).slice(0, 18);
  let best: { axes: Axes; score: number; extent: ReturnType<typeof extents> } | undefined;
  const checked = new Set<string>();
  for (let i = 0; i < normals.length; i += 1) for (let j = i + 1; j < normals.length; j += 1) {
    if (Math.abs(dot(normals[i].n, normals[j].n)) > 1e-4) continue;
    const base: Axes = [normals[i].n, normals[j].n, canonical(cross(normals[i].n, normals[j].n))];
    for (let axis = 0; axis < 3; axis += 1) for (let swap = 0; swap < 2; swap += 1) {
      const x = canonical(base[axis]); const y = canonical(base[(axis + 1 + swap) % 3]); const z = unit(cross(x, y));
      const axes: Axes = [x, y, z];
      const key = axes.flat().map((n) => Math.round(n * 10000)).join(',');
      if (checked.has(key)) continue; checked.add(key);
      const extent = extents(mesh.positionsMm, axes); const [length, width, height] = extent.size;
      // Measured cross section decides the axis. Source dimensions only break ties;
      // a stale component name (e.g. "835 mm" on a 410 mm cut) is never geometry.
      const mismatch = expected ? Math.abs(width - expected[0]) + Math.abs(height - expected[1]) : width + height;
      const score = mismatch + (Number.isFinite(sourceLength) ? Math.min(100, Math.abs(length - sourceLength!)) * 0.001 : 0)
        + (length < Math.max(width, height) ? 1000 : 0);
      if (!best || score < best.score - 1e-8) best = { axes, score, extent };
    }
  }
  const axes = best?.axes || UNIT.map((a) => [...a]) as Axes;
  const extent = best?.extent || extents(mesh.positionsMm, axes);
  const middle = mul(add(extent.min, extent.max), 0.5);
  const position = add(add(mul(axes[0], middle[0]), mul(axes[1], middle[1])), mul(axes[2], middle[2]));
  const issues: string[] = [];
  const sectionMatches = !!expected && Math.abs(extent.size[1] - expected[0]) < 0.15 && Math.abs(extent.size[2] - expected[1]) < 0.15;
  if (!best) issues.push('无法从真实三角面确认型材轴向。');
  if (!expected) issues.push('源型材规格尚未建立截面映射。');
  else if (!sectionMatches) issues.push('源顶点实测截面与标注规格不一致。');
  if (sourceLength !== undefined && Math.abs(extent.size[0] - sourceLength) > 0.3) issues.push('实测轴向包络与源长度记录不一致，需核对切面。');
  const ends: LocalFit['ends'] = { start: 'unknown', end: 'unknown' };
  const endBand = Math.max(extent.size[1], extent.size[2]) * 1.6;
  for (const [label, value] of [['start', extent.min[0]], ['end', extent.max[0]]] as const) {
    let squareArea = 0; let obliqueArea = 0;
    for (const face of faces) {
      const axialNormal = Math.abs(dot(face.n, axes[0]));
      const distance = Math.abs(dot(face.center, axes[0]) - value);
      if (axialNormal > 0.9999 && distance < 0.06) squareArea += face.area;
      // Chamfers, holes and cutouts prevent assuming a native square-end seat.
      else if (axialNormal > 0.15 && distance < endBand && face.area > 0.2) obliqueArea += face.area;
    }
    ends[label] = obliqueArea > 1 ? 'oblique' : squareArea > 1 ? 'square' : 'unknown';
  }
  if (ends.start !== 'square' || ends.end !== 'square') issues.push('存在斜切、端部加工或未确认端面，连接座面需复核。');
  const fit = { axes, position, halfSizes: mul(extent.size, 0.5), verified: !!best && sectionMatches,
    issues, ends };
  fits.set(mesh, fit); return fit;
}

export function extractImportedConnectionProfiles(items: readonly ImportedConnectionItem[]): ImportedConnectionProfile[] {
  return items.filter((item) => item.kind === 'imported_component' && item.sourceMesh?.source.semanticType === 'profile').map((item) => {
    const mesh = item.sourceMesh!; const fit = fitProfile(mesh); const q = pose(item);
    const axes = fit.axes.map((a) => transform(a, q)) as Axes;
    const rotation = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(...axes.map((a) => new Vector3(...a)) as [Vector3, Vector3, Vector3]), 'XYZ');
    const variantId = mesh.source.profileVariantId || 'unknown';
    const issues = [...fit.issues];
    if (!['2020', '3030'].includes(variantId)) issues.push('该截面尚无自动连接座面标定，保留真实规格待核。');
    const visible = mesh.source.visible !== false && mesh.source.referenceOnly !== true;
    if (!visible) issues.push('源文件中为隐藏或参考构件，不自动添加连接件。');
    return { id: item.id, sourcePartId: item.id, variantId, lengthMm: fit.halfSizes[0] * 2,
      position: add(finiteV(item.position) ? [...item.position] as V : [0, 0, 0], transform(fit.position, q)),
      rotation: [rotation.x, rotation.y, rotation.z].map((n) => n * 180 / Math.PI) as V,
      axes, halfSizes: [...fit.halfSizes] as V, issues, ends: { ...fit.ends }, geometryVerified: fit.verified, visible,
      eligibleForNative: visible && fit.verified && issues.length === 0 };
  });
}

export function extractImportedConnectionObstacles(items: readonly ImportedConnectionItem[]): ImportedConnectionObstacle[] {
  return items.filter((item) => item.kind === 'imported_component' && item.sourceMesh
    && item.sourceMesh.source.semanticType !== 'profile' && item.sourceMesh.source.visible !== false).map((item) => {
    const mesh = item.sourceMesh!; const q = pose(item);
    const min = mesh.boundsMm.min as V; const max = mesh.boundsMm.max as V;
    return { id: item.id, sourcePartId: item.id, semanticType: mesh.source.semanticType || 'unknown',
      position: add(finiteV(item.position) ? [...item.position] as V : [0, 0, 0], transform(mul(add(min, max), 0.5), q)),
      axes: UNIT.map((a) => transform(a, q)) as Axes, halfSizes: mul(sub(max, min), 0.5), referenceOnly: mesh.source.referenceOnly === true };
  });
}

type Box = Pick<ImportedConnectionProfile, 'position' | 'axes' | 'halfSizes'>;
/** Conservative OBB separation. This is not solid/mesh collision certification. */
export function importedConnectionBoxesTouch(a: Box, b: Box, toleranceMm = 0.25): boolean {
  const offset = sub(b.position, a.position);
  const axes = [...a.axes, ...b.axes, ...a.axes.flatMap((x) => b.axes.map((y) => cross(x, y)))];
  for (const raw of axes) {
    if (norm(raw) < 1e-8) continue;
    const axis = unit(raw);
    const radius = (box: Box) => box.axes.reduce((sum, direction, i) => sum + Math.abs(dot(direction, axis)) * box.halfSizes[i], 0);
    if (Math.abs(dot(offset, axis)) > radius(a) + radius(b) + toleranceMm) return false;
  }
  return true;
}
function closestPoint(box: Box, p: V): V {
  const delta = sub(p, box.position); let q = [...box.position] as V;
  for (let i = 0; i < 3; i += 1) q = add(q, mul(box.axes[i], Math.max(-box.halfSizes[i], Math.min(box.halfSizes[i], dot(delta, box.axes[i])))));
  return q;
}
function pairPoint(a: ImportedConnectionProfile, b: ImportedConnectionProfile) {
  const candidates: { point: V; gap: number; penetration: number }[] = [];
  for (const [first, second] of [[a, b], [b, a]]) for (const sign of [-1, 1]) {
    const end = add(first.position, mul(first.axes[0], first.halfSizes[0] * sign));
    const other = closestPoint(second, end);
    const radius = second.axes.reduce((sum, direction, i) => sum + Math.abs(dot(direction, first.axes[0])) * second.halfSizes[i], 0);
    const penetration = Math.max(0, radius - Math.abs(dot(sub(end, second.position), first.axes[0])));
    candidates.push({ point: mul(add(end, other), 0.5), gap: norm(sub(end, other)), penetration });
  }
  return candidates.sort((x, y) => x.gap + x.penetration - y.gap - y.penetration)[0];
}

interface MeshPlane { normal: V; offset: number; triangleOffsets: number[]; area: number; }
interface WorldPlane extends MeshPlane { localPlane: MeshPlane; }
interface MeshPose { mesh: ImportedSourceMesh; quaternion: Quaternion; translation: V; planes: WorldPlane[]; triangles: Map<number, [V, V, V]>; }
const meshPlaneCache = new WeakMap<ImportedSourceMesh, MeshPlane[]>();
const meshPoseCache = new WeakMap<ImportedSourceMesh, Map<string, MeshPose>>();
const pairContactCache = new WeakMap<MeshPose, WeakMap<MeshPose, ImportedSourceAccessoryContact[]>>();

/** Actual triangle planes, not the solid face implied by an extrusion's outer box. */
function meshPlanes(mesh: ImportedSourceMesh): MeshPlane[] {
  const prior = meshPlaneCache.get(mesh); if (prior) return prior;
  const planes = new Map<string, MeshPlane>();
  const seen = new Set<string>();
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const a = point(mesh.positionsMm, mesh.indices[offset]); const b = point(mesh.positionsMm, mesh.indices[offset + 1]); const c = point(mesh.positionsMm, mesh.indices[offset + 2]);
    const raw = cross(sub(b, a), sub(c, a)); const area = norm(raw) * 0.5;
    if (area < 1e-7) continue;
    const triangleKey = [a, b, c].map((v) => v.map((n) => Math.round(n * 100000)).join(',')).sort().join('|');
    if (seen.has(triangleKey)) continue; seen.add(triangleKey);
    const n = canonical(raw); const d = dot(n, a);
    const key = [...n.map((v) => Math.round(v * 100000)), Math.round(d * 100)].join(',');
    const plane = planes.get(key);
    if (plane) { plane.area += area; plane.triangleOffsets.push(offset); }
    else planes.set(key, { normal: n, offset: d, triangleOffsets: [offset], area });
  }
  // A point, edge or microscopic facet cannot prove an installation seat.
  const result = [...planes.values()].filter((p) => p.area >= 1).sort((a, b) => b.area - a.area);
  meshPlaneCache.set(mesh, result); return result;
}
function meshPose(item: ImportedConnectionItem): MeshPose {
  const mesh = item.sourceMesh!;
  const translation: V = finiteV(item.position) ? [...item.position] : [0, 0, 0];
  const rotation: V = finiteV(item.rotation) ? [...item.rotation] : [0, 0, 0];
  const key = [...translation, ...rotation].join(',');
  let cache = meshPoseCache.get(mesh);
  if (!cache) { cache = new Map(); meshPoseCache.set(mesh, cache); }
  const prior = cache.get(key); if (prior) return prior;
  const quaternion = pose(item);
  const planes = meshPlanes(mesh).map((p) => {
    const normal = transform(p.normal, quaternion);
    return { ...p, normal, offset: p.offset + dot(normal, translation), localPlane: p };
  });
  const result = { mesh, quaternion, translation, planes, triangles: new Map<number, [V, V, V]>() };
  // At most two undo/move poses per immutable mesh; no scene-wide retained meshes.
  if (cache.size >= 2) cache.delete(cache.keys().next().value!);
  cache.set(key, result); return result;
}
function worldTriangle(mesh: MeshPose, offset: number): [V, V, V] {
  const previous = mesh.triangles.get(offset); if (previous) return previous;
  const result = [0, 1, 2].map((i) => add(transform(point(mesh.mesh.positionsMm, mesh.mesh.indices[offset + i]), mesh.quaternion), mesh.translation)) as [V, V, V];
  mesh.triangles.set(offset, result); return result;
}
type P2 = [number, number];
const cross2 = (a: P2, b: P2, c: P2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
/** Clip the actual coplanar triangles; empty slots and voids have no triangle coverage. */
function triangleOverlap(a: [V, V, V], b: [V, V, V], normal: V, offset: number): { area: number; point: V } | null {
  let drop = 0; if (Math.abs(normal[1]) > Math.abs(normal[drop])) drop = 1; if (Math.abs(normal[2]) > Math.abs(normal[drop])) drop = 2;
  const u = (drop + 1) % 3; const v = (drop + 2) % 3;
  const project = (p: V): P2 => [p[u], p[v]];
  let polygon: P2[] = a.map(project); const clip = b.map(project);
  for (let dimension = 0; dimension < 2; dimension += 1) {
    if (Math.max(...polygon.map((p) => p[dimension])) < Math.min(...clip.map((p) => p[dimension])) - 1e-6
      || Math.max(...clip.map((p) => p[dimension])) < Math.min(...polygon.map((p) => p[dimension])) - 1e-6) return null;
  }
  const sign = Math.sign(cross2(clip[0], clip[1], clip[2])); if (!sign) return null;
  for (let edge = 0; edge < 3 && polygon.length; edge += 1) {
    const first = clip[edge]; const second = clip[(edge + 1) % 3]; const input = polygon; polygon = [];
    for (let i = 0; i < input.length; i += 1) {
      const from = input[i]; const to = input[(i + 1) % input.length];
      const d0 = sign * cross2(first, second, from); const d1 = sign * cross2(first, second, to);
      if (d0 >= -1e-7) polygon.push(from);
      if ((d0 >= -1e-7) !== (d1 >= -1e-7)) {
        const fraction = d0 / (d0 - d1);
        polygon.push([from[0] + fraction * (to[0] - from[0]), from[1] + fraction * (to[1] - from[1])]);
      }
    }
  }
  if (polygon.length < 3) return null;
  let twiceArea = 0; let centerU = 0; let centerV = 0;
  // Use a nearby origin to avoid precision loss at large scene translations.
  const origin = polygon[0];
  for (let i = 1; i + 1 < polygon.length; i += 1) {
    const signedArea = cross2(origin, polygon[i], polygon[i + 1]);
    twiceArea += signedArea;
    centerU += signedArea * ((polygon[i][0] - origin[0]) + (polygon[i + 1][0] - origin[0])) / 3;
    centerV += signedArea * ((polygon[i][1] - origin[1]) + (polygon[i + 1][1] - origin[1])) / 3;
  }
  if (Math.abs(twiceArea) < 1e-7) return null;
  const p: V = [0, 0, 0]; p[u] = origin[0] + centerU / twiceArea; p[v] = origin[1] + centerV / twiceArea;
  p[drop] = (offset - normal[u] * p[u] - normal[v] * p[v]) / normal[drop];
  return { area: Math.abs(twiceArea) * 0.5 / Math.abs(normal[drop]), point: p };
}
function seatKind(profile: ImportedConnectionProfile, normal: V, offset: number): ImportedSourceAccessoryContact['seat'] {
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(dot(normal, profile.axes[axis])) < 0.99999) continue;
    const distance = Math.abs(offset - dot(normal, profile.position));
    if (Math.abs(distance - profile.halfSizes[axis]) <= 0.25) return axis === 0 ? 'end' : 'side';
  }
  return 'internal';
}
function isExternalSupport(profile: ImportedConnectionProfile, accessory: MeshPose, normal: V, offset: number): boolean {
  const outward = Math.sign(offset - dot(normal, profile.position));
  if (!outward) return false;
  const localNormal = transform(normal, accessory.quaternion.clone().invert());
  const localOffset = offset - dot(normal, accessory.translation);
  const points = accessory.mesh.positionsMm;
  for (let index = 0; index < points.length; index += 3) {
    const distance = outward * (points[index] * localNormal[0] + points[index + 1] * localNormal[1] + points[index + 2] * localNormal[2] - localOffset);
    if (distance < -0.25) return false;
  }
  return true;
}
function profileAccessoryContacts(profile: ImportedConnectionProfile, profileItem: ImportedConnectionItem, accessory: ImportedConnectionItem): ImportedSourceAccessoryContact[] {
  const profilePose = meshPose(profileItem); const accessoryPose = meshPose(accessory);
  let byAccessory = pairContactCache.get(profilePose);
  if (!byAccessory) { byAccessory = new WeakMap(); pairContactCache.set(profilePose, byAccessory); }
  const prior = byAccessory.get(accessoryPose);
  if (prior) return prior.map((contact) => ({ ...contact, profileId: profile.id }));
  const contacts: ImportedSourceAccessoryContact[] = [];
  for (const first of profilePose.planes) for (const second of accessoryPose.planes) {
    const alignment = dot(first.normal, second.normal);
    if (Math.abs(alignment) < 0.999999 || Math.abs(first.offset - second.offset * Math.sign(alignment)) > 0.15) continue;
    let area = 0; let weightedPoint: V = [0, 0, 0];
    for (const a of first.triangleOffsets) for (const b of second.triangleOffsets) {
      const overlap = triangleOverlap(worldTriangle(profilePose, a), worldTriangle(accessoryPose, b), first.normal, first.offset);
      if (!overlap) continue;
      area += overlap.area; weightedPoint = add(weightedPoint, mul(overlap.point, overlap.area));
    }
    if (area < 2) continue;
    contacts.push({ profileId: profile.id, areaMm2: Math.round(area * 1000) / 1000, planeNormalMm: [...first.normal], planeOffsetMm: first.offset,
      planeGapMm: Math.abs(first.offset - second.offset * Math.sign(alignment)),
      pointMm: mul(weightedPoint, 1 / area), seat: seatKind(profile, first.normal, first.offset),
      externalSupport: isExternalSupport(profile, accessoryPose, first.normal, first.offset) });
  }
  byAccessory.set(accessoryPose, contacts); return contacts;
}
/** Positive separation on any SAT axis is a measured lower bound, never an inferred mating gap. */
function boxSeparation(a: Box, b: Box): number {
  const offset = sub(b.position, a.position); let separation = 0;
  const axes = [...a.axes, ...b.axes, ...a.axes.flatMap((x) => b.axes.map((y) => cross(x, y)))];
  for (const raw of axes) {
    if (norm(raw) < 1e-8) continue;
    const axis = unit(raw);
    const radius = (box: Box) => box.axes.reduce((sum, direction, i) => sum + Math.abs(dot(direction, axis)) * box.halfSizes[i], 0);
    separation = Math.max(separation, Math.abs(dot(offset, axis)) - radius(a) - radius(b));
  }
  return separation;
}
function accessoryRelations(a: ImportedConnectionProfile, b: ImportedConnectionProfile, p: V, nearby: ImportedConnectionObstacle[], items: Map<string, ImportedConnectionItem>): ImportedSourceAccessoryRelation[] {
  const memberIds = [a.id, b.id].sort(); const profileItems = [items.get(a.id)!, items.get(b.id)!];
  const radius = Math.max(a.halfSizes[1], a.halfSizes[2], b.halfSizes[1], b.halfSizes[2]) * 2 + 10;
  return nearby.map((part) => {
    const item = items.get(part.id)!; const evidence: string[] = [];
    const gaps = [boxSeparation(a, part), boxSeparation(b, part)];
    const sameFile = profileItems.every((profile) => profile.sourceMesh!.source.fileSha256 === item.sourceMesh!.source.fileSha256);
    const parent = item.sourceMesh!.source.parentPath;
    const sameAssembly = !!parent && parent !== 'root' && profileItems.every((profile) => profile.sourceMesh!.source.parentPath === parent);
    if (sameFile) evidence.push('源文件 SHA-256 一致；这只是来源证据，不代表已连接。');
    if (sameAssembly) evidence.push(`三件同属源子装配 ${parent}。`);
    // An explicit separation lower bound is sufficient to rule out this geometry
    // spanning the pair. Do not spend triangle intersection work on unrelated parts.
    if (gaps.some((gap) => gap > 2)) {
      evidence.push(`与两构件包络的分离下界分别为 ${gaps.map((gap) => gap.toFixed(3)).join(' / ')} mm。`);
      evidence.push('该源配件几何不能同时到达本接点的两根型材，不能据邻近距离占用这个接点；仍作为场景障碍保留。');
      return { accessoryId: part.id, relation: 'unrelated' as const, memberIds, evidence, contacts: [], manufacturingVerified: false as const };
    }
    const contacts = [a, b].flatMap((profile, index) => gaps[index] <= 0.25
      ? profileAccessoryContacts(profile, profileItems[index], item).filter((contact) => norm(sub(contact.pointMm, p)) <= radius) : []);
    for (let index = 0; index < 2; index += 1) {
      const id = [a.id, b.id][index]; const found = contacts.filter((contact) => contact.profileId === id);
      evidence.push(found.length ? `${id}：实际三角面投影交叠 ${found.map((contact) => `${contact.areaMm2} mm²/面距${contact.planeGapMm.toFixed(3)} mm/${contact.seat}/${contact.externalSupport ? '外侧支承面' : '跨入型材包络，槽内或穿入关系待核'}`).join('、')}（面距识别容差 0.15 mm，并非安装合格公差）。`
        : `${id}：没有局部真实共面安装面证据；包络最小分离下界 ${gaps[index].toFixed(3)} mm。`);
    }
    const seats = [a, b].map((profile) => contacts.filter((contact) => contact.profileId === profile.id && contact.seat !== 'internal' && contact.externalSupport));
    // Require two spatially distinct real surface patches. Coplanar tube voids,
    // an arbitrary nearby body, or a shared root node cannot establish a relation.
    const dualSeat = seats[0].some((left) => seats[1].some((right) => norm(sub(left.pointMm, right.pointMm)) > 2));
    let relation: ImportedSourceAccessoryRelation['relation'];
    if (sameFile && a.geometryVerified && b.geometryVerified && dualSeat) {
      relation = 'associated'; evidence.push('两根型材各有局部真实外侧/端面接触，建立几何关联并保留原配件；螺丝、槽口、受力及安装仍待核。');
    } else {
      relation = 'nearby_review'; evidence.push('配件在附近，但缺少双构件安装面或可靠来源关联；暂不重复添加，需人工核对关系。');
    }
    return { accessoryId: part.id, relation, memberIds, evidence, contacts, manufacturingVerified: false };
  });
}

export function analyzeImportedConnectionGeometry(items: readonly ImportedConnectionItem[]): ImportedConnectionGeometry {
  const profiles = extractImportedConnectionProfiles(items); const obstacles = extractImportedConnectionObstacles(items);
  const accessories = obstacles.filter((part) => ['accessory', 'angle_damper_assembly'].includes(part.semanticType) && !part.referenceOnly);
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const nodes: ImportedConnectionNode[] = [];
  for (let i = 0; i < profiles.length; i += 1) for (let j = i + 1; j < profiles.length; j += 1) {
    const a = profiles[i]; const b = profiles[j];
    if (!a.visible || !b.visible || !importedConnectionBoxesTouch(a, b)) continue;
    const connection = pairPoint(a, b);
    const maxSection = Math.max(a.halfSizes[1], a.halfSizes[2], b.halfSizes[1], b.halfSizes[2]);
    // Exclude mid-span crossings and remotely extended axes. An end envelope must
    // really reach the other body; diagonal/end-machined fits remain review only.
    if (connection.gap > maxSection * Math.SQRT2 + 0.25) continue;
    const angle = Math.abs(dot(a.axes[0], b.axes[0]));
    const issues = [...new Set([...a.issues, ...b.issues])];
    if (a.variantId !== b.variantId) issues.push('混合截面接点，需要对应规格的连接件及槽位核对。');
    if (angle > 1e-4) issues.push(angle > 0.9999 ? '平行或端对端接点，需要专用连接方案。' : '非直角接点，需要核对切面及转接件。');
    if (connection.gap > 0.25) issues.push('仅端部包络接近，实际接触面和槽口需要核对。');
    if (connection.penetration > 0.25) issues.push('端部进入另一构件包络，需核对源切面或实体干涉，不能直接补件。');
    const nearby = accessories.filter((part) => {
      const distance = norm(sub(closestPoint(part, connection.point), connection.point));
      return distance <= Math.max(12, maxSection) + 0.25;
    });
    const relations = accessoryRelations(a, b, connection.point, nearby, itemsById);
    const associated = relations.filter((relation) => relation.relation === 'associated').map((relation) => relation.accessoryId);
    const uncertain = relations.filter((relation) => relation.relation === 'nearby_review');
    if (associated.length) issues.push('已有源配件与两根型材存在真实面几何关联，保留原件；安装及紧固关系仍待核。');
    if (uncertain.length) issues.push(`附近 ${uncertain.length} 个源配件缺少可靠双构件安装关联，需核对关系后再补件。`);
    const status = associated.length ? 'existing' : issues.length || !a.eligibleForNative || !b.eligibleForNative ? 'review' : 'candidate';
    const memberIds = [a.id, b.id].sort();
    nodes.push({ id: memberIds.join(':JOINT:'), memberIds, pointMm: connection.point, status,
      reason: status === 'candidate' ? '实测等规格直角端面接点，可预览连接方案；尚非制造确认。' : issues.join(' '), issues,
      existingSourceAccessoryIds: associated, sourceAccessoryRelations: relations });
  }
  return { profiles, nodes, accessories, obstacles };
}
