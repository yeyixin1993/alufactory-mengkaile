import assert from 'node:assert/strict';
import { PROFILE_COLORS, PROFILE_VARIANTS, COLOR_ONLY_COLORED_SECTION_IDS } from '../constants';
import {
  A_PILLAR_MILLING_SPECS,
  getAPillarMillingSpecs,
  normalizeAPillarMilling,
  type APillarMillingId,
} from '../data/aPillarMilling';
import {
  calculateQuickProfileRow,
  normalizeQuickProfileRow,
  type QuickProfileRow,
} from '../utils/quickQuoteProfile';

const row = (patch: Partial<QuickProfileRow> = {}): QuickProfileRow => ({
  id: 'a-pillar-regression', model: '2040', colorId: 'natural', section: 'natural',
  length: 1000, quantity: 1, tappingCount: 0, throughHoleCount: 0,
  countersunkHoleCount: 0, threadedHoleCount: 0, miter45CutCount: 0, ...patch,
});

// Availability is deliberately an exact model list, not a 20/30-series prefix rule.
const expectedSupport: Record<string, APillarMillingId[]> = {
  '2040': ['narrow_single', 'wide_single'],
  '2040-N1-20': ['narrow_single', 'wide_single'],
  '2040-N1-40': ['narrow_single', 'wide_single'],
  '2047': ['narrow_single', 'narrow_double'],
  '3030-N1': ['narrow_single', 'narrow_double', 'wide_single'],
  '3030-N2': ['narrow_single', 'narrow_double', 'wide_single'],
};
for (const model of [...PROFILE_VARIANTS.map(variant => variant.id), 'unknown', 'constructor', 'toString', '__proto__']) {
  const expected = Object.hasOwn(expectedSupport, model) ? expectedSupport[model] : [];
  assert.deepEqual(getAPillarMillingSpecs(model).map(spec => spec.id), expected, model);
  for (const selection of ['narrow_single', 'narrow_double', 'wide_single'] as const) {
    assert.equal(normalizeAPillarMilling(model, selection),
      expected.includes(selection) ? selection : 'none', `${model} / ${selection}`);
  }
  assert.equal(normalizeAPillarMilling(model, 'unknown'), 'none');
  assert.equal(normalizeAPillarMilling(model), 'none');
}
assert.deepEqual(A_PILLAR_MILLING_SPECS.map(spec => [spec.id, spec.feePerMeter]), [
  ['narrow_single', 13], ['narrow_double', 16], ['wide_single', 23],
]);

// Owner-confirmed 2040 examples, independent of the catalog pricing implementation.
for (const [selection, colorId, expected] of [
  ['narrow_single', 'natural', 40], ['narrow_single', 'black', 51],
  ['wide_single', 'natural', 50], ['wide_single', 'black', 61],
] as const) {
  const result = calculateQuickProfileRow(row({ aPillarMilling: selection, colorId }), 0);
  assert.equal(result.unitPrice, expected);
  assert.equal(result.subtotal, expected);
  assert.equal(result.row.section, colorId === 'natural' ? 'natural' : 'colored');
}
for (const [model, selection, expected] of [
  ['2040-N1-20', 'narrow_single', 41], ['2040-N1-40', 'wide_single', 52],
  ['2047', 'narrow_single', 54], ['3030-N1', 'narrow_double', 47],
  ['3030-N2', 'narrow_double', 48],
] as const) {
  assert.equal(calculateQuickProfileRow(row({ model, aPillarMilling: selection }), 0).unitPrice, expected);
}

// Fees follow actual metres and quantity, and do not receive a second membership discount.
const metreAndQuantity = calculateQuickProfileRow(row({ aPillarMilling: 'narrow_single', length: 1500, quantity: 3 }), 0);
assert.equal(metreAndQuantity.unitPrice, 60);
assert.equal(metreAndQuantity.subtotal, 180);
assert.equal(metreAndQuantity.aPillarMillingFee, 58.5);
for (const [discount, membership, expected] of [[0, 'standard', 180], [2, 'vip', 171], [4, 'vip_plus', 162]] as const) {
  const result = calculateQuickProfileRow(row({ aPillarMilling: 'narrow_single', length: 1500, quantity: 3 }), discount, membership);
  assert.equal(result.subtotal, expected);
  assert.equal(result.aPillarMillingFee, 58.5);
  assert.equal(result.totalWeightKg, metreAndQuantity.totalWeightKg, 'machining does not invent shipping weight');
}
const withOtherMachining = calculateQuickProfileRow(row({ aPillarMilling: 'narrow_single', quantity: 4,
  tappingCount: 2, throughHoleCount: 2, countersunkHoleCount: 1, threadedHoleCount: 1, miter45CutCount: 2 }), 0);
