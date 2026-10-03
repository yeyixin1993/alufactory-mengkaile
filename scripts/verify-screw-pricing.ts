import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { calculatePrice } from '../components/DIYDesigner';
import {
  ACCESSORY_DEFINITIONS,
  ACCESSORY_ROWS,
  CUSTOMER_ACCESSORY_DEFINITIONS,
  CUSTOMER_ACCESSORY_ROWS,
} from '../data/accessoryCatalog';
import {
  DESIGNER_CONFIRMED_SCREW_DEFINITIONS,
  DESIGNER_SCREW_FAMILY_DEFINITIONS,
  DESIGNER_SCREW_HEADS,
  DESIGNER_SCREW_REFERENCE_SPECS,
  DESIGNER_SCREW_SERIES,
} from '../data/designerScrewAccessoryCatalog';
import {
  DEFAULT_SCREW_UNIT_PRICE,
  findScrewAccessoryRow,
  listUnregisteredDesignerScrewSpecifications,
  resolveDesignerScrewPrice,
} from '../utils/designerScrewPricing';
import {
  SCREW_UNIT_PRICE_BY_SERIES,
  inferScrewThreadSizeForSeries,
  resolveScrewUnitPriceForSeries,
} from '../utils/screwSpecIdentity';

/**
 * Regression for the designer's screw pricing:
 *  - 螺丝规格有目录价就按目录价；没有目录价按型号档位（1515/2020 ¥0.5、3030 ¥0.75、
 *    4040 ¥1.5），绝不落成 ¥0；
 *  - 设计器能产出的每个「型号 × 头型」规格都已经登记进配件目录，
 *    因此未被识别的规格不会以匿名 ¥0 零件的形式出现在报价里；
 *  - 长度由几何决定、没有采购规则的兜底行带 `designerInternalOnly` 标记，
 *    只保留目录身份与单价，不进任何客户端配件列表。
 *
 * Numbers are checked against the real 凳子 source fixture, whose 28 颗 M8 螺丝
 * used to be billed at ¥0 because the generated template never recorded a
 * price field.
 */

// 1. The flat default is the owner-confirmed ¥0.5 and is never zero.
assert.equal(DEFAULT_SCREW_UNIT_PRICE, 0.5, '未定价螺丝必须统一按 ¥0.5/个 计价');
assert.deepEqual(
  SCREW_UNIT_PRICE_BY_SERIES,
  { '1515': 0.5, '2020': 0.5, '3030': 0.75, '4040': 1.5 },
  '螺丝型号档位应为 1515/2020 ¥0.5、3030 ¥0.75、4040 ¥1.5',
);

// 2. Every generated definition landed in the one accessory catalog.
const catalogDefIds = new Set(ACCESSORY_DEFINITIONS.map((definition) => definition.id));
const generatedDefinitions = [
  ...DESIGNER_CONFIRMED_SCREW_DEFINITIONS,
  ...DESIGNER_SCREW_FAMILY_DEFINITIONS,
];
assert.ok(generatedDefinitions.length > 0, '必须生成设计器螺丝的配件目录行');
for (const definition of generatedDefinitions) {
  assert.ok(catalogDefIds.has(definition.id), `${definition.id} 未被登记到配件目录`);
  const row = findScrewAccessoryRow(definition.id);
  assert.ok(row, `${definition.id} 必须能在配件列表中取到一行`);
  const unitPrice = resolveScrewUnitPriceForSeries(definition.id.split('_')[1]);
  assert.equal(row.price.natural, unitPrice, `${definition.id} 的本色价应为 ¥${unitPrice}`);
  assert.equal(row.price.colored, unitPrice, `${definition.id} 的彩色价应为 ¥${unitPrice}`);
  assert.equal(row.price.naturalBulk, unitPrice, `${definition.id} 的批量价应为 ¥${unitPrice}`);
  assert.ok(row.name.cn && row.name.en && row.name.jp, `${definition.id} 必须有中英日名称`);
}

// 2b. The generated family rows are designer-internal identities. They must
//     still carry a price (the design bills against them) while staying out of
//     every customer-facing list.
assert.ok(DESIGNER_SCREW_FAMILY_DEFINITIONS.length > 0, '必须生成兜底行');
for (const definition of DESIGNER_SCREW_FAMILY_DEFINITIONS) {
  assert.equal(definition.designerInternalOnly, true, `${definition.id} 应标记为仅设计器内部`);
  assert.equal(definition.name.cn.includes('长度按设计取值'), true, `${definition.id} 的名称应说明长度按设计取值`);
}
for (const definition of DESIGNER_CONFIRMED_SCREW_DEFINITIONS) {
  assert.ok(!definition.designerInternalOnly, `${definition.id} 是已确认订购规格，必须保持客户端可选`);
}
const customerIds = new Set(CUSTOMER_ACCESSORY_DEFINITIONS.map((definition) => definition.id));
const customerRowIds = new Set(CUSTOMER_ACCESSORY_ROWS.map((row) => row.defId));
for (const definition of DESIGNER_SCREW_FAMILY_DEFINITIONS) {
  assert.ok(!customerIds.has(definition.id), `${definition.id} 不得出现在客户端配件目录`);
  assert.ok(!customerRowIds.has(definition.id), `${definition.id} 不得出现在客户端配件列表`);
}
assert.equal(CUSTOMER_ACCESSORY_ROWS.length, ACCESSORY_ROWS.length - DESIGNER_SCREW_FAMILY_DEFINITIONS.length,
  '客户端配件列表应恰好过滤掉兜底螺丝行');

