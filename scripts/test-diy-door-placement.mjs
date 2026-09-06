import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Exercise the actual private geometry functions without mounting WebGL or
// adding test-only exports to the production designer module.
const root = fileURLToPath(new URL('../', import.meta.url));
const names = ['normalizeDesignItems', 'detectCabinetDoorOpenings', 'cabinetDoorBounds',
  'cabinetDoorLeafBounds', 'fitCabinetDoorToOpening', 'syncAttachedAccessories',
  'availableAccessoryPlacementCandidates', 'groupAccessoryPlacementOverlays', 'accessoryPlacementFaceLabel', 'createItem'];
const privateNames = names.filter(name => name !== 'normalizeDesignItems');
const result = await build({
  absWorkingDir: root,
  stdin: { contents: `export { ${names.join(', ')} } from './components/DIYDesigner.tsx';
    export { buildWardrobeTemplate } from './utils/parametricFurniture.ts';
    export { buildProductionXlsx } from './utils/productionXlsx.ts';
    export { unzipSync, strFromU8 } from 'fflate';`, resolveDir: root },
  bundle: true, platform: 'node', format: 'cjs', write: false,
  plugins: [{ name: 'expose-designer-geometry', setup(builder) {
    builder.onLoad({ filter: /components\/DIYDesigner\.tsx$/ }, async ({ path }) => ({
      contents: `${await readFile(path, 'utf8')}\nexport { ${privateNames.join(', ')} };`, loader: 'tsx',
      resolveDir: fileURLToPath(new URL('../components/', import.meta.url)),
    }));
  } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const api = module.exports;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.025, `${actual} != ${expected}`);
let doorCases = 0;
for (const columns of [1, 3]) {
  const profiles = api.normalizeDesignItems(api.buildWardrobeTemplate(1200, 600, 2200, 5, columns).items);
  const openings = api.detectCabinetDoorOpenings(profiles);
  assert.equal(openings.length, columns);
  for (const overlay of ['full', 'half', 'inset']) {
    const doors = openings.flatMap((opening, i) => ['left', 'right'].map((side, j) => {
      const door = api.fitCabinetDoorToOpening({ ...api.createItem('cabinet_door', i * 2 + j),
        doorOverlay: overlay, doorLeafMode: 'double', doorPairSide: side }, opening);
      assert.equal(door.openingSide, side);
      assert.equal(door.quantity, 1);
      assert.ok(door.attachmentKey.endsWith(`:DOUBLE:${side}`));
      return door;
    }));
    assert.equal(new Set(doors.map(d => d.id)).size, columns * 2);
    const restored = api.normalizeDesignItems(JSON.parse(JSON.stringify([...profiles, ...doors])));
    const synced = api.syncAttachedAccessories(restored).filter(d => d.kind === 'cabinet_door');
    for (const [i, opening] of openings.entries()) {
      const [left, right] = synced.slice(i * 2, i * 2 + 2);
      const bounds = api.cabinetDoorBounds(opening, overlay);
      for (const [leaf, side] of [[left, 'left'], [right, 'right']]) {
        const leafBounds = api.cabinetDoorLeafBounds(opening, overlay, 'double', side);
        assert.equal(leaf.width, Math.floor(leafBounds.right - leafBounds.left));
        assert.equal(leaf.height, Math.floor(leafBounds.top - leafBounds.bottom));
        assert.ok(leaf.position[0] - leaf.width / 2 >= bounds.left - 0.001);
        assert.ok(leaf.position[0] + leaf.width / 2 <= bounds.right + 0.001);
      }
      near(right.position[0] - right.width / 2 - left.position[0] - left.width / 2, 3);
      assert.equal(left.height, Math.floor(bounds.top - bounds.bottom));
      if (overlay === 'half') near(bounds.left, (opening.outer.left + opening.inner.left) / 2 + 3);
      if (overlay === 'inset') near(bounds.left, opening.inner.left + 3);
      if (overlay === 'half') {
        const full = api.cabinetDoorBounds(opening, 'full');
        near(bounds.top, full.top);
        near(bounds.bottom, full.bottom);
      }
      doorCases++;
    }
    // Old JSON without new metadata still recovers pair sides from attachment keys.
    const legacy = doors.map(({ doorLeafMode, doorPairSide, ...door }) => door);
    const normalizedLegacy = api.normalizeDesignItems(legacy);
    assert.ok(normalizedLegacy.every(d => d.doorLeafMode === 'double' && d.doorPairSide === d.openingSide));
    const workbook = api.buildProductionXlsx({ parts: doors.map((d, i) => ({
      line: i + 1, id: d.id, type: 'cabinet_door', model: '柜门', color: '银白', quantity: 1,
      positionMm: d.position, rotationDeg: d.rotation, widthMm: d.width, heightMm: d.height,
      leftTappingPorts: 0, rightTappingPorts: 0, remark: '', doorLeafMode: d.doorLeafMode,
      doorPairSide: d.doorPairSide, doorOverlay: d.doorOverlay, openingSide: d.openingSide,
    })), holes: [] });
    const bytes = workbook instanceof Blob ? new Uint8Array(await workbook.arrayBuffer()) : workbook;
    const xml = Object.values(api.unzipSync(bytes)).map(bytes => api.strFromU8(bytes)).join('\n');
    for (const text of ['柜门形式', '对开门', '左扇', '右扇']) assert.ok(xml.includes(text), text);
  }
  for (const opening of openings) {
    for (const leftOverlay of ['full', 'half', 'inset']) for (const rightOverlay of ['full', 'half', 'inset']) {
      const pair = ['left', 'right'].map((side, i) => api.fitCabinetDoorToOpening({
        ...api.createItem('cabinet_door', i), doorLeafMode: 'double', doorPairSide: side,
        doorOverlay: i === 0 ? leftOverlay : rightOverlay,
      }, opening));
      const [left, right] = api.syncAttachedAccessories(api.normalizeDesignItems([...profiles, ...pair])).filter(d => d.kind === 'cabinet_door');
      assert.equal(left.doorOverlay, leftOverlay);
      assert.equal(right.doorOverlay, rightOverlay);
      near(right.position[0] - right.width / 2 - left.position[0] - left.width / 2, 3);
      if (leftOverlay !== 'inset' && rightOverlay !== 'inset') assert.equal(left.height, right.height);
      assert.ok([left.width, right.width, left.height, right.height].every(Number.isInteger));
    }
  }
  for (const kind of ['connector', 'extruded_connector']) {
    const accessory = { ...api.createItem(kind, 0), accessoryProfileSize: '2020' };
    const candidates = api.availableAccessoryPlacementCandidates(accessory, profiles);
    assert.ok(candidates.length, `${kind} must have installable joints`);
    const candidate = candidates[0];
    const installed = { ...accessory, attachmentKey: candidate.key, attachedProfileIds: candidate.targetProfileIds };
    const after = api.availableAccessoryPlacementCandidates(accessory, [...profiles, installed]);
    assert.equal(after.length, candidates.length - 1);
    assert.ok(!after.some(c => c.key === candidate.key));
    assert.equal(api.availableAccessoryPlacementCandidates(accessory, profiles).length, candidates.length);
  }
}
const corner = [
  { position: [110, 190, 0], rotation: [0, 0, 0] },
  { position: [0, 100, 0], rotation: [0, 0, 90] },
  { position: [0, 190, 110], rotation: [0, 90, 0] },
].map((transform, i) => ({ ...api.createItem('profile', i, '2020'), id: `corner-${i}`, length: 200, ...transform }));
for (const kind of ['connector', 'extruded_connector']) {
  const accessory = { ...api.createItem(kind, 0), accessoryProfileSize: '2020' };
  const candidates = api.availableAccessoryPlacementCandidates(accessory, corner);
  const planes = new Set(candidates.map(c => api.accessoryPlacementFaceLabel(c).split(' · ')[0]));
  assert.deepEqual([...planes].sort(), ['XY', 'XZ', 'YZ'], `${kind}: keep all three physical corner planes`);
  const overlays = candidates.map((placement, i) => ({ key: placement.key, placement, point: { x: 120 + i * 5, y: 100 } }));
  const groups = api.groupAccessoryPlacementOverlays(overlays);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].candidates.length, candidates.length);
  assert.equal(api.groupAccessoryPlacementOverlays([...overlays].reverse())[0].key, groups[0].key);
  const remaining = overlays.filter(o => o.key !== candidates[0].key);
  assert.equal(api.groupAccessoryPlacementOverlays(remaining)[0].candidates.length, candidates.length - 1);
  assert.equal(api.groupAccessoryPlacementOverlays(overlays.map((o, i) => ({ ...o, point: { x: i * 100, y: 100 } }))).length, candidates.length);
}
const [decimalDoor] = api.normalizeDesignItems([{ ...api.createItem('cabinet_door'), width: 296.99, height: 2194.5 }]);
assert.equal(decimalDoor.width, 296);
assert.equal(decimalDoor.height, 2194);
console.log(`PASS: ${doorCases} paired-door geometry cases, all mixed overlays, integer dimensions, JSON/XLSX metadata, No.1/No.2 marker removal and three-plane clusters.`);
