import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { calculatePrice } from '../components/DIYDesigner';
import { SHIPPING_RATES, SHIPPING_RATES_AN, SHIPPING_RATES_SF, PROFILE_WEIGHTS } from '../constants';
import {
  DECORATIVE_PROFILE_UNIT_PRICE,
  HANDLE_UNIT_PRICE,
  classifyImportedComponent,
} from '../utils/designerComponentPricing';

/**
 * Freezes the *landed* price of the 凳子 reference design shipped to 浙江.
 *
 * The owner calibrates the two imported parts that had no price (拉手 and
 * 8080 装饰料) against the real landed total, so this regression ties the
 * designer's subtotal to that number through the same weight and shipping
 * rules the cart uses. If a price, a weight table or a shipping tier moves,
 * this fails instead of quietly changing what a customer is quoted.
 */

/** Mirrors `MARINE_BOARD_WEIGHT_PER_SQM` in `App.tsx` / `QuickQuote.tsx`. */
const MARINE_BOARD_WEIGHT_PER_SQM: Record<number, number> = { 12: 8, 18: 12 };
/** Mirrors the cart's accessory-freight allowance (`utils/membership.ts`). */
const ACCESSORY_FREE_SHIPPING_ORDER_AMOUNT = 30;
const ACCESSORY_SHIPPING_WEIGHT_KG = 1;
/** Mirrors `CALCULATE` overlength rule in `App.tsx` (profiles longer than 1.5 m). */
const OVERLENGTH_THRESHOLD_MM = 1500;
const OVERLENGTH_FEE = 20;

const TARGET_LANDED_TOTAL = 880;
const DESTINATION_PROVINCE = '浙江';

const fixturePath = path.resolve('scripts/fixtures/stool-import-20260930.json.gz');
const source = JSON.parse(gunzipSync(readFileSync(fixturePath)).toString('utf8')) as unknown as {
  items: Array<Record<string, unknown>>;
};
const items = source.items as unknown as Parameters<typeof calculatePrice>[0][];

// The owner's reference design ships with the 诺贝 wheel upgrade.
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

const categoryOf = (item: Parameters<typeof calculatePrice>[0]) => (
  item.kind === 'imported_component'
    ? classifyImportedComponent({
      semanticType: item.sourceMesh?.source.semanticType,
      componentName: item.sourceMesh?.source.componentName || item.name,
      catalogItemId: item.partCatalogRef?.catalogItemId,
      sourceRecordId: item.partCatalogRef?.sourceRecordId,
    })
    : null
);

/**
 * The two parts the owner calibrates against the landed total. Everything else
 * is priced by its own rule, so the design subtotal is built as
 * "everything else" + "the calibrated parts", which makes the tweak visible.
 */
const calibratedCount = (category: string) => ordered.filter((item) => categoryOf(item) === category).length;
const handleCount = calibratedCount('handle');
const decorativeCount = calibratedCount('decorative_profile');
assert.equal(handleCount, 1, '凳子夹具的拉手数量已变化，请重新校准落地价');
assert.equal(decorativeCount, 8, '凳子夹具的 8080 装饰短料数量已变化，请重新校准落地价');

const baseOutsideCalibration = ordered.reduce((sum, item) => {
  const category = categoryOf(item);
  if (category === 'handle' || category === 'decorative_profile') return sum;
  return sum + calculatePrice(item);
}, 0);
const calibratedPartsTotal = handleCount * HANDLE_UNIT_PRICE + decorativeCount * DECORATIVE_PROFILE_UNIT_PRICE;

// The owner fixed the split, not just the sum: 8080 装饰料 is a round ¥8/件 and
// the remainder of the ¥87.12 calibrated pair lands on the 拉手.
assert.equal(DECORATIVE_PROFILE_UNIT_PRICE, 8, '8080 装饰料应为整 ¥8/件');
assert.equal(HANDLE_UNIT_PRICE, 23.12, '拉手应承担余数 = ¥23.12/件');
assert.equal(Number(calibratedPartsTotal.toFixed(2)), 87.12,
  '拉手 + 8080 装饰料合计必须为 ¥87.12，否则落地价不再是 ¥880');
