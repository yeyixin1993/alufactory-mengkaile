import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { calculatePrice } from '../components/DIYDesigner';
import {
  CASTER_BASE_UNIT_PRICE,
  CASTER_BRAKE_SURCHARGE,
  DECORATIVE_PROFILE_UNIT_PRICE,
  DEFAULT_WHEEL_GRADE,
  HANDLE_UNIT_PRICE,
  IMPORTED_COMPONENT_PRICING_SCHEME,
  SHAFT_SUPPORT_UNIT_PRICE,
  SHAFT_UNIT_PRICE_PER_M,
  UPGRADED_WHEEL_UNIT_PRICE,
  classifyImportedComponent,
  normalizeWheelGrade,
  resolveCasterUnitPrice,
  resolveImportedComponentPrice,
  resolveShaftUnitPrice,
} from '../utils/designerComponentPricing';

/**
 * Regression for the designer's non-profile pricing:
 *  - 光轴按米、光轴支座按件（已确认价）；
 *  - 轮子两档：普通轮子保持原价，升级诺贝轮子 ¥50/个；
 *  - 拉手 ¥23.12/个、8080 装饰料 ¥8/个（已确认价；两件合计 ¥87.12，见落地价规则）。
 * The imported-component figures are checked against the real 凳子 source
 * fixture, not a hand-written mock, so a silently added zero-price part fails.
 */

// 1. Confirmed price basis.
assert.equal(SHAFT_UNIT_PRICE_PER_M, 10, '光轴应沿用已确认的 ¥10/m');
assert.equal(SHAFT_SUPPORT_UNIT_PRICE, 2, '光轴支座应沿用已确认的 ¥2/件');
assert.equal(CASTER_BASE_UNIT_PRICE, 18, '普通轮子底价应为 ¥18');
assert.equal(CASTER_BRAKE_SURCHARGE, 4, '带刹车加价应为 ¥4');
assert.equal(UPGRADED_WHEEL_UNIT_PRICE, 50, '升级诺贝轮子应为 ¥50/个');
assert.equal(HANDLE_UNIT_PRICE, 23.12, '拉手应为 ¥23.12/个（装饰料取整到 ¥8 后，余数落到拉手）');
assert.equal(DECORATIVE_PROFILE_UNIT_PRICE, 8, '8080 装饰料应为整 ¥8/个');
// The pair is what the landed price calibrates: 1 × 拉手 + 8 × 装饰料. Linking the
// 固定支座 to catalog No.3 moved the landing to ¥920 but must not disturb this
// pair — the remainder had already been absorbed here.
assert.equal(
  Number((1 * HANDLE_UNIT_PRICE + 8 * DECORATIVE_PROFILE_UNIT_PRICE).toFixed(2)),
  87.12,
  '拉手 + 8080 装饰料合计必须仍为 ¥87.12（落地价的校准口径，不受固定支座改价影响）',
);
assert.equal(DEFAULT_WHEEL_GRADE, 'standard', '默认应为普通轮子');
assert.equal(normalizeWheelGrade(undefined), 'standard', '未选择时按普通轮子处理');
assert.equal(normalizeWheelGrade('upgraded'), 'upgraded', '升级档位必须可识别');
assert.equal(normalizeWheelGrade('nonsense'), 'standard', '非法档位必须回落到普通轮子');

// 2. Standard tier keeps the original caster price; the upgrade is flat.
assert.equal(resolveCasterUnitPrice({ accessoryThreadSize: 'M8', hasBrake: false }), 18, 'M8 普通轮应保持 ¥18');
assert.equal(resolveCasterUnitPrice({ accessoryThreadSize: 'M8', hasBrake: true }), 22, 'M8 带刹车普通轮应保持 ¥22');
assert.equal(resolveCasterUnitPrice({ accessoryThreadSize: 'M10', hasBrake: true }), 24, 'M10 带刹车应为 ¥24');
assert.equal(resolveCasterUnitPrice({ accessoryThreadSize: 'M12', hasBrake: true }), 26, 'M12 带刹车应为 ¥26');
for (const threadSize of ['M6', 'M8', 'M10', 'M12']) {
  for (const hasBrake of [false, true]) {
    assert.equal(
      resolveCasterUnitPrice({ accessoryThreadSize: threadSize, hasBrake, wheelGrade: 'upgraded' }),
      50,
      `${threadSize}／刹车=${hasBrake} 的升级诺贝轮子都必须按 ¥50/个计价`,
    );
  }
}

// 3. Shaft is length-priced; support is per piece.
assert.equal(resolveShaftUnitPrice(1000), 10, '1m 光轴应为 ¥10');
assert.equal(resolveShaftUnitPrice(287.3), 2.87, '287.3mm 光轴应为 ¥2.87');
assert.equal(resolveShaftUnitPrice(0), 0, '没有长度时不得凭空计价');

// 4. Real 凳子 source fixture.
const fixturePath = path.resolve('scripts/fixtures/stool-import-20260930.json.gz');
const source = JSON.parse(gunzipSync(readFileSync(fixturePath)).toString('utf8')) as unknown as { items: unknown[] };
const items = source.items as Parameters<typeof calculatePrice>[0][];
assert.equal(items.length, 123, '凳子夹具的构件总数已变化，请重新核对计价基线');

const importedItems = items.filter((item) => item.kind === 'imported_component');
assert.equal(importedItems.length, 41, '凳子夹具的导入件数量已变化，请重新核对计价基线');

