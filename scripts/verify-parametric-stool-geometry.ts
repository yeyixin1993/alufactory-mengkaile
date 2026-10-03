import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Box3, Euler, Vector3 } from 'three';
import { buildStoolSourceTemplateFromAsset as buildStoolTemplateFromAsset, STOOL_BASELINE, STOOL_GROUND_OFFSET_MM, type StoolSourceAsset } from '../utils/parametricStool';
import type { ParametricSceneItem } from '../utils/parametricFurniture';

// This checks dimensional relationships against the archived model. Preserved
// source offsets are geometry evidence, never proof of fastening or load rating.
const asset = JSON.parse(fs.readFileSync(path.resolve(process.argv[2] || 'public/models/stool/source-v1.json'), 'utf8')) as StoolSourceAsset;
const archivedAsset = JSON.stringify(asset);
const near = (actual: number, expected: number, message: string, tolerance = 0.002) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} != ${expected}`);
const vectorNear = (actual: Vector3, expected: Vector3, message: string) => {
  for (const axis of ['x', 'y', 'z'] as const) near(actual[axis], expected[axis], `${message} ${axis}`);
};
const euler = (rotation: number[]) => new Euler(...rotation.map((angle) => angle * Math.PI / 180) as [number, number, number], 'XYZ');
const position = (item: { position: number[] }) => new Vector3(...item.position as [number, number, number]);
const axisOf = (item: { rotation: number[] }, axis = 0) => new Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0).applyEuler(euler(item.rotation));
const endpoint = (item: { position: number[]; rotation: number[]; length?: number }, end: -1 | 1) =>
  position(item).addScaledVector(axisOf(item), end * item.length! / 2);
const itemBox = (item: ParametricSceneItem) => {
  const box = new Box3();
  const rotation = euler(item.rotation); const center = position(item);
  if (item.sourceMesh) {
    const vertices = item.sourceMesh.positionsMm;
    for (let index = 0; index < vertices.length; index += 3) {
      box.expandByPoint(new Vector3(vertices[index], vertices[index + 1], vertices[index + 2]).applyEuler(rotation).add(center));
    }
  } else {
    const sizes = item.kind === 'profile' ? [item.length!, 30, 30] : [item.width!, item.height!, item.thickness!];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      box.expandByPoint(new Vector3(x * sizes[0] / 2, y * sizes[1] / 2, z * sizes[2] / 2).applyEuler(rotation).add(center));
    }
  }
  return box;
};
const baseline = buildStoolTemplateFromAsset(STOOL_BASELINE, asset);
const sourceById = new Map(baseline.items.map((item) => [item.id, item]));
const verticalParts = asset.nativeParts.filter((part) => part.kind === 'profile' && Math.abs(axisOf(part).y) > 0.99);
const nativeProfiles = asset.nativeParts.filter((part) => part.kind === 'profile');
const itemId = (part: { id: string }) => `parametric-stool-${part.id}`;
const sourceCountById = new Map<string, number>();
asset.nativeParts.forEach((part) => {
  if (part.sourceItemId) sourceCountById.set(part.sourceItemId, (sourceCountById.get(part.sourceItemId) || 0) + 1);
});
const nativeBySourceId = new Map(asset.nativeParts.filter((part) => part.sourceItemId && sourceCountById.get(part.sourceItemId) === 1)
  .map((part) => [part.sourceItemId!, part]));
assert.equal(nativeProfiles.reduce((count, item) => count + (item.holes?.length || 0), 0), 20, 'Archive must retain all source machining records');

for (const dimensions of [STOOL_BASELINE, { widthMm: 600, depthMm: 600, heightMm: 800 }, { widthMm: 450, depthMm: 520, heightMm: 650 }]) {
  const label = `${dimensions.widthMm}x${dimensions.depthMm}x${dimensions.heightMm}`;
  const payload = buildStoolTemplateFromAsset(dimensions, asset);
  const current = new Map(payload.items.map((item) => [item.id, item]));
  const boxes = new Map(payload.items.map((item) => [item.id, itemBox(item)]));
  const whole = new Box3(); boxes.forEach((box) => whole.union(box));
  const wholeSize = whole.getSize(new Vector3());
  near(whole.min.y, 0, `${label} source casters stay on ground`);
  near(wholeSize.x, dimensions.widthMm + 39.65204513941535, `${label} overall X envelope`);
  near(wholeSize.z, dimensions.depthMm + 54.4734620386057, `${label} overall Z envelope`);
  near(wholeSize.y, dimensions.heightMm + STOOL_GROUND_OFFSET_MM, `${label} overall Y envelope`);

  for (const part of asset.nativeParts) {
    const item = current.get(itemId(part))!;
    assert.deepEqual(item.rotation, part.rotation, `${label} source local axes stay intact: ${part.id}`);
    if (part.kind === 'marine_board') {
      const size = boxes.get(item.id)!.getSize(new Vector3());
      near(size.x, dimensions.widthMm - 60, `${label} board world width`);
      near(size.z, dimensions.depthMm - 60, `${label} board world depth`);
      near(size.y, 18, `${label} board thickness`);
      continue;
    }
    const axis = axisOf(part);
    const expectedLength = Math.abs(axis.y) > 0.99
      ? (part.length === 80 ? 80 : dimensions.heightMm - 90)
      : (Math.abs(axis.x) > 0.99 ? dimensions.widthMm : dimensions.depthMm) - (part.length === 240 ? 120 : 60);
    near(item.length!, expectedLength, `${label} native cut axis length ${part.id}`);
    assert.equal(item.tappingLeft, Boolean(part.tappingLeft));
    assert.equal(item.tappingRight, Boolean(part.tappingRight));
    assert.equal(item.holes!.length, part.holes?.length || 0);
    (part.holes || []).forEach((originalHole, index) => {
      const hole = item.holes![index];
      const { id: _sourceId, positionMm: _sourcePosition, jointKey: _sourceJoint, ...sourceSpecification } = originalHole;
      const { id: _id, positionMm: _position, jointKey: _joint, ...specification } = hole;
      assert.deepEqual(specification, sourceSpecification, `${label} original hole specification remains intact`);
      const targetSource = originalHole.jointKey!.split(':').map((token) => nativeBySourceId.get(token))
        .find((candidate) => candidate && candidate.id !== part.id)!;
      assert.ok(targetSource, `${label} source joint has an unambiguous partner`);
      const target = current.get(itemId(targetSource))!;
      assert.ok(hole.jointKey!.split(':').includes(target.id), `${label} hole relationship uses current IDs`);
      const holePoint = position(item).addScaledVector(axis, hole.positionMm - item.length! / 2);
      near(holePoint.clone().sub(position(target)).dot(axis), 0, `${label} hole follows mating divider/rail ${part.id}`);
      if (dimensions === STOOL_BASELINE) near(hole.positionMm, originalHole.positionMm, `${label} exact baseline hole position`);
    });
  }

  for (const part of asset.instances) {
    const item = current.get(itemId(part))!; const original = sourceById.get(item.id)!;
    assert.deepEqual(item.rotation, part.rotation, `${label} source component orientation`);
    assert.deepEqual(item.sourceMesh!.indices, original.sourceMesh!.indices, `${label} source topology`);
    assert.deepEqual(item.sourceMesh!.materials, original.sourceMesh!.materials, `${label} source appearance`);
    if (part.type !== 'shaft') assert.deepEqual(item.sourceMesh!.positionsMm, original.sourceMesh!.positionsMm, `${label} rigid source mesh ${part.id}`);
    if (dimensions === STOOL_BASELINE) {
      vectorNear(position(item), position(part).add(new Vector3(0, STOOL_GROUND_OFFSET_MM, 0)), `${label} original source pose ${part.id}`);
    }
    if (part.type === 'angle_bracket') {
      const nearest = [...verticalParts].sort((a, b) =>
        Math.hypot(a.position[0] - part.position[0], a.position[2] - part.position[2])
        - Math.hypot(b.position[0] - part.position[0], b.position[2] - part.position[2]))[0];
      const parent = current.get(itemId(nearest))!;
      for (const axis of [0, 2]) near(item.position[axis] - parent.position[axis], part.position[axis] - nearest.position[axis],
        `${label} bracket preserves actual offset to closest vertical ${part.id}`);
      near(item.position[1] - original.position[1], dimensions.heightMm - 500, `${label} bracket stays with upper band`);
    }
    if (part.type === 'fixed_support') {
      const parentPath = part.sourcePath.slice(0, part.sourcePath.lastIndexOf('/'));
      const originalRail = nativeProfiles.find((candidate) => candidate.sourcePath.startsWith(`${parentPath}/`))!;
      assert.ok(originalRail, 'Fixed source support must retain its actual nested rail');
      const rail = current.get(itemId(originalRail))!;
      const axis = axisOf(originalRail);
      const side = position(part).sub(position(originalRail)).dot(axis) > 0 ? 1 : -1;
      vectorNear(position(item).sub(endpoint(rail, side)), position(part).sub(endpoint(originalRail, side)),
        `${label} fixed support keeps rail-end offset ${part.id}`);
    }
    if (part.type === 'shaft') {
      const shaftAxis = axisOf(part, part.lengthAxis);
      const axis = part.worldAxis!;
      near(Math.abs(shaftAxis.getComponent(axis)), 1, `${label} source shaft local/world axis agreement`);
      const baselineBox = itemBox(original); const currentBox = boxes.get(item.id)!;
      const increment = (axis === 0 ? dimensions.widthMm : dimensions.depthMm) - 360;
      near(currentBox.getSize(new Vector3()).getComponent(axis) - baselineBox.getSize(new Vector3()).getComponent(axis), increment, `${label} shaft length follows correct world direction`);
      for (const transverse of [0, 1, 2].filter((value) => value !== axis)) {
        near(currentBox.getSize(new Vector3()).getComponent(transverse), baselineBox.getSize(new Vector3()).getComponent(transverse), `${label} shaft cross section is unchanged`);
      }
      const supports = asset.instances.filter((candidate) => candidate.type === 'shaft_support' && candidate.sourcePath.startsWith(`${part.sourcePath}/`));
      assert.equal(supports.length, 2);
      for (const support of supports) {
        const before = sourceById.get(itemId(support))!; const after = current.get(itemId(support))!;
        const end = Math.abs(before.position[axis] - baselineBox.min.getComponent(axis)) < Math.abs(before.position[axis] - baselineBox.max.getComponent(axis)) ? 'min' : 'max';
        near(after.position[axis] - currentBox[end].getComponent(axis), before.position[axis] - baselineBox[end].getComponent(axis), `${label} shaft end/support offset`);
        for (const transverse of [0, 1, 2].filter((value) => value !== axis)) {
          near(after.position[transverse] - item.position[transverse], before.position[transverse] - original.position[transverse], `${label} shaft/support bore alignment`);
        }
      }
    }
    if (part.type === 'three_way') {
      const neighbors = nativeProfiles.flatMap((profile) => ([-1, 1] as const).map((end) => ({ profile, end, point: endpoint(profile, end) })))
        .filter((candidate) => candidate.point.distanceTo(position(part)) < 20);
      assert.ok(neighbors.length >= 2, `${label} three-way source corner has at least two original rail ends`);
      neighbors.forEach(({ profile, end, point }) => vectorNear(
        position(item).sub(endpoint(current.get(itemId(profile))!, end)),
        position(part).sub(point), `${label} three-way connection end offsets ${part.id}`));
    }
    if (part.type === 'caster') {
      const leg = [...verticalParts.filter((candidate) => candidate.length === 410)].sort((a, b) => endpoint(a, -1).distanceTo(position(part)) - endpoint(b, -1).distanceTo(position(part)))[0];
      vectorNear(position(item).sub(endpoint(current.get(itemId(leg))!, -1)), position(part).sub(endpoint(leg, -1)), `${label} caster stays with its leg foot`);
    }
    if (part.type === 'handle') {
      const rail = asset.nativeParts.find((candidate) => candidate.id === 'stool-decor-lower-front')!;
      vectorNear(position(item).sub(position(current.get(itemId(rail))!)), position(part).sub(position(rail)), `${label} source handle stays with its mounting rail`);
    }
    if (part.type === 'decorative_profile') {
      const sideAxis = Math.abs(part.position[0]) > Math.abs(part.position[2]) ? 0 : 2;
      const runAxis = sideAxis === 0 ? 2 : 0;
      const sidePosts = verticalParts.filter((post) => Math.abs(post.position[sideAxis] - part.position[sideAxis]) < 0.002)
        .sort((a, b) => a.position[runAxis] - b.position[runAxis]);
      assert.equal(sidePosts.length, 4, `${label} decorative band has two legs and two dividers`);
      const opening = sidePosts.slice(0, -1).map((left, index) => ({
        left, right: sidePosts[index + 1],
        center: (left.position[runAxis] + sidePosts[index + 1].position[runAxis]) / 2,
      })).sort((a, b) => Math.abs(a.center - part.position[runAxis]) - Math.abs(b.center - part.position[runAxis]))[0];
      near(part.position[runAxis], opening.center, `${label} source decorative block identifies a real opening`);
      const left = current.get(itemId(opening.left))!; const right = current.get(itemId(opening.right))!;
      near(item.position[runAxis], (left.position[runAxis] + right.position[runAxis]) / 2, `${label} rigid decorative block stays centered between actual posts`);
      near(item.position[sideAxis] - left.position[sideAxis], part.position[sideAxis] - opening.left.position[sideAxis], `${label} decorative block stays on its side frame`);
    }
  }
  console.log(`${label}: world dimensions, 20 source holes/tapping, source rigidity, bracket offsets, shaft supports, fixed supports, decorative openings and corner/foot/handle relationships passed.`);
}
assert.equal(JSON.stringify(asset), archivedAsset, 'Generation must not mutate the archived source mesh or machining records');