assert.equal(withOtherMachining.unitPrice, 50.6);
assert.equal(withOtherMachining.subtotal, 202.4);
assert.equal(withOtherMachining.aPillarMillingFee, 52);
assert.equal(calculateQuickProfileRow(row({ aPillarMilling: 'narrow_single', length: 333, quantity: 3 }), 0).subtotal, 39.9,
  'existing per-piece rounding remains in force');
assert.equal(calculateQuickProfileRow(row({ aPillarMilling: 'narrow_single', length: 100 }), 0).unitPrice, 9);
assert.equal(calculateQuickProfileRow(row({ aPillarMilling: 'narrow_single', length: 100 }), 4, 'vip_plus').unitPrice, 3.6,
  'VIP+ still waives the short-piece danger fee');
for (const patch of [{ quantity: 0 }, { length: 0 }]) {
  const result = calculateQuickProfileRow(row({ aPillarMilling: 'wide_single', ...patch }), 0);
  assert.equal(result.subtotal, 0);
  assert.equal(result.aPillarMillingFee, 0);
  assert.equal(result.totalWeightKg, 0);
}

// Simulate the same merged-row updates used by QuickQuote controls.
let editing = normalizeQuickProfileRow(row({ model: '3030-N1', aPillarMilling: 'narrow_double', colorId: 'black' }));
assert.equal(editing.section, 'colored');
editing = normalizeQuickProfileRow({ ...editing, model: '3030-N2' });
assert.equal(editing.aPillarMilling, 'narrow_double', 'compatible model changes preserve machining');
editing = normalizeQuickProfileRow({ ...editing, model: '2040' });
assert.equal(editing.aPillarMilling, 'none', '2040 cannot retain 3030 double-row milling');
editing = normalizeQuickProfileRow({ ...editing, aPillarMilling: 'wide_single', section: 'natural' });
assert.equal(editing.section, 'colored', 'colored milled profiles cannot use natural cut ends');
editing = normalizeQuickProfileRow({ ...editing, model: '2047' });
assert.equal(editing.aPillarMilling, 'none', '2047 cannot retain wide-row milling');
editing = normalizeQuickProfileRow({ ...editing, aPillarMilling: 'narrow_single', colorId: 'natural' });
assert.equal(editing.section, 'natural', 'natural aluminum remains available');
editing = normalizeQuickProfileRow({ ...editing, colorId: 'black' });
assert.equal(editing.section, 'colored');
editing = normalizeQuickProfileRow({ ...editing, aPillarMilling: 'none', section: 'natural' });
assert.equal(editing.section, 'natural', 'turning milling off restores ordinary cut-end choices');
assert.equal(normalizeQuickProfileRow({ ...editing, aPillarMilling: 'narrow_single', model: '3030' }).aPillarMilling, 'none');

// Every decorative color, including Bright Silver, follows the colored material tier.
for (const color of PROFILE_COLORS) {
  const result = calculateQuickProfileRow(row({ colorId: color.id, aPillarMilling: 'narrow_single' }), 0);
  assert.equal(result.unitPrice, color.id === 'natural' ? 40 : 51, color.id);
}
for (const colorId of COLOR_ONLY_COLORED_SECTION_IDS) {
  assert.equal(normalizeQuickProfileRow(row({ colorId })).section, 'colored', 'catalog color restrictions still apply without milling');
}

// Existing rows omit this new optional field. Their ordinary pricing and source objects survive.
for (const [colorId, section, expected] of [['natural', 'natural', 27], ['black', 'natural', 32], ['black', 'colored', 38]] as const) {
  const source = row({ colorId, section });
  const snapshot = JSON.stringify(source);
  const result = calculateQuickProfileRow(source, 0);
  assert.equal(result.unitPrice, expected);
  assert.equal(result.aPillarMillingFee, 0);
  assert.equal(JSON.stringify(source), snapshot, 'normalization must not mutate customer input');
}
assert.equal(calculateQuickProfileRow(row({ model: '3030', aPillarMilling: 'narrow_double' }), 0).unitPrice, 29,
  'unsupported machining never silently incurs a fee');

console.log(`PASS: A-pillar compatibility across ${PROFILE_VARIANTS.length} models; owner prices, metre/quantity fees, membership, colors, editing transitions and legacy rows.`);