const pricedByName = new Map<string, { count: number; unitPrice: number; status: string; category: string }>();
let importedTotal = 0;
for (const item of importedItems) {
  const price = resolveImportedComponentPrice({
    semanticType: item.sourceMesh?.source.semanticType,
    componentName: item.sourceMesh?.source.componentName || item.name,
    catalogItemId: item.partCatalogRef?.catalogItemId,
    sourceRecordId: item.partCatalogRef?.sourceRecordId,
    lengthMm: item.length,
    boundsMm: item.sourceMesh?.boundsMm,
    wheelGrade: item.wheelGrade,
    accessoryThreadSize: item.accessoryThreadSize,
    hasBrake: item.hasBrake,
    quantity: item.quantity,
  });
  importedTotal += price.unitPrice * Math.max(1, item.quantity || 1);
  const entry = pricedByName.get(item.name) || { count: 0, unitPrice: price.unitPrice, status: price.status, category: price.category };
  entry.count += 1;
  assert.equal(entry.unitPrice, price.unitPrice, `${item.name} 的同名构件必须同价`);
  pricedByName.set(item.name, entry);
  // The designer's own price surface must agree with the shared rule.
  assert.equal(calculatePrice(item), Number((price.unitPrice * Math.max(1, item.quantity || 1)).toFixed(2)), `${item.name} 在设计器内的价格与计价规则不一致`);
}

const expectPriced = (name: string, count: number, unitPrice: number, status: string, category: string) => {
  const entry = pricedByName.get(name);
  assert.ok(entry, `夹具中缺少 ${name}`);
  assert.equal(entry.count, count, `${name} 的数量应为 ${count}`);
  assert.equal(entry.unitPrice, unitPrice, `${name} 的单价应为 ¥${unitPrice}`);
  assert.equal(entry.status, status, `${name} 的定价状态应为 ${status}`);
  assert.equal(entry.category, category, `${name} 的类别应为 ${category}`);
};
expectPriced('Shaft D12', 4, 2.87, 'confirmed', 'linear_shaft');
expectPriced('SHF12A support', 8, 2, 'confirmed', 'shaft_support');
// The source model's fixed support is the owner-identified 3号角码, so it is
// charged the catalog's 3030 tier (¥4.5) rather than the generic support price.
expectPriced('Source fixed support', 16, 4.5, 'confirmed', 'catalog_accessory');
expectPriced('带刹车脚轮（原模型）', 4, 22, 'confirmed', 'caster');
expectPriced('不锈钢拉手', 1, HANDLE_UNIT_PRICE, 'confirmed', 'handle');
expectPriced('8080装饰短料', 8, DECORATIVE_PROFILE_UNIT_PRICE, 'confirmed', 'decorative_profile');

assert.equal(Number(importedTotal.toFixed(2)), 274.6,
  '普通轮子方案下导入件合计应为 ¥274.6（11.48 光轴 + 88 支座 + 88 轮子 + 23.12 拉手 + 64.00 装饰料）');

const upgraded = items.map((item) => (item.kind === 'imported_component' && classifyImportedComponent({
  semanticType: item.sourceMesh?.source.semanticType,
  componentName: item.sourceMesh?.source.componentName || item.name,
  catalogItemId: item.partCatalogRef?.catalogItemId,
  sourceRecordId: item.partCatalogRef?.sourceRecordId,
}) === 'caster' ? { ...item, wheelGrade: 'upgraded' as const } : item));
const upgradedTotal = upgraded
  .filter((item) => item.kind === 'imported_component')
  .reduce((sum, item) => sum + calculatePrice(item), 0);
assert.equal(Number(upgradedTotal.toFixed(2)), 386.6, '升级诺贝轮子方案下导入件合计应为 ¥386.6（+¥112）');

// 5. Whole-design totals through the designer's own price surface.
// The non-imported part of this design was already verified at ¥479.4, so the
// total must now be that plus the imported parts, the calibrated 拉手/装饰料 and
// the 28 颗 3030 螺丝 (¥0.75 each) instead of the old ¥479.4.
// The sixteen 固定支座 moved from the ¥2 support basis to the 3号角码 catalog
// tier (¥4.5), which is the ¥40 difference from the earlier ¥735 / ¥847 totals.
// These totals are the *scene item* subtotal: the 32 tier fastener sets are not
// scene items, so the cart adds them as their own priced lines (+¥32) and the
// landing figure is ¥952 — see `npm run test:stool-landed-total`.
const totalFor = (designItems: typeof items) => Number(designItems.reduce((sum, item) => sum + calculatePrice(item), 0).toFixed(1));
const standardTotal = totalFor(items);
const upgradedDesignTotal = totalFor(upgraded as typeof items);
assert.equal(upgradedDesignTotal - standardTotal, 112, '升级四只诺贝轮子应比普通方案贵 ¥112');
assert.equal(standardTotal, 775, '凳子模板（普通轮子）整单应为 ¥775，而不是导入件归零时的 ¥479.4');
assert.equal(upgradedDesignTotal, 887, '凳子模板（升级诺贝轮子）零件小计应为 ¥887；层间紧固件 ¥32 由购物车单独成行 ⇒ 落地 ¥952（安能 ¥33）');

console.log('Designer component pricing regression checks passed.');
console.log(`  imported components (standard wheels): ¥${importedTotal.toFixed(2)}`);
console.log(`  imported components (upgraded wheels): ¥${upgradedTotal.toFixed(2)}`);
console.log(`  whole 凳子 design (standard wheels): ¥${standardTotal.toFixed(1)}`);
console.log(`  whole 凳子 design (upgraded wheels): ¥${upgradedDesignTotal.toFixed(1)}（+ 紧固件 ¥32 ⇒ 落地 ¥952）`);
console.log(`  pricing scheme: ${JSON.stringify(IMPORTED_COMPONENT_PRICING_SCHEME)}`);
