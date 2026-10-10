import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { calculatePrice } from '../components/DIYDesigner';
import { materializeStoolSupportFasteners } from '../utils/stoolAssemblyReview';
import {
  DESIGNER_OVERLENGTH_FEE,
  DESIGNER_SHIPPING_PROVINCES,
  estimateDesignerShipping,
} from '../utils/designerLandedEstimate';
import { SHIPPING_RATES, SHIPPING_RATES_AN, SHIPPING_RATES_SF } from '../constants';
import {
  classifyImportedComponent,
} from '../utils/designerComponentPricing';

/**
 * The designer's freight preview must quote what the cart charges.
 *
 * The customer picks a province in the right-hand panel and sees a landed
 * total; the cart only has that number once a real address exists. This check
 * ties the two together: the preview runs on the *cart's* weight tables,
 * per-province tiers, overlength rule and cheapest-courier choice, so the
 * 凳子 reference design — whose ¥952 landed total to 浙江 is already frozen by
 * `npm run test:stool-landed-total` — must land on the same figure here.
 */

// `assert` is imported directly (never aliased): TypeScript only treats these
// as assertion calls when the call target carries an explicit type annotation.

// 1. The province list is the shipping table itself, never a hand-written copy.
assert.ok(DESIGNER_SHIPPING_PROVINCES.length > 20, 'province list must come from the shipping table');
assert.deepEqual(
  DESIGNER_SHIPPING_PROVINCES,
  [...DESIGNER_SHIPPING_PROVINCES].sort(),
  'provinces must be offered in a stable order',
);
assert.ok(DESIGNER_SHIPPING_PROVINCES.includes('广东'), '广东 must be selectable');
assert.ok(
  DESIGNER_SHIPPING_PROVINCES.every((province) => Boolean(SHIPPING_RATES[province])),
  'every offered province must have a rate row',
);

// 2. No province (and an unknown one) means no preview at all — the panel then
// shows the parts subtotal alone, exactly like a cart without an address.
const tinyDesign = [
  { kind: 'profile' as const, variantId: '2020', length: 1000, quantity: 2 },
];
assert.equal(estimateDesignerShipping(tinyDesign, 100, ''), null, 'no province ⇒ no preview');
assert.equal(estimateDesignerShipping(tinyDesign, 100, '火星'), null, 'unknown province ⇒ no preview');

// 3. Mirrors the cart tier-for-tier: 2020 profile, 2 × 1m ≈ 1.2kg ⇒ billed 2kg.
const shanghai = estimateDesignerShipping(tinyDesign, 100, '上海')!;
assert.ok(shanghai, '上海 must produce a preview');
assert.equal(shanghai.billedWeightKg, 2, '1.2kg of profile bills as 2kg');
assert.equal(
  shanghai.fees.standard,
  SHIPPING_RATES['上海'].first + (2 - 1) * SHIPPING_RATES['上海'].next,
  'standard tier must match the cart rate table',
);
assert.equal(
  shanghai.fees.sf,
  SHIPPING_RATES_SF['上海'].first + (2 - 1) * SHIPPING_RATES_SF['上海'].next,
  'SF tier must match the cart rate table',
);
assert.equal(shanghai.fees.anneng, SHIPPING_RATES_AN['上海'].first, 'under 15kg 安能 is its first-weight price');
assert.equal(
  shanghai.fee,
  Math.min(shanghai.fees.standard, shanghai.fees.sf, shanghai.fees.anneng),
  'the preview must quote the cheapest courier, like the cart default',
);
assert.equal(shanghai.landed, Number((100 + shanghai.fee).toFixed(1)), 'landed = subtotal + cheapest freight');

// 4. Overlength: a profile past 1.5m adds the cart's ¥20 to 普通/顺丰, not 安能.
const longDesign = [
  { kind: 'profile' as const, variantId: '3030', length: 2000, quantity: 1 },
];
const longToGuangdong = estimateDesignerShipping(longDesign, 500, '广东')!;
assert.ok(longToGuangdong.hasOverlength, 'a 2m profile is overlength');
assert.equal(
  longToGuangdong.fees.standard,
  SHIPPING_RATES['广东'].first + (longToGuangdong.billedWeightKg - 1) * SHIPPING_RATES['广东'].next
    + DESIGNER_OVERLENGTH_FEE,
  'overlength fee must land on the standard tier',
);
assert.equal(
  longToGuangdong.fees.anneng,
  SHIPPING_RATES_AN['广东'].first,
  '安能 never carries the overlength surcharge',
);
const shortToGuangdong = estimateDesignerShipping(
  [{ kind: 'profile' as const, variantId: '3030', length: 1200, quantity: 1 }],
  500,
  '广东',
)!;
assert.ok(
  longToGuangdong.fees.standard > shortToGuangdong.fees.standard,
  'the same design must cost more to ship when a profile is overlength',
);