const rawSubtotal = baseOutsideCalibration + calibratedPartsTotal;
const designSubtotal = Number(rawSubtotal.toFixed(1));

// --- Shipping, using the cart's own weight and rate logic. ---
const profileWeightKg = ordered.reduce((sum, item) => {
  if (item.kind !== 'profile') return sum;
  const weightPerM = PROFILE_WEIGHTS[item.variantId || ''] || 0.6;
  return sum + weightPerM * ((item.length || 0) / 1000) * Math.max(1, item.quantity || 1);
}, 0);

const marineBoardWeightKg = ordered.reduce((sum, item) => {
  if (item.kind !== 'marine_board') return sum;
  const weightPerSqm = MARINE_BOARD_WEIGHT_PER_SQM[item.thickness || 18] || 0;
  const areaSqm = ((item.width || 0) * (item.height || 0)) / 1_000_000;
  return sum + weightPerSqm * areaSqm * Math.max(1, item.quantity || 1);
}, 0);

const accessoryWeightKg = designSubtotal < ACCESSORY_FREE_SHIPPING_ORDER_AMOUNT
  ? ACCESSORY_SHIPPING_WEIGHT_KG
  : 0;
const totalWeightKg = profileWeightKg + marineBoardWeightKg + accessoryWeightKg;
const hasOverlength = ordered.some((item) => item.kind === 'profile' && (item.length || 0) > OVERLENGTH_THRESHOLD_MM);

const roundedWeight = Math.max(1, Math.ceil(totalWeightKg));
const standardRate = SHIPPING_RATES[DESTINATION_PROVINCE];
const sfRate = SHIPPING_RATES_SF[DESTINATION_PROVINCE];
const anRate = SHIPPING_RATES_AN[DESTINATION_PROVINCE];
const overlengthFee = hasOverlength ? OVERLENGTH_FEE : 0;

const shipping = {
  standard: standardRate.first + (roundedWeight - 1) * standardRate.next + overlengthFee,
  sf: sfRate.first + (roundedWeight - 1) * sfRate.next + overlengthFee,
  anneng: totalWeightKg <= 15
    ? anRate.first
    : anRate.first + Math.ceil(totalWeightKg - 15) * anRate.next,
};
const cheapest = (['standard', 'sf', 'anneng'] as const).reduce(
  (best, method) => (shipping[method] < shipping[best] ? method : best),
  'standard' as 'standard' | 'sf' | 'anneng',
);

const landed = Number((designSubtotal + shipping[cheapest]).toFixed(1));

console.log('凳子参考设计（升级诺贝轮子）发浙江');
console.log(`  其他零件小计: ¥${baseOutsideCalibration.toFixed(4)}`);
console.log(`  校准件小计: ¥${calibratedPartsTotal.toFixed(4)}`);
console.log(`  设计估价小计: ¥${rawSubtotal.toFixed(4)}（界面显示 ¥${designSubtotal}）`);
console.log(`  重量: 型材 ${profileWeightKg.toFixed(2)}kg + 海洋板 ${marineBoardWeightKg.toFixed(2)}kg`
  + ` + 配件 ${accessoryWeightKg}kg = ${totalWeightKg.toFixed(2)}kg（计费 ${roundedWeight}kg）`);
console.log(`  运费: 普通 ¥${shipping.standard} / 顺丰 ¥${shipping.sf} / 安能 ¥${shipping.anneng} → 选用 ${cheapest} ¥${shipping[cheapest]}`);
console.log(`  落地总价: ¥${landed}`);
console.log(`  拉手 ¥${HANDLE_UNIT_PRICE}×${handleCount} + 8080装饰料 ¥${DECORATIVE_PROFILE_UNIT_PRICE}×${decorativeCount}`
  + ` = ¥${(HANDLE_UNIT_PRICE * handleCount + DECORATIVE_PROFILE_UNIT_PRICE * decorativeCount).toFixed(2)}`);

assert.equal(landed, TARGET_LANDED_TOTAL, `凳子参考设计发浙江的落地总价应为 ¥${TARGET_LANDED_TOTAL}`);

console.log('Reference design landed total to 浙江 matches the owner-confirmed ¥880.');
