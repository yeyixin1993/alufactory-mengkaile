import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ProfileSide } from '../types';

export interface APillarGeometryOptions {
  face: ProfileSide;
  lengthMm: number;
  sectionWidthMm: number;
  sectionHeightMm: number;
  centersMm: readonly number[];
  columnOffsetsMm: readonly number[];
  slotWidthMm: number;
  slotLengthMm: number;
  /** Display cut depth only. Manufacturing uses the selected A-pillar process. */
  cutDepthMm: number;
  sceneScale?: number;
}

type Polygon = THREE.Vector3[];
type HalfSpace = { normal: THREE.Vector3; distance: number };
const EPS = 1e-8;

// All cutter volumes are convex. Splitting a polygon against their planes
// retains the actual body surface outside the cutter, with no opening decals.
function splitPolygon(polygon: Polygon, plane: HalfSpace): [Polygon, Polygon] {
  const inside: Polygon = [], outside: Polygon = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = plane.normal.dot(a) - plane.distance;
    const db = plane.normal.dot(b) - plane.distance;
    if (da <= EPS) inside.push(a);
    if (da >= -EPS) outside.push(a);
    if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
      const intersection = a.clone().lerp(b, da / (da - db));
      inside.push(intersection);
      outside.push(intersection);
    }
  }
  return [inside, outside];
}

function subtractConvex(polygon: Polygon, planes: HalfSpace[]): Polygon[] {
  const remaining: Polygon[] = [];
  let interior = polygon;
  for (const plane of planes) {
    if (interior.length < 3) break;
    const distances = interior.map(point => plane.normal.dot(point) - plane.distance);
    if (distances.every(distance => distance <= EPS)) continue;
    if (distances.every(distance => distance >= -EPS)) {
      remaining.push(interior);
      return remaining;
    }
    const [inside, outside] = splitPolygon(interior, plane);
    if (outside.length >= 3) remaining.push(outside);
    interior = inside;
  }
  return remaining;
}

function clipInside(polygon: Polygon, planes: HalfSpace[]): Polygon {
  let result = polygon;
  for (const plane of planes) {
    result = splitPolygon(result, plane)[0];
    if (result.length < 3) return [];
  }
  return result;
}

function appendPolygon(output: number[], polygon: Polygon, desiredNormal?: THREE.Vector3) {
  if (polygon.length < 3) return;
  for (let i = 1; i < polygon.length - 1; i++) {
    const a = polygon[0], b = polygon[i], c = polygon[i + 1];
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.lengthSq() < EPS * EPS) continue;
    const reverse = desiredNormal && normal.dot(desiredNormal) < 0;
    for (const point of reverse ? [a, c, b] : [a, b, c]) output.push(point.x, point.y, point.z);
  }
}

function trianglesFromGeometry(source: THREE.BufferGeometry): Polygon[] {
  const positions = source.getAttribute('position');
  const index = source.index;
  const count = index ? index.count : positions.count;
  const triangles: Polygon[] = [];
  for (let i = 0; i + 2 < count; i += 3) {
    triangles.push([0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset)));
  }
  return triangles;
}

/** Slice the existing extrusion, including its slots/bores and bevel offset.
 * This avoids reconstructing the profile as a box or guessing its wall shape.
 */
function sectionTriangles(triangles: Polygon[]): THREE.Vector2[][] {
  const vertices = new Map<string, THREE.Vector2>();
  const neighbors = new Map<string, Set<string>>();
  const key = (point: THREE.Vector3) => `${Math.round(point.y * 1e7)},${Math.round(point.z * 1e7)}`;
  const link = (a: THREE.Vector3, b: THREE.Vector3) => {
    const ak = key(a), bk = key(b);
    if (ak === bk) return;
    vertices.set(ak, new THREE.Vector2(a.y, a.z));
    vertices.set(bk, new THREE.Vector2(b.y, b.z));
    if (!neighbors.has(ak)) neighbors.set(ak, new Set());
    if (!neighbors.has(bk)) neighbors.set(bk, new Set());
    neighbors.get(ak)!.add(bk);
    neighbors.get(bk)!.add(ak);
  };
  for (const triangle of triangles) {
    if (triangle.every(p => p.x > EPS) || triangle.every(p => p.x < -EPS)) continue;
    const hits: THREE.Vector3[] = [];
    for (let i = 0; i < 3; i++) {
      const a = triangle[i], b = triangle[(i + 1) % 3];
      if (Math.abs(a.x) <= EPS) hits.push(a);
      if (a.x * b.x < 0) hits.push(a.clone().lerp(b, -a.x / (b.x - a.x)));
    }
    const unique = [...new Map(hits.map(point => [key(point), point])).values()];
    if (unique.length === 2) link(unique[0], unique[1]);
  }
  const visited = new Set<string>();
  const loops: THREE.Vector2[][] = [];
  for (const start of vertices.keys()) {
    if (visited.has(start)) continue;
    const loop: THREE.Vector2[] = [];
    let current = start, previous = '';
    for (let step = 0; step <= vertices.size; step++) {
      if (visited.has(current)) break;
      visited.add(current);
      loop.push(vertices.get(current)!);
      const next = [...(neighbors.get(current) || [])].find(candidate => candidate !== previous);
      if (!next) break;
      previous = current;
      current = next;
      if (current === start) break;
    }
    if (loop.length >= 3 && current === start) loops.push(loop);
  }
  const contains = (loop: THREE.Vector2[], point: THREE.Vector2) => {
    let inside = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i], b = loop[j];
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  const depths = loops.map((loop, i) => loops.filter((outer, j) => i !== j && contains(outer, loop[0])).length);
  const result: THREE.Vector2[][] = [];
  loops.forEach((outer, i) => {
    if (depths[i] % 2 !== 0) return;
    const holes = loops.filter((loop, j) => depths[j] === depths[i] + 1 && contains(outer, loop[0]));
    const points = [...outer, ...holes.flat()];
    for (const face of THREE.ShapeUtils.triangulateShape(outer, holes)) result.push(face.map(index => points[index]));
  });
  return result;
}

