import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculatePrice, buildProductionData, completeParametricFurnitureTemplate } from '../components/DIYDesigner';
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
    if (columns <= 3 || layers === 1) {
      const completed = completeParametricFurnitureTemplate(payload);
      assert(completed.check.valid, `${frame}: ${completed.check.issues.join('; ')}`);
      assert(completed.items.filter((item) => item.kind === 'connector').every((item) => item.lockedPosition), `${frame}: unresolved brackets`);
      console.log(frame, columns, completed.items.filter((item) => item.kind === 'connector').length, completed.items.filter((item) => item.kind === 'screw').length);
    }
    if (frame === '2040_2020') {
      const widthRails = profiles.filter(item => item.rotation.every(value => value === 0));
      assert(widthRails.every(item => Math.abs(item.position[2]) === depth / 2 - 10), '2040 width rails must be flush to outer edges');
      assert(boards.every(item => item.height === depth - 42), 'All 2040 inset boards must use full frame depth minus clearance');
    }
    if (frame === '2047_2020') {
      const casters = payload.items.filter((item) => item.kind === 'caster');
      const posts = profiles.filter((item) => item.variantId === '2047');
      assert.equal(casters.length, 4);
      assert(casters.every((item) => item.accessoryThreadSize === 'M8'));
      assert(posts.every((item) => item.position[1] - item.length! / 2 === 62));
      assert.equal(profiles.filter((item) => item.variantId === '2020-N1').length, 2 + 2 * (layers + 1) * columns);
      for (const item of profiles.filter((item) => item.variantId === '2020-N1' || (item.variantId === '2047' && item.position[2] > 0))) {
        const normal = new Vector3(0, 1, 0).applyEuler(new Euler(...item.rotation.map((value) => value * Math.PI / 180) as [number, number, number]));
        assert(normal.z * Math.sign(item.position[2]) > 0.999, 'Sealed A face must face outward');
      }
      const depthTopRails = profiles.filter((item) => item.variantId === '2020' && item.rotation[1] === 90 && item.holes?.length);
      assert.equal(depthTopRails.length, columns + 1);
      assert(depthTopRails.every((item) => item.holes![0].positionMm === 17 && item.holes![1].positionMm === item.length! - 17));
    }
    if (frame === '3030') {
      assert(profiles.every((item) => item.variantId === '3030'));
      const supports = payload.items.filter(item => item.shelfSupportType === 'board_18mm');
      assert.equal(supports.length, boards.length * 8);
      assert(supports.every(item => item.accessoryPrice === 1.7 && item.attachedProfileIds?.length === 2));
      assert(boards.every((item) => item.thickness === 18 && item.height === depth - 62 + 2 * item.position[2]));
      assert(!payload.items.some((item) => item.shelfSupportType === 'drawer_slide_pair' || item.shelfSupportType === 'board_12mm'));
      const posts = profiles.filter((item) => item.rotation[2] === 90);
      assert.equal(posts.length, 2 * (columns + 1));
      assert(posts.every((item) => item.position[1] - item.length! / 2 === 0 && item.length === height));
      assert.equal(Math.max(...boards.map((item) => item.position[1] + item.thickness! / 2)), height);
    }
  }
}
console.log('Wardrobe frame, material, pricing isolation and 2047 section checks passed.');

