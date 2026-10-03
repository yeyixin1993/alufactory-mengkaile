import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { calculatePrice } from '../components/DIYDesigner';
import {
  ACCESSORY_CODE_IMAGE_MAP,
  ACCESSORY_ROWS,
} from '../data/accessoryCatalog';
import {
  DESIGNER_SOURCE_ACCESSORY_LINKS,
  SOURCE_ACCESSORY_MODULE_TOLERANCE_MM,
  getDesignerSourceAccessoryLink,
  resolveDesignerSourceAccessoryRow,
  resolveSourceBracketSeries,
} from '../data/designerSourceAccessoryLinks';
import {
  SHAFT_SUPPORT_UNIT_PRICE,
  resolveImportedComponentPrice,
} from '../utils/designerComponentPricing';

/**
 * Freezes the owner-identified link between a source-model part and a numbered
 * catalog accessory.
 *
 * The 凳子 source model's 固定支座 is the customer chart's **3号角码**. This
 * regression pins that identification, the price basis that follows from it, the
 * artwork that now belongs to No.3, and the fail-closed behaviour for a source
 * bracket the catalog cannot place. A wrong series here would silently charge
 * the wrong tier, and a missing picture would send the customer's 3号角码 row
 * back to the whole 1–10 chart.
 */

// --- 1. The link record itself ---------------------------------------------
assert.equal(DESIGNER_SOURCE_ACCESSORY_LINKS.length, 1,
  '源模型零件与目录配件的关联记录数量已变化，请重新核对设计器显示与计价');
const link = getDesignerSourceAccessoryLink('fixed_support');
assert.ok(link, 'fixed_support 必须仍然关联到目录配件');
assert.equal(link.definitionId, '3', '固定支座应关联到目录定义 3（3号角码）');
assert.equal(getDesignerSourceAccessoryLink('FIXED_SUPPORT')?.definitionId, '3',
  '来源类型的大小写不得影响关联');
assert.equal(getDesignerSourceAccessoryLink('shaft_support'), null,
  'SHF/SK 支座不在关联表内，不应被当成 3号角码');

// --- 2. Series is read from the part's own envelope -------------------------
const rowOf = (min: number[], max: number[], semanticType = 'fixed_support') => (
  resolveDesignerSourceAccessoryRow(semanticType, { min, max })
);
// The fixture bracket measures 27 × 30 × 30: two 30mm arms on a 3030 profile,
// and the 27mm third extent is the notch, not an arm.
const fixtureBounds = { min: [-13.5, -15, -15], max: [13.5, 15, 15] };
assert.equal(resolveSourceBracketSeries(fixtureBounds), '3030',
  '固定支座的 27×30×30 包络应读出 3030 系列');
// Same part on the 2020 tier: two 20mm arms, third extent 17mm (20 − 3, the
// same notch as the 3030 bracket). The two arms must agree; only then is it a
// catalog bracket.
const bracket2020 = { min: [0, 0, 0], max: [17, 20, 20] };
assert.equal(resolveSourceBracketSeries(bracket2020), '2020',
  '20mm 两臂的角码应读出 2020 系列');
assert.equal(resolveSourceBracketSeries({ min: [0, 0, 0], max: [27, 20, 20] }), null,
  '两臂不相等时不得猜系列：27mm 与 20mm 不是同一个 2020 角码');
assert.equal(resolveSourceBracketSeries({ min: [0, 0, 0], max: [50, 50, 2] }), null,
  '两臂不落在任何目录模块上时必须返回 null，而不是猜一个系列');
assert.equal(resolveSourceBracketSeries(null), null, '没有包络时不得推断系列');

const row3030 = rowOf(fixtureBounds.min as number[], fixtureBounds.max as number[]);
assert.ok(row3030, '3030 的固定支座必须解析到一行目录配件');
assert.equal(row3030.defId, '3', '解析出的目录行必须是 3号角码');
assert.equal(row3030.series, '3030', '解析出的目录行必须是 3030 档');
assert.equal(row3030.code, 3, '目录编号必须是 3');
assert.equal(row3030.name.cn, '3号角码', '中文名必须是 3号角码');
assert.equal(row3030.price.natural, 4.5, '3030 本色价应为 ¥4.5');
assert.equal(
  row3030.key,
  ACCESSORY_ROWS.find((row) => row.defId === '3' && row.series === '3030')!.key,
  '解析必须命中目录里真实存在的那一行',
);

// --- 3. Pricing follows the catalog row, not the generic support basis ------
const priceOf = (boundsMm: { min: number[]; max: number[] } | null, quantity = 1, semanticType = 'fixed_support') => (
  resolveImportedComponentPrice({ semanticType, boundsMm, quantity })
);
const pricedBracket = priceOf(fixtureBounds);
assert.equal(pricedBracket.category, 'catalog_accessory',
  '已关联目录的源模型零件类别应为 catalog_accessory');