function sectionPrismPlanes(triangle: THREE.Vector2[]): HalfSpace[] {
  const area = THREE.ShapeUtils.area(triangle);
  return triangle.map((a, i) => {
    const b = triangle[(i + 1) % 3];
    const normal = new THREE.Vector3(0, b.y - a.y, a.x - b.x).multiplyScalar(area > 0 ? 1 : -1).normalize();
    return { normal, distance: normal.y * a.x + normal.z * a.y };
  });
}

function roundedRectangle(centerX: number, centerCross: number, length: number, width: number): THREE.Vector2[] {
  // Small cutter-radius corners match the photograph without changing the
  // catalog's overall 3/8 × 14 mm aperture envelope.
  const radius = Math.min(width / 2, 1 / 100 * (length / (14 / 100)));
  const result: THREE.Vector2[] = [];
  const corners = [
    [centerX + length / 2 - radius, centerCross + width / 2 - radius, 0],
    [centerX - length / 2 + radius, centerCross + width / 2 - radius, Math.PI / 2],
    [centerX - length / 2 + radius, centerCross - width / 2 + radius, Math.PI],
    [centerX + length / 2 - radius, centerCross - width / 2 + radius, Math.PI * 1.5],
  ];
  for (const [x, y, start] of corners) {
    for (let step = 0; step <= 3; step++) {
      const angle = start + step * Math.PI / 6;
      result.push(new THREE.Vector2(x + radius * Math.cos(angle), y + radius * Math.sin(angle)));
    }
  }
  return result;
}

/** Subtract real single-face A-pillar apertures from an existing profile mesh.
 * The source is already centred and rotated so the member runs along X.
 * Returns a new geometry when cuts apply, otherwise returns source untouched.
 * Slot side walls and a recessed cavity floor retain normal depth occlusion;
 * the opposite profile face is never removed by a half-section display cut.
 */
