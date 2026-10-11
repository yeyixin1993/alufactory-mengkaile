import assert from 'node:assert/strict';
import { completeParametricFurnitureTemplate } from '../components/DIYDesigner';
import { Vector3, Euler } from 'three';
import { buildWardrobeTemplate, getWardrobeProfileCount } from '../utils/parametricFurniture';
import { profileSectionCenters } from '../utils/profileMachining';

assert.deepEqual(profileSectionCenters(47, 3, '2047'), [13.5, 0, -13.5]);
assert.deepEqual(profileSectionCenters(47, 2, '2047'), [13.5, -13.5]);
assert.deepEqual(profileSectionCenters(40, 2, '2040'), [10, -10]);
for (const frame of ['2040_2020', '2047_2020', '3030'] as const) {
  for (const [length, depth, height, layers, requestedColumns] of [[1200, 600, 2200, 5, 1], [1301, 601, 2201, 3, 3], [400, 300, 500, 1, 2], [3000, 3000, 3000, 20, 9], [3000, 600, 1000, 1, 9], [750, 300, 500, 1, 9]]) {
    const payload = buildWardrobeTemplate(length, depth, height, layers, requestedColumns, frame);
    const columns = Number(payload.summary.columns);
    const profiles = payload.items.filter((item) => item.kind === 'profile');
    const boards = payload.items.filter((item) => item.kind === 'marine_board');
    assert.equal(profiles.length, getWardrobeProfileCount(columns, layers, frame));
    assert.equal(boards.length, (layers + 2) * columns);
    assert.equal(payload.source, 'wardrobe');
    assert.equal(payload.finishedFurniture?.productId, 'p8');
    assert.equal(payload.finishedFurniture?.pricingModel, 'component_total');
    assert.equal(payload.finishedFurniture?.totalPriceCny, undefined);
    assert(profiles.every((item) => item.length! > 20 && item.length! <= 3000));
    assert(boards.every((item) => Number.isInteger(item.width) && Number.isInteger(item.height)));
    if (frame !== '2040_2020' && (columns <= 3 || layers === 1)) {
      const completed = completeParametricFurnitureTemplate(payload);
      assert(completed.check.valid, `${frame}: ${completed.check.issues.join('; ')}`);
      assert(completed.items.filter((item) => item.kind === 'connector').every((item) => item.lockedPosition), `${frame}: unresolved brackets`);
      console.log(frame, columns, completed.items.filter((item) => item.kind === 'connector').length, completed.items.filter((item) => item.kind === 'screw').length);
    }
    if (frame === '2047_2020') {
      const casters = payload.items.filter((item) => item.kind === 'caster');
      const posts = profiles.filter((item) => item.variantId === '2047');
      assert.equal(casters.length, 2 * (columns + 1));
      assert(casters.every((item) => item.accessoryThreadSize === 'M8'));
      assert(posts.every((item) => item.position[1] - item.length! / 2 === 62));
      assert.equal(profiles.filter((item) => item.variantId === '2020-N1').length, 1 + (layers + 1) * columns);
      for (const item of profiles.filter((item) => item.variantId === '2020-N1' || (item.variantId === '2047' && item.position[2] > 0))) {
        const normal = new Vector3(0, 1, 0).applyEuler(new Euler(...item.rotation.map((value) => value * Math.PI / 180) as [number, number, number]));
        assert(normal.z > 0.999, 'Sealed A face must face forward');
      }
      const depthTopRails = profiles.filter((item) => item.variantId === '2020' && item.rotation[1] === 90 && item.holes?.length);
      assert.equal(depthTopRails.length, columns + 1);
      assert(depthTopRails.every((item) => item.holes![0].positionMm === 17 && item.holes![1].positionMm === item.length! - 17));
    }
    if (frame === '3030') {
      assert(profiles.every((item) => item.variantId === '3030'));
      assert(boards.every((item) => item.thickness === 18));
      assert(!payload.items.some((item) => item.shelfSupportType === 'drawer_slide_pair' || item.shelfSupportType === 'board_12mm'));
      const posts = profiles.filter((item) => item.rotation[2] === 90);
      assert.equal(posts.length, 2 * (columns + 1));
      assert(posts.every((item) => item.position[1] - item.length! / 2 === 0 && item.length === height - 18));
      assert.equal(Math.max(...boards.map((item) => item.position[1] + item.thickness! / 2)), height);
    }
  }
}
console.log('Wardrobe frame, material, pricing isolation and 2047 section checks passed.');