assert.equal(pricedBracket.status, 'confirmed', '3号角码价格必须是已确认价');
assert.equal(pricedBracket.basis, 'piece', '3号角码应按件计价');
assert.equal(pricedBracket.unitPrice, 4.5, '16 件（低于批量门槛）应按本色零售价 ¥4.5/件');
assert.equal(pricedBracket.linkedAccessory?.defId, '3', '价格必须带回它所依据的目录行');
// Bulk is the accessory list's own rule, so a big design cannot be over-quoted.
assert.equal(priceOf(fixtureBounds, 20).unitPrice, 3.5,
  '达到 20 件批量门槛时应使用 3号角码的本色批量价 ¥3.5');
// A 2020 bracket is the same catalog part on the 2020 tier.
assert.equal(priceOf(bracket2020).unitPrice, 3,
  '2020 的 3号角码应为本色零售价 ¥3/件');

// Fail-closed: a source bracket the catalog cannot place keeps the support rule.
const unplaceable = priceOf({ min: [0, 0, 0], max: [27, 25, 25] });
assert.equal(unplaceable.category, 'shaft_support',
  '包络读不出系列时，固定支座必须回落到通用支座规则');
assert.equal(unplaceable.unitPrice, SHAFT_SUPPORT_UNIT_PRICE,
  '包络读不出系列时不得借用 3号角码的价格');
assert.equal(unplaceable.linkedAccessory, null, '未关联的零件不得带回目录行');
assert.equal(SOURCE_ACCESSORY_MODULE_TOLERANCE_MM, 1, '模块容差应保持 1mm（只吸收建模噪声）');

// --- 4. The real fixture, through the designer's own price surface ----------
const fixturePath = path.resolve('scripts/fixtures/stool-import-20260930.json.gz');
const source = JSON.parse(gunzipSync(readFileSync(fixturePath)).toString('utf8')) as unknown as {
  items: Array<Record<string, unknown>>;
};
const items = source.items as unknown as Parameters<typeof calculatePrice>[0][];
const fixedSupports = items.filter((item) => (
  item.kind === 'imported_component' && item.sourceMesh?.source.semanticType === 'fixed_support'
));
const shaftSupports = items.filter((item) => (
  item.kind === 'imported_component' && item.sourceMesh?.source.semanticType === 'shaft_support'
));
assert.equal(fixedSupports.length, 16, '凳子夹具的固定支座数量已变化');
assert.equal(shaftSupports.length, 8, '凳子夹具的 SHF 轴支座数量已变化');

const bracketTotal = fixedSupports.reduce((sum, item) => sum + calculatePrice(item), 0);
assert.equal(bracketTotal, 72, '十六件 3号角码 应合计 ¥72（4.5 × 16）');
const shaftSupportTotal = shaftSupports.reduce((sum, item) => sum + calculatePrice(item), 0);
assert.equal(shaftSupportTotal, 16, '八件 SHF 轴支座应仍按 ¥2/件 计为 ¥16');
for (const item of fixedSupports) {
  assert.equal(calculatePrice(item), 4.5,
    '每一件固定支座都必须按 3号角码 3030 目录价计价，不得回落');
}

// --- 5. No.3 has its own artwork now ---------------------------------------
assert.equal(ACCESSORY_CODE_IMAGE_MAP['3'], '/images/accessory/3.jpg',
  '3号配件必须使用专属图案，不得再回落到整张 1–10 号识别图');
assert.notEqual(ACCESSORY_CODE_IMAGE_MAP['3'], ACCESSORY_CODE_IMAGE_MAP['2'],
  '3号配件的图案不应与其它编号共用');

const root = path.resolve('.');
const picturePath = path.join(root, `public${ACCESSORY_CODE_IMAGE_MAP['3']}`);
assert.ok(existsSync(picturePath), `3号配件图案缺失：${picturePath}`);
// JPEG magic number: the customer-facing slot is a photograph, never an SVG.
const pictureHead = readFileSync(picturePath).subarray(0, 3);
assert.deepEqual(Array.from(pictureHead), [0xff, 0xd8, 0xff],
  '3号配件的客户图案必须是真实照片（JPG），不能用矢量图顶替');
assert.ok(statSync(picturePath).size > 4000, '3号配件图案过小，可能裁切失败');

const artworkPath = path.join(root, 'public/images/accessory/3.svg');
assert.ok(existsSync(artworkPath), '3号配件的设计器矢量图案缺失');
const artwork = readFileSync(artworkPath, 'utf8');
assert.match(artwork, /viewBox="0 0 400 300"/,
  '设计器图案必须与 1/2/5/7/9 的图案同为 400×300 画布');
assert.match(artwork, /<title[^>]*>3号角码<\/title>/, '设计器图案应标明 3号角码');
assert.match(artwork, /<path/, '设计器图案必须包含按源网格绘制的形状');

console.log('Designer source-accessory link checks passed.');
console.log(`  固定支座 → 目录定义 ${link.definitionId}（3号角码，3030）`);
console.log(`  夹具：16 件 × ¥${pricedBracket.unitPrice} = ¥${bracketTotal}；SHF 轴支座 8 件 × ¥${SHAFT_SUPPORT_UNIT_PRICE} = ¥${shaftSupportTotal}`);
console.log(`  图案：${ACCESSORY_CODE_IMAGE_MAP['3']}（实物）+ public/images/accessory/3.svg（设计器）`);
