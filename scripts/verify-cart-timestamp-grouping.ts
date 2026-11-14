import assert from 'node:assert/strict';
import { groupFactoryDisplayCartItems } from '../utils/cartAccessories';
import { CartItem, Product, ProductType } from '../types';

// Cart entry IDs and addition times explain separate customer actions. Neither
// is a physical manufacturing difference in the derived production/PDF list.
const early = '2026-11-14T01:00:00.000Z';
const late = '2026-11-14T02:30:00.000Z';
const product = (type: ProductType): Product => ({
  id: `timestamp-test-${type}`,
  type,
  name: { cn: type, en: type, jp: type },
  description: { cn: '', en: '', jp: '' },
  basePrice: 0,
  imageUrl: '',
});
const item = (type: ProductType, id: string, quantity: number, config: Record<string, unknown>): CartItem => ({
  id,
  product: product(type),
  quantity,
  config,
  totalPrice: quantity * Number(config.unitPrice || 0),
});
const addition = (row: CartItem, suffix: string, timestamp: string): CartItem => ({
  ...structuredClone(row),
  id: `${row.id}-${suffix}`,
  config: { ...structuredClone(row.config), cartEntryId: `entry-${suffix}`, cartAddedAt: timestamp },
});
const assertStableProjection = (rows: CartItem[]) => {
  const before = structuredClone(rows);
  const grouped = groupFactoryDisplayCartItems(rows);
  assert.deepEqual(rows, before, 'PDF projection must not merge or rewrite editable cart entries');
  assert.equal(
    grouped.reduce((sum, row) => sum + row.totalPrice, 0),
    rows.reduce((sum, row) => sum + row.totalPrice, 0),
    'PDF grouping must preserve the total price',
  );
  return grouped;
};
const assertPhysicalRowsMerge = (template: CartItem, description: string) => {
  const first = addition(template, `${description}-first`, early);
  const second = addition({ ...template, quantity: 3, totalPrice: template.totalPrice * 3 / template.quantity }, `${description}-second`, late);
  const rows = [first, second];
  const grouped = assertStableProjection(rows);
  assert.equal(grouped.length, 1, `${description}: different addition times and entry IDs must not split the PDF`);
  assert.equal(grouped[0].quantity, template.quantity + 3, `${description}: quantities must add exactly once`);
  const regrouped = groupFactoryDisplayCartItems(grouped);
  assert.equal(regrouped.length, 1);
  assert.equal(regrouped[0].quantity, grouped[0].quantity, `${description}: repeated PDF projection must not inflate quantity`);
  assert.equal(regrouped[0].totalPrice, grouped[0].totalPrice);

  const legacy = structuredClone(first);
  delete legacy.config.cartAddedAt;
  delete legacy.config.cartEntryId;
  assert.equal(assertStableProjection([legacy, second]).length, 1, `${description}: undated historical entries must still merge`);
  return first;
};
const assertPhysicalDifferenceStaysSeparate = (base: CartItem, configPatch: Record<string, unknown>, reason: string) => {
  const changed = addition({ ...base, config: { ...base.config, ...configPatch } }, `different-${reason}`, late);
  assert.equal(assertStableProjection([base, changed]).length, 2, `${reason}: timestamp support must not erase a physical difference`);
};

const profile = assertPhysicalRowsMerge(item(ProductType.PROFILE, 'profile', 2, {
  variantId: '2020', length: 500, finish: 'oxidized', colorId: 'natural', unitPrice: 12,
  holes: [{ id: 'hole-one', type: 'through', side: 'A', positionMm: 30, physicalGrooveIndex: 0 }],
  tapping: { left: [true], right: [false] },
}), 'profile');
assertPhysicalDifferenceStaysSeparate(profile, { length: 501 }, 'profile-cut-length');
assertPhysicalDifferenceStaysSeparate(profile, { colorId: 'purple' }, 'profile-color');
assertPhysicalDifferenceStaysSeparate(profile, {
  holes: [{ id: 'hole-two', type: 'through', side: 'A', positionMm: 31, physicalGrooveIndex: 0 }],
}, 'profile-hole-station');
assertPhysicalDifferenceStaysSeparate(profile, { tapping: { left: [false], right: [false] } }, 'profile-tapping');
assertPhysicalDifferenceStaysSeparate(profile, {
  miterCut: { left: { enabled: true, direction: 'up', side: 'AC' }, right: { enabled: false, direction: 'up', side: 'AC' } },
}, 'profile-miter');