// 5. A design with nothing shippable (accessories only, above the ¥30
// allowance) must preview ¥0 freight rather than inventing a weight.
const accessoryOnly = [
  { kind: 'connector' as const, quantity: 4 },
  { kind: 'end_cap' as const, quantity: 8 },
];
const accessoryEstimate = estimateDesignerShipping(accessoryOnly, 120, '四川')!;
assert.equal(accessoryEstimate.totalWeightKg, 0, 'accessories above ¥30 add no weight');
assert.equal(accessoryEstimate.fee, 0, 'nothing to ship ⇒ no freight');
assert.equal(accessoryEstimate.landed, 120, 'landed falls back to the parts subtotal');

// 6. Accessories below ¥30 carry the cart's 1kg allowance.
const smallAccessory = estimateDesignerShipping([{ kind: 'connector' as const, quantity: 1 }], 10, '四川')!;
assert.equal(smallAccessory.accessoryWeightKg, 1, 'a small accessory order bills 1kg');
assert.equal(smallAccessory.billedWeightKg, 1, 'the 1kg allowance is what gets billed');

// 7. The frozen 凳子 reference: the preview must land on the cart's ¥952.
const fixturePath = path.resolve('scripts/fixtures/stool-import-20260930.json.gz');
const source = JSON.parse(gunzipSync(readFileSync(fixturePath)).toString('utf8')) as unknown as {
  items: Array<Record<string, unknown>>;
};
const items = source.items as unknown as Parameters<typeof calculatePrice>[0][];
const ordered = items.map((item) => (
  item.kind === 'imported_component' && classifyImportedComponent({
    semanticType: item.sourceMesh?.source.semanticType,
    componentName: item.sourceMesh?.source.componentName || item.name,
    catalogItemId: item.partCatalogRef?.catalogItemId,
    sourceRecordId: item.partCatalogRef?.sourceRecordId,
  }) === 'caster'
    ? { ...item, wheelGrade: 'upgraded' as const }
    : item
));
const fasteners = materializeStoolSupportFasteners(ordered);
const subtotal = Number(
  (ordered.reduce((sum, item) => sum + calculatePrice(item), 0) + fasteners.total).toFixed(1),
);
const stoolToZhejiang = estimateDesignerShipping(ordered, subtotal, '浙江')!;
assert.equal(stoolToZhejiang.billedWeightKg, 11, '凳子 reference bills 11kg');
assert.equal(stoolToZhejiang.fee, 33, '凳子 reference to 浙江 ships 安能 ¥33');
assert.equal(
  stoolToZhejiang.landed,
  952,
  `凳子 preview to 浙江 must land on the frozen ¥952, got ¥${stoolToZhejiang.landed}`,
);

// 8. The same design costs more the further it travels — the whole point of
// letting a customer peek before checkout.
const stoolToXinjiang = estimateDesignerShipping(ordered, subtotal, '新疆')!;
assert.ok(
  stoolToXinjiang.landed > stoolToZhejiang.landed,
  'shipping to 新疆 must cost more than to 浙江',
);

console.log(`省份列表 ${DESIGNER_SHIPPING_PROVINCES.length} 个（源自运费表，非手写）`);
console.log(`  凳子参考 发浙江: 计费 ${stoolToZhejiang.billedWeightKg}kg · `
  + `普通 ¥${stoolToZhejiang.fees.standard} / 顺丰 ¥${stoolToZhejiang.fees.sf} / 安能 ¥${stoolToZhejiang.fees.anneng}`
  + ` → ${stoolToZhejiang.cheapest} ¥${stoolToZhejiang.fee} · 到手 ¥${stoolToZhejiang.landed}`);
console.log(`  凳子参考 发新疆: 到手 ¥${stoolToXinjiang.landed}（${stoolToXinjiang.cheapest} ¥${stoolToXinjiang.fee}）`);
console.log('Designer freight preview checks passed.');