export function applyAPillarMillingGeometry(source: THREE.BufferGeometry, options: APillarGeometryOptions): THREE.BufferGeometry {
  const scale = options.sceneScale ?? 100;
  const numbers = [scale, options.lengthMm, options.sectionWidthMm, options.sectionHeightMm, options.slotWidthMm, options.slotLengthMm, options.cutDepthMm];
  if (numbers.some(value => !Number.isFinite(value) || value <= 0) || !['A', 'B', 'C', 'D'].includes(options.face)) return source;
  const centers = [...new Set(options.centersMm)].filter(value => Number.isFinite(value)
    && value - options.slotLengthMm / 2 >= 0 && value + options.slotLengthMm / 2 <= options.lengthMm).sort((a, b) => a - b);
  const offsets = [...new Set(options.columnOffsetsMm)].filter(Number.isFinite);
  if (centers.length === 0 || offsets.length === 0) return source;
  const normalAxis = options.face === 'A' || options.face === 'C' ? 'y' : 'z';
  const crossAxis = normalAxis === 'y' ? 'z' : 'y';
  const sign = options.face === 'A' || options.face === 'B' ? 1 : -1;
  const halfDepth = (normalAxis === 'y' ? options.sectionHeightMm : options.sectionWidthMm) / (2 * scale);
  const outward = new THREE.Vector3(0, normalAxis === 'y' ? sign : 0, normalAxis === 'z' ? sign : 0);
  const outerDepth = halfDepth + 2 / scale;
  const innerDepth = halfDepth - Math.min(options.cutDepthMm / scale, halfDepth);
  const map = (point: THREE.Vector2, depth: number) => {
    const result = new THREE.Vector3(point.x, 0, 0);
    result[crossAxis] = point.y;
    result[normalAxis] = depth * sign;
    return result;
  };
  const triangles = trianglesFromGeometry(source);
  const section = sectionTriangles(triangles).map(sectionPrismPlanes);
  if (section.length === 0) return source;
  const positions: number[] = [];
  const slotLength = options.slotLengthMm / scale;
  const cutters = centers.map(center => offsets.map(offset => {
    const contour = roundedRectangle((center - options.lengthMm / 2) / scale, offset / scale, slotLength, options.slotWidthMm / scale);
    const planes: HalfSpace[] = [
      { normal: outward.clone(), distance: outerDepth },
      { normal: outward.clone().negate(), distance: -innerDepth },
    ];
    contour.forEach((a, i) => {
      const b = contour[(i + 1) % contour.length];
      const normal = new THREE.Vector3(b.y - a.y, 0, 0);
      normal[crossAxis] = a.x - b.x;
      normal.normalize();
      planes.push({ normal, distance: normal.dot(map(a, 0)) });
    });
    return { contour, planes };
  }));
  // Each axial slice intersects at most one station. Clipping long original
  // facets once per slice avoids repeatedly subdividing already-milled facets.
  const boundaries = [...new Set(centers.flatMap(center => [
    (center - options.lengthMm / 2) / scale - slotLength / 2,
    (center - options.lengthMm / 2) / scale + slotLength / 2,
  ]))].sort((a, b) => a - b);
  const intervals = [-Infinity, ...boundaries, Infinity];
  for (const triangle of triangles) {
    // Most extrusion faces never intersect the narrow machining strip. Keep
    // them intact instead of splitting every long face at all 120 stations.
    const minCross = Math.min(...triangle.map(point => point[crossAxis]));
    const maxCross = Math.max(...triangle.map(point => point[crossAxis]));
    const maxDepth = Math.max(...triangle.map(point => point[normalAxis] * sign));
    const halfSlotWidth = options.slotWidthMm / (2 * scale);
    if (maxDepth < innerDepth - EPS || offsets.every(offset => maxCross < offset / scale - halfSlotWidth - EPS || minCross > offset / scale + halfSlotWidth + EPS)) {
      appendPolygon(positions, triangle);
      continue;
    }
    const minX = Math.min(...triangle.map(p => p.x)), maxX = Math.max(...triangle.map(p => p.x));
    for (let i = 0; i < intervals.length - 1; i++) {
      const start = intervals[i], end = intervals[i + 1];
      if (maxX < start - EPS || minX > end + EPS) continue;
      const slab: HalfSpace[] = [];
      if (Number.isFinite(start)) slab.push({ normal: new THREE.Vector3(-1, 0, 0), distance: -start });
      if (Number.isFinite(end)) slab.push({ normal: new THREE.Vector3(1, 0, 0), distance: end });
      let fragments = [clipInside(triangle, slab)].filter(poly => poly.length >= 3);
      if (fragments.length === 0) continue;
      const midpoint = (start + end) / 2;
      const station = centers.findIndex(center => Math.abs(midpoint - (center - options.lengthMm / 2) / scale) < slotLength / 2 + EPS);
      if (station >= 0) for (const cutter of cutters[station]) fragments = fragments.flatMap(poly => subtractConvex(poly, cutter.planes));
      for (const fragment of fragments) appendPolygon(positions, fragment);
    }
  }
  // Fill cutter walls only where the actual cross-section contains material.
  // Triangular section prisms partition that material, so their clipped walls
  // meet without covering a bore, a groove, or the milled aperture itself.
  for (const station of cutters) for (const cutter of station) {
    cutter.contour.forEach((a, i) => {
      const b = cutter.contour[(i + 1) % cutter.contour.length];
      const wall = [map(a, outerDepth), map(b, outerDepth), map(b, innerDepth), map(a, innerDepth)];
      const inwardNormal = cutter.planes[i + 2].normal.clone().negate();
      for (const prism of section) appendPolygon(positions, clipInside(wall, prism), inwardNormal);
    });
    const floor = cutter.contour.map(point => map(point, innerDepth));
    for (const prism of section) appendPolygon(positions, clipInside(floor, prism), outward);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.aPillarMilling = { stationCount: centers.length, slotCount: centers.length * offsets.length, face: options.face };
  // Share coincident vertices with the same normal; sharp edges keep their
  // distinct normals while repeated slot walls use much less GPU memory.
  const indexed = mergeVertices(geometry, 1e-6);
  geometry.dispose();
  return indexed;
}
