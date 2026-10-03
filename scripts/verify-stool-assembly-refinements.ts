import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Box3, Euler, Vector3 } from 'three';
import { buildStoolSourceTemplateFromAsset, STOOL_GROUND_OFFSET_MM, type StoolSourceAsset } from '../utils/parametricStool';
import { refineStoolSourceAssembly } from '../utils/stoolAssemblyRefinements';
import type { ParametricSceneItem } from '../utils/parametricFurniture';

const asset = JSON.parse(fs.readFileSync('public/models/stool/source-v1.json', 'utf8')) as StoolSourceAsset;
const archived = JSON.stringify(asset);
const near = (a: number, b: number, message: string, tolerance = 0.00002) =>
  assert.ok(Math.abs(a - b) < tolerance, `${message}: ${a} != ${b}`);
const rotation = (item: ParametricSceneItem) => new Euler(...item.rotation.map((v) => v * Math.PI / 180) as [number, number, number], 'XYZ');
const world = (item: ParametricSceneItem, xyz: number[]) => new Vector3(...xyz as [number, number, number])
  .applyEuler(rotation(item)).add(new Vector3(...item.position));
const vertices = (item: ParametricSceneItem) => {
  const p = item.sourceMesh!.positionsMm; const out: Vector3[] = [];
  for (let n = 0; n < p.length; n += 3) out.push(world(item, p.slice(n, n + 3)));
  return out;
};
const byPath = (items: ParametricSceneItem[], path: string) => items.find((item) => item.sourceMesh?.source.instancePath === path)!;

for (const parameters of [
  { widthMm: 360, depthMm: 360, heightMm: 500 },
  { widthMm: 600, depthMm: 600, heightMm: 800 },
  { widthMm: 450, depthMm: 520, heightMm: 650 },
]) {
  const source = buildStoolSourceTemplateFromAsset(parameters, asset).items;
  const beforePositions = source.map((item) => [...item.position]);
  const corrected = refineStoolSourceAssembly(source, parameters);
  near(corrected.filter((item, index) => item !== source[index]).length, 13, 'Only measured assemblies corrected');
  for (let n = 0; n < source.length; n++) {
    assert.deepEqual(source[n].position, beforePositions[n], 'Input pose is immutable');
    assert.equal(corrected[n].sourceMesh, source[n].sourceMesh, 'Source geometry/metadata retain identity');
    assert.equal(corrected[n].rotation, source[n].rotation, 'Source orientation is preserved');
  }
  const repeated = refineStoolSourceAssembly(corrected, parameters);
  corrected.forEach((item, i) => {
    assert.deepEqual(repeated[i].position, item.position, 'Idempotent pose');
    assert.equal(repeated[i].remark, item.remark, 'Idempotent assembly note');
  });

  const handle = byPath(corrected, 'root/instances-41');
  const handlePoints = vertices(handle);
  const plane = parameters.depthMm / 2;
  const mountY = 315 + parameters.heightMm - 500 + STOOL_GROUND_OFFSET_MM;
  const hBounds = new Box3().setFromPoints(handlePoints);
  near(hBounds.min.z, plane, 'Actual handle rear plane contacts front rail');
  near(hBounds.max.z + parameters.depthMm / 2, parameters.depthMm + 52, 'New overall depth');
  const indices = handle.sourceMesh!.indices;
  const uniqueFaces = new Set<string>(); let rearArea = 0;
  for (let n = 0; n < indices.length; n += 3) {
    const triangle = indices.slice(n, n + 3).map((index) => handlePoints[index]);
    if (!triangle.every((p) => Math.abs(p.z - plane) < 0.00001)) continue;
    const key = triangle.map((p) => p.toArray().map((v) => v.toFixed(5)).join(',')).sort().join('|');
    if (uniqueFaces.has(key)) continue;
    uniqueFaces.add(key);
    rearArea += triangle[1].clone().sub(triangle[0]).cross(triangle[2].clone().sub(triangle[0])).length() / 2;
  }
  assert.equal(uniqueFaces.size, 384, 'Both real mounting-pad faces are represented');
  near(rearArea, 615.275412625477, 'Real mounting-pad area', 0.0001);
  for (const x of [-56, 56]) {
    const circularRim = new Set(handlePoints.filter((p) => Math.abs(p.z - plane) < 0.00001
      && Math.abs(Math.hypot(p.x - x, p.y - mountY) - 2.7) < 0.00001)
      .map((p) => p.toArray().map((v) => v.toFixed(5)).join(',')));
    assert.equal(circularRim.size, 96, 'Actual Ø5.4 hole rim aligns with ±56 mm and rail slot');
  }

  for (let assembly = 1; assembly <= 4; assembly++) {
    const alongX = assembly === 1 || assembly === 4;
    const axis = alongX ? 0 : 2; const crossAxis = alongX ? 2 : 0;
    const shaft = byPath(corrected, `root/instances-${assembly}`);
    const shaftBounds = new Box3().setFromPoints(vertices(shaft));
    const expectedLength = 287.3 + (alongX ? parameters.widthMm : parameters.depthMm) - 360;
    near(shaftBounds.getSize(new Vector3()).getComponent(axis), expectedLength, 'Original shaft length plus size increment');
    near(shaft.position[axis], 0, 'Shaft axis centred between legs');
    near(shaft.position[1], 90 + STOOL_GROUND_OFFSET_MM, 'Bottom mechanism keeps its source height');
    for (let end = 1; end <= 2; end++) {
      const support = byPath(corrected, `root/instances-${assembly}/instances-${end}`);
      const bore = world(support, [0, 0, -1.5]);
      near(bore.y, shaft.position[1], 'Support bore and shaft share height');
      near(bore.getComponent(crossAxis), shaft.position[crossAxis], 'Support bore and shaft share cross centre');
      const local = support.sourceMesh!.positionsMm;
      let measuredCylindricalPoints = 0;
      for (let n = 0; n < local.length; n += 3) {
        if (Math.abs(Math.hypot(local[n], local[n + 2] + 1.5) - 6) > 0.00001) continue;
        measuredCylindricalPoints++;
        const p = world(support, local.slice(n, n + 3));
        near(Math.hypot(p.y - shaft.position[1], p.getComponent(crossAxis) - shaft.position[crossAxis]), 6,
          'Actual bore-wall vertices stay 6 mm from the shaft axis');
      }
      assert.ok(measuredCylindricalPoints > 1000, 'Check a real bore cylinder, not a synthetic centre only');
      const bounds = new Box3().setFromPoints(vertices(support));
      const overlap = Math.min(bounds.max.getComponent(axis), shaftBounds.max.getComponent(axis))
        - Math.max(bounds.min.getComponent(axis), shaftBounds.min.getComponent(axis));
      near(overlap, 6.65, 'Equal shaft insertion into each source support');
      near(end === 1 ? bounds.max.getComponent(axis) : -bounds.min.getComponent(axis),
        (alongX ? parameters.widthMm : parameters.depthMm) / 2 - 30, 'Real support back plane stays against the leg');
    }
  }
}
assert.equal(JSON.stringify(asset), archived, 'Original asset geometry and provenance remain immutable');
console.log('Stool assembly refinement: source immutability, 3 size cases, actual handle faces/rims, eight bore cylinders, equal shaft insertion and 412 mm baseline depth passed.');