// 3. The confirmed order SKUs exist under their readable ids, at their
//    series-ladder price (3030 keeps its ¥0.75 tier).
for (const [definitionId, unitPrice] of [
  ['10_2020_m6x30_cap', 0.5],
  ['10_2020_m6x20_btn', 0.5],
  ['10_2020_m6x8_cs', 0.5],
  ['10_3030_m8x45_cap', 0.75],
  ['10_3030_m8x20_btn', 0.75],
] as const) {
  assert.ok(catalogDefIds.has(definitionId), `已确认的结构螺丝 ${definitionId} 必须登记到配件目录`);
  assert.equal(findScrewAccessoryRow(definitionId)?.price.natural, unitPrice, `${definitionId} 应为 ¥${unitPrice}`);
}

// 4. Every reachable series × head resolves to a catalog line, never to an
//    anonymous fallback. This *is* the "unrecognised spec gets added to the
//    accessory list" contract.
assert.equal(DESIGNER_SCREW_SERIES.length, 4, '设计器只有 1515/2020/3030/4040 四个系列');
assert.equal(DESIGNER_SCREW_HEADS.length, 3, '设计器只有三种螺丝头');
assert.equal(DESIGNER_SCREW_REFERENCE_SPECS.length, 12, '系列 × 头型 共 12 个规格');
assert.deepEqual(
  listUnregisteredDesignerScrewSpecifications(),
  [],
  '所有设计器可产出的螺丝规格都必须已登记到配件目录',
);

// 5. Resolution order: exact catalog id → series family id → flat default.
const exact = resolveDesignerScrewPrice({ profileSize: '3030', screwHead: 'socket_cylinder', threadSize: 'M8', lengthMm: 45 });
assert.equal(exact.source, 'catalog_exact', '3030 M8×45 圆柱头应命中精确目录行');
assert.equal(exact.unitPrice, 0.75, '3030 M8×45 圆柱头应保持 ¥0.75 档位');
assert.equal(exact.accessoryDefinitionId, '10_3030_m8x45_cap');
assert.equal(exact.accessoryRowKey, '10_3030_m8x45_cap::3030');

const family = resolveDesignerScrewPrice({ profileSize: '3030', screwHead: 'socket_cylinder', threadSize: 'M8', lengthMm: 38 });
assert.equal(family.source, 'catalog_series', '未确认长度的规格应命中型号兜底行');
assert.equal(family.unitPrice, 0.75, '3030 型号兜底行同样为 ¥0.75');
assert.equal(family.accessoryDefinitionId, '10_3030_m8_cap');

const unconfirmed = resolveDesignerScrewPrice({ profileSize: '1515', screwHead: 'button_socket', threadSize: 'M4', lengthMm: 22 });
assert.equal(unconfirmed.source, 'catalog_series', '1515 M4 按钮头应命中型号兜底行');
assert.equal(unconfirmed.accessoryDefinitionId, '10_1515_m4_btn');
assert.equal(unconfirmed.unitPrice, 0.5);

const largeProfile = resolveDesignerScrewPrice({ profileSize: '4040', screwHead: 'flat_socket', threadSize: 'M8', lengthMm: 25 });
assert.equal(largeProfile.source, 'catalog_series', '4040 沉头应命中型号兜底行');
assert.equal(largeProfile.unitPrice, 1.5, '4040 螺丝应保持 ¥1.5 档位');

const unknownSeries = resolveDesignerScrewPrice({ profileSize: '9999', screwHead: 'socket_cylinder', threadSize: 'M9', lengthMm: 10 });
assert.equal(unknownSeries.source, 'default', '未知系列应回落到统一默认价');
assert.equal(unknownSeries.unitPrice, 0.5, '未知系列也必须计价，不得为 ¥0');
const missingHead = resolveDesignerScrewPrice({ profileSize: '2020', screwHead: null, threadSize: 'M6', lengthMm: 30 });
assert.equal(missingHead.unitPrice, 0.5, '缺少头型时也必须计价');