for (const type of [ProductType.ALUMINUM_PLATE, ProductType.PEGBOARD, ProductType.MARINE_BOARD]) {
  const panel = assertPhysicalRowsMerge(item(type, `panel-${type}`, 2, {
    width: 600, height: 400, thickness: type === ProductType.MARINE_BOARD ? 18 : 2,
    colorId: type === ProductType.MARINE_BOARD ? 'wood_natural' : 'natural', unitPrice: 40,
    ...(type === ProductType.PEGBOARD ? { pegHolePattern: 'round' } : {}),
    ...(type === ProductType.MARINE_BOARD ? { marineSpecId: 'marine_bbb_uv_film' } : {}),
  }), type);
  assertPhysicalDifferenceStaysSeparate(panel, { width: 601 }, `${type}-cut-width`);
  assertPhysicalDifferenceStaysSeparate(panel, { thickness: 3 }, `${type}-thickness`);
  assertPhysicalDifferenceStaysSeparate(panel, { colorId: 'black' }, `${type}-color`);
  if (type === ProductType.PEGBOARD) assertPhysicalDifferenceStaysSeparate(panel, { pegHolePattern: 'square' }, 'pegboard-hole-pattern');
  if (type === ProductType.MARINE_BOARD) assertPhysicalDifferenceStaysSeparate(panel, { marineSpecId: 'marine_bbb_plain' }, 'marine-board-surface');
}

// Designer accessories count physical pieces in config.lines, not the outer
// cart row's quantity. Include a screw as well as ordinary numbered hardware.
for (const screw of [false, true]) {
  const lineId = screw ? '10_2020_m6x30_cap::2020' : '1::2020';
  const accessory = (id: string, quantity: number, at: string): CartItem => ({
    id,
    product: product(ProductType.ACCESSORY),
    quantity: 1,
    totalPrice: quantity * 2,
    config: {
      type: 'profile_accessory', profileSize: '2020', colorMode: 'natural', colorId: 'natural',
      cartAddedAt: at, cartEntryId: `entry-${id}`,
      diyPosition: [0, 0, 0], totalQuantity: quantity, unitTotal: quantity * 2,
      quantities: { [lineId]: quantity },
      lines: [{ id: lineId, code: screw ? '10' : '1', name: screw ? 'M6×30 screw' : '2020 corner bracket', quantity, unitPrice: 2, subtotal: quantity * 2 }],
      ...(screw ? { screwHead: 'socket_cylinder', screwLengthMm: 30, screwThreadSize: 'M6' } : {}),
    },
  });
  const grouped = assertStableProjection([accessory('first', 2, early), accessory('second', 3, late)]);
  assert.equal(grouped.length, 1, `${screw ? 'Screw' : 'Accessory'} timestamps must not split identical PDF rows`);
  assert.equal(grouped[0].config.lines[0].quantity, 5);
  assert.equal(grouped[0].config.totalQuantity, 5);
  assert.equal(grouped[0].config.lines[0].subtotal, 10);
  assert.equal(groupFactoryDisplayCartItems(grouped)[0].config.lines[0].quantity, 5);
  const changed = accessory('different-color', 1, late);
  changed.config.colorId = 'black';
  assert.equal(assertStableProjection([accessory('first', 2, early), changed]).length, 2, 'Different accessory colors must remain separate');
}

console.log('Cart timestamp/PDF grouping passed: profiles, aluminum panels, pegboards, marine boards, designer accessories and screws; quantities/prices preserved, legacy entries merge, manufacturing differences remain separate.');