const approved = JSON.parse(readFileSync('scripts/fixtures/wardrobe-2047-approved.json', 'utf8'));
const generated = buildWardrobeTemplate(1580, 450, 880, 1, 1, '2047_2020');
const project = (item: any) => Object.fromEntries(['kind', 'variantId', 'position', 'rotation', 'length', 'width', 'height', 'thickness', 'holes'].flatMap(key => {
  const value = key === 'holes' && item.kind === 'profile' ? (item.holes || []).map(({ side, type, positionMm }: any) => ({ side, type, positionMm })) : item[key];
  return value === undefined ? [] : [[key, value]];
}));
assert.deepEqual(generated.items.filter(item => ['profile', 'marine_board', 'caster'].includes(item.kind)).map(item => JSON.stringify(project(item))).sort(), approved.items.map((item: any) => {
  // Preserve the owner's original fixture; only the new middle-front clearance changes.
  const next = { ...item, position: [...item.position] };
  if (item.kind === 'profile' && item.variantId === '2020-N1' && item.position[1] === 502 && item.position[2] > 0) next.position[2] -= 27;
  if (item.kind === 'marine_board' && item.position[1] === 506) { next.position[2] -= 13.5; next.height -= 27; }
  return JSON.stringify(project(next));
}).sort());
const supported = completeParametricFurnitureTemplate(buildWardrobeTemplate(1200, 600, 2200, 2, 2, '3030')).items;
const supports = supported.filter(item => item.shelfSupportType === 'board_18mm');
assert(supports.every(item => calculatePrice(item) === 1.7));
assert(buildProductionData(supported, 'cn').parts.filter(item => item.shelfSupportType === 'board_18mm').every(item => item.accessoryPrice === 1.7));
assert(supported.filter(item => item.kind === 'profile' && ['top', 'bottom'].includes(item.cabinetFrameLevel || '')).every(item => !item.holes?.length && !item.tapping));
console.log('Approved 2047 fixture and 18mm support production/pricing checks passed.');

for (const frame of ['2040_2020', '2047_2020', '3030'] as const) {
  for (const base of ['caster', 'foot', 'none'] as const) {
    const payload = buildWardrobeTemplate(1300, 600, 1200, 1, 3, frame, base);
    const expected = frame === '2040_2020' ? 'none' : base;
    const accessories = payload.items.filter(item => item.kind === 'caster' || item.kind === 'foot');
    assert.equal(accessories.length, expected === 'none' ? 0 : expected === 'caster' ? 4 : 8);
    assert.equal(payload.summary.baseOption, expected);
    const posts = payload.items.filter(item => item.kind === 'profile' && item.rotation[2] === 90);
    const maxX = Math.max(...posts.map(item => Math.abs(item.position[0])));
    assert(accessories.every(item => item.accessoryThreadSize === 'M8' && item.position[1] === 0));
    if (expected === 'caster') assert(accessories.every(item => Math.abs(item.position[0]) === maxX));
    if (frame !== '2040_2020') assert(posts.every(item => item.position[1] - item.length! / 2 === (expected === 'caster' ? 62 : expected === 'foot' ? 25 : 0)));
    const completed = completeParametricFurnitureTemplate(payload);
    assert(completed.check.valid, completed.check.issues.join('; '));
    assert(completed.items.filter(item => item.kind === 'caster' || item.kind === 'foot').every(item => calculatePrice(item) > 0));
    assert.equal(buildProductionData(completed.items, 'cn').parts.filter(item => item.type === 'caster' || item.type === 'foot').length, accessories.length);
  }
}
console.log('Wardrobe base options, corner-only casters, all-post feet and production pricing passed.');