// 6. Never zero, for every series × head the designer can reach, and always at
//    the series' own tier. A price that resolves to an authored catalog row
//    keeps that row's price; anything else bills the flat default.
for (const series of DESIGNER_SCREW_SERIES) {
  const tierPrice = resolveScrewUnitPriceForSeries(series);
  for (const screwHead of DESIGNER_SCREW_HEADS) {
    const threadSize = inferScrewThreadSizeForSeries(series);
    for (const lengthMm of [8, 12, 20, 30, 45, 120]) {
      const resolved = resolveDesignerScrewPrice({ profileSize: series, screwHead, threadSize, lengthMm });
      const label = `${series} ${screwHead} ${threadSize}×${lengthMm}`;
      assert.ok(resolved.unitPrice > 0, `${label} 不得为 ¥0`);
      if (resolved.accessoryDefinitionId) {
        assert.equal(
          resolved.unitPrice,
          findScrewAccessoryRow(resolved.accessoryDefinitionId)?.price.natural,
          `${label} 必须按命中的目录行单价计价`,
        );
        assert.equal(resolved.unitPrice, tierPrice, `${label} 应为 ${series} 档位价 ¥${tierPrice}`);
      } else {
        assert.equal(resolved.unitPrice, DEFAULT_SCREW_UNIT_PRICE, `${label} 未登记时应按 ¥0.5 计价`);
      }
    }
  }
}
const emptySpec = resolveDesignerScrewPrice({});
assert.equal(emptySpec.unitPrice, 0.5, '规格完全缺失时也必须计价');
assert.equal(emptySpec.source, 'default');

// 7. Real 凳子 fixture: 28 颗 M8 螺丝曾经是 ¥0，现在必须逐颗按 3030 档位 ¥0.75 计价。
const fixturePath = path.resolve('scripts/fixtures/stool-import-20260930.json.gz');
const source = JSON.parse(gunzipSync(readFileSync(fixturePath)).toString('utf8')) as unknown as { items: unknown[] };
const items = source.items as Parameters<typeof calculatePrice>[0][];
const screws = items.filter((item) => item.kind === 'screw');
assert.equal(screws.length, 28, '凳子夹具的螺丝数量已变化，请重新核对计价基线');

const screwTotal = screws.reduce((sum, item) => sum + calculatePrice(item), 0);
assert.equal(Number(screwTotal.toFixed(2)), 21, `凳子夹具的 28 颗螺丝合计应为 ¥21（28 × ¥0.75），实际 ¥${screwTotal.toFixed(2)}`);
for (const screw of screws) {
  assert.equal(calculatePrice(screw), 0.75, `${screw.name} ${screw.accessoryProfileSize} 单颗应为 3030 档位 ¥0.75`);
}

const screwSpecs = new Map<string, number>();
for (const screw of screws) {
  const key = `${screw.accessoryProfileSize}·${screw.screwHead}·${screw.height}mm`;
  screwSpecs.set(key, (screwSpecs.get(key) || 0) + 1);
}
assert.equal(screwSpecs.get('3030·socket_cylinder·45mm'), 20, '3030 圆柱头 M8×45 应为 20 颗');
assert.equal(screwSpecs.get('3030·button_socket·20mm'), 8, '3030 按钮头 M8×20 应为 8 颗');

// 8. Whole-design totals through the designer's own price surface.
// ¥479.4 (profiles/boards/connectors) + ¥11.48 光轴 + ¥72 固定支座（16 件 3号角码 3030）
// + ¥88 轮子 + ¥23.12 拉手 + ¥64 装饰料 + ¥21 螺丝 = ¥775.0.
const designTotal = Number(items.reduce((sum, item) => sum + calculatePrice(item), 0).toFixed(1));
assert.equal(designTotal, 775, '凳子模板（普通轮子）整单应为 ¥775.0，而不是导入件归零时的 ¥479.4');

console.log('Designer screw pricing regression checks passed.');
console.log(`  default screw unit price: ¥${DEFAULT_SCREW_UNIT_PRICE}`);
console.log(`  screw unit price by series: ${JSON.stringify(SCREW_UNIT_PRICE_BY_SERIES)}`);
console.log(`  accessory rows: ${ACCESSORY_ROWS.length} total / ${CUSTOMER_ACCESSORY_ROWS.length} customer-facing`
  + ` across ${ACCESSORY_DEFINITIONS.length} accessories`);
console.log(`  generated screw lines: ${DESIGNER_CONFIRMED_SCREW_DEFINITIONS.length} exact + ${DESIGNER_SCREW_FAMILY_DEFINITIONS.length} series family (designer-internal)`);
console.log(`  凳子 screws: ${screws.length} × ¥${resolveScrewUnitPriceForSeries('3030')} = ¥${screwTotal.toFixed(2)}`);
console.log(`  whole 凳子 design: ¥${designTotal.toFixed(1)}`);
