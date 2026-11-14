import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyAPillarMillingGeometry, type APillarGeometryOptions } from '../utils/aPillarGeometry';
import { createChatProfilePreview } from '../components/DIYDesigner';
import type { ProfileSide } from '../types';

const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
function bodyGeometry(variantId: string, length = 200): THREE.BufferGeometry {
  const group = createChatProfilePreview({ variantId, length, colorId: 'natural', finish: 'oxidized', holes: [], tapping: { left: [], right: [] } });
  const body = group.children.find(child => child instanceof THREE.Mesh) as THREE.Mesh;
  assert(body, `${variantId}: source profile body`);
  return body.geometry;
}
function hit(geometry: THREE.BufferGeometry, x: number, cross: number, face: ProfileSide) {
  const wide = face === 'B' || face === 'D';
  const sign = face === 'A' || face === 'B' ? 1 : -1;
  const origin = new THREE.Vector3(x, wide ? cross : sign, wide ? sign : cross);
  const direction = new THREE.Vector3(0, wide ? 0 : -sign, wide ? -sign : 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld(true);
  return new THREE.Raycaster(origin, direction).intersectObject(mesh, false)[0];
}
const options: APillarGeometryOptions = {
  face: 'B', lengthMm: 200, sectionWidthMm: 20, sectionHeightMm: 40,
  centersMm: [12, 37, 62, 87, 112, 137, 162, 187], columnOffsetsMm: [0],
  slotWidthMm: 3, slotLengthMm: 14, cutDepthMm: 10,
};

for (const [model, width, height, face] of [
  ['2040', 20, 40, 'B'], ['2040-N1-20', 20, 40, 'A'], ['2040-N1-40', 20, 40, 'D'],
  ['2047', 20, 47, 'B'], ['3030-N1', 30, 30, 'A'], ['3030-N2', 30, 30, 'B'],
] as const) {
  const source = bodyGeometry(model);
  const originalPositions = Array.from(source.getAttribute('position').array);
  const local = { ...options, face, sectionWidthMm: width, sectionHeightMm: height, cutDepthMm: (face === 'A' ? height : width) / 2 };
  const milled = applyAPillarMillingGeometry(source, local);
  assert.notEqual(milled, source);
  assert.deepEqual(Array.from(source.getAttribute('position').array), originalPositions, 'source must not mutate');
  assert.equal(milled.userData.aPillarMilling.slotCount, 8);
  for (const center of options.centersMm) {
    const x = (center - 100) / 100;
    const before = hit(source, x, 0, face);
    const after = hit(milled, x, 0, face);
    assert(before && after, `${model}: wall and recessed interior must be real geometry`);
    assert(after.distance - before.distance > 0.04, `${model}: slot must remove the front face, not paint it (${before.distance} -> ${after.distance})`);
    const side: ProfileSide = ({ A: 'C', B: 'D', C: 'A', D: 'B' } as const)[face];
    const backBefore = hit(source, x, 0, side), backAfter = hit(milled, x, 0, side);
    assert(backBefore && backAfter);
    assert(Math.abs(backBefore.distance - backAfter.distance) < 1e-6, `${model}: back side retained`);
    const landBefore = hit(source, x + 0.09, 0, face), landAfter = hit(milled, x + 0.09, 0, face);
    if (center < 180) {
      assert(landBefore && landAfter);
      assert(Math.abs(landBefore.distance - landAfter.distance) < 1e-6, `${model}: 11mm land between slots retained`);
    }
  }
  for (const value of milled.getAttribute('position').array) assert(Number.isFinite(value));
  source.computeBoundingBox();
  assert(milled.boundingBox!.min.distanceTo(source.boundingBox!.min) < 1e-6);
  assert(milled.boundingBox!.max.distanceTo(source.boundingBox!.max) < 1e-6);
  milled.dispose();
}

const source = bodyGeometry('2047');
const doubled = applyAPillarMillingGeometry(source, { ...options, sectionHeightMm: 47, columnOffsetsMm: [-4, 4] });
assert.equal(doubled.userData.aPillarMilling.slotCount, 16);
for (const cross of [-0.04, 0.04]) {
  assert(hit(doubled, -0.88, cross, 'B')!.distance > hit(source, -0.88, cross, 'B')!.distance + 0.04, 'both columns are actual cuts');
}
assert(Math.abs(hit(doubled, -0.88, 0, 'B')!.distance - hit(source, -0.88, 0, 'B')!.distance) < 1e-6, '5mm central web retained');
const wide = applyAPillarMillingGeometry(source, { ...options, sectionHeightMm: 47, slotWidthMm: 8 });
for (const cross of [-0.03, 0.03]) assert(hit(wide, -0.88, cross, 'B')!.distance > hit(source, -0.88, cross, 'B')!.distance + 0.04, '8mm aperture width');
assert.equal(applyAPillarMillingGeometry(source, { ...options, centersMm: [0, 4, 199, 200, NaN] }), source, 'partial/end/invalid slots skipped');
assert.equal(applyAPillarMillingGeometry(source, { ...options, cutDepthMm: NaN }), source, 'invalid dimensions do not corrupt geometry');

const longSource = bodyGeometry('2047', 3000);
const start = performance.now();
const long = applyAPillarMillingGeometry(longSource, { ...options, lengthMm: 3000, sectionHeightMm: 47,
  centersMm: Array.from({ length: 120 }, (_, i) => 12 + i * 25), columnOffsetsMm: [-4, 4] });
const elapsed = performance.now() - start;
console.log(`A-pillar 3m double-row mesh: ${elapsed.toFixed(0)}ms, ${long.getAttribute('position').count} vertices.`);
assert.equal(long.userData.aPillarMilling.slotCount, 240);
assert(long.getAttribute('position').count < 1_000_000, 'full-length mesh remains bounded');
assert(elapsed < 10_000, `3m double-row geometry should finish under 10s (${elapsed.toFixed(0)}ms)`);
console.log(`PASS: true single-face A-pillar cuts across six profile variants; backing, lands, row spacing, all dimensions and invalid/end slots. 3m/240 slots: ${elapsed.toFixed(0)}ms, ${long.getAttribute('position').count} vertices.`);