for (const frame of ['2040_2020', '2047_2020', '3030'] as const) {
  for (const edge of ['sealed', 'open'] as const) {
    for (const columns of [1, 3]) {
      const payload = buildWardrobeTemplate(1300, 600, 1200, 2, columns, frame, 'none', edge);
      const sealed = frame === '2047_2020' || edge === 'sealed';
      assert.equal(payload.summary.edgeOption, sealed ? 'sealed' : 'open');
      const faces = payload.items.filter(item => item.kind === 'profile' && Math.abs(item.position[2]) > 0);
      if (sealed) {
        for (const item of faces) {
          assert(['2047', '2040-N1-20', '2020-N1', '3030-N1'].includes(item.variantId!));
          const normal = new Vector3(0, 1, 0).applyEuler(new Euler(...item.rotation.map(value => value * Math.PI / 180) as [number, number, number]));
          assert(normal.z * Math.sign(item.position[2]) > 0.999, 'Every front/rear sealed face must point outward');
          assert(!item.holes?.some(hole => hole.type === 'through' && hole.fastenerLengthMm === 8));
        }
      }
      const completed = completeParametricFurnitureTemplate(payload);
      assert(completed.check.valid, `${frame}/${edge}/${columns}: ${completed.check.issues.join('; ')}`);
      if (frame !== '3030') {
        const setback = frame === '2047_2020' ? 27 : sealed ? 20 : 0;
        assert.equal(payload.summary.frontRailSetbackMm, setback);
        const middleBoards = completed.items.filter(item => item.kind === 'marine_board' && /^WARDROBE:SHELF:[1-9]/.test(item.attachmentKey || ''));
        assert.equal(middleBoards.length, columns * 2);
        for (const board of middleBoards) {
          assert.equal(board.position[2], -setback / 2);
          assert.equal(board.height, 600 - 42 - setback);
          const rails = completed.items.filter(item => item.kind === 'profile' && board.attachedProfileIds?.includes(item.id) && item.rotation[1] === 0);
          const front = rails.find(item => item.position[2] > 0)!;
          assert.equal(front.position[2], 290 - setback);
          assert.equal(rails.find(item => item.position[2] < 0)!.position[2], -290);
          assert.equal(completed.items.filter(item => item.kind === 'connector' && item.attachedProfileIds?.includes(front.id)).length, 2);
          const supports = completed.items.filter(item => item.kind === 'shelf_support' && item.attachedProfileIds?.includes(board.id));
          assert.equal(supports.length, 8);
          assert(supports.filter(item => item.attachedProfileIds?.includes(front.id)).every(item => item.position[2] === 289 - setback));
          if (setback) assert(300 - 20 >= front.position[2] + 10, '18mm inset door must not penetrate front shelf rail');
          assert.equal(board.position[2] - board.height! / 2, -279, 'Rear board edge must remain fixed');
        }
        const outerBoards = completed.items.filter(item => item.kind === 'marine_board' && !middleBoards.includes(item));
        assert(outerBoards.every(item => item.position[2] === 0 && item.height === 558), 'Top/bottom boards stay unchanged');
      }
      if (frame === '3030') {
        const fronts = completed.items.filter(item => item.kind === 'profile' && item.wardrobeFrontSetbackMm === 30);
        assert.equal(fronts.length, columns * 2);
        assert(fronts.every(item => item.position[2] === 600 / 2 - 15 - 30 && !item.tappingLeft && !item.tappingRight));
        for (const rail of fronts) {
          const joints = completed.items.filter(item => item.kind === 'hidden_connector' && item.attachedProfileIds?.includes(rail.id));
          assert.equal(joints.length, 2, 'Each recessed rail requires two No.5 brackets');
          assert(joints.every(item => item.lockedPosition && item.attachedProfileIds?.some(id => completed.items.some(p => p.id === id && p.kind === 'profile' && p.rotation[1] === 90 && p.rotation[2] === 0))));
        }
        const middleBoards = completed.items.filter(item => item.kind === 'marine_board' && item.position[2] === -15);
        assert.equal(middleBoards.length, columns * 2);
        assert(middleBoards.every(item => item.height === 508));
        assert.equal(600 / 2 - 20 - (fronts[0].position[2] + 15), 10, '18mm inset door must clear front rail by 10mm');
      }

      assert(completed.items.filter(item => item.kind === 'connector').every(item => item.lockedPosition), 'Sealed-frame brackets must stay seated');
      if (sealed) assert(completed.items.filter(item => item.kind === 'profile' && item.variantId?.includes('N1')).every(item => !item.holes?.some(hole => hole.side === 'A' || hole.side === 'C')), 'No generated holes through sealed A face');
      assert(buildProductionData(completed.items, 'cn').parts.some(item => item.model === (frame === '2047_2020' ? '2047' : sealed ? frame === '3030' ? '3030-N1' : '2040-N1-20' : frame === '3030' ? '3030' : '2040')));
    }
  }
}
console.log('Wardrobe sealed variants, outward faces, machining and connection checks passed.');
