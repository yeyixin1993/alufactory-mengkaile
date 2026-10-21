import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { buildAccessoryKitLines, getAccessoryKit, kitLinesTotal, scaleAccessoryKitConfig, withIncludedAccessoryPacking } from '../utils/accessoryKit';
import { getDesignerKitLines, buildProductionData, normalizeDesignItems } from '../components/DIYDesigner';
import { buildProductionXlsx } from '../utils/productionXlsx';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FactorySheet from '../components/FactorySheet';
import { ProductType } from '../types';
import { isDiyScrewAccessory } from '../utils/cartAccessories';

for (const series of ['1515', '2020', '3030']) {
  for (const def of ['2', '7L', '7T', '9']) {
    const lines = buildAccessoryKitLines(def, series, 3, 'natural', 'cn');
    const ratio = def === '2' ? 2 : def === '9' ? 3 : 4;
    assert.equal(lines[0].quantity, ratio * 3);
    assert.equal(lines[0].unitPrice, lines[0].originalUnitPrice / 2);
    assert.equal(lines.length, def === '9' ? 1 : 2);
    if (lines[1]) { assert.equal(lines[1].quantity, ratio * 3); assert.equal(lines[1].unitPrice, lines[1].originalUnitPrice / 2); }
  }
}
assert.equal(kitLinesTotal(buildAccessoryKitLines('2', '2020', 1, 'natural', 'cn')), 1);
assert.equal(kitLinesTotal(buildAccessoryKitLines('2', '2020', 10, 'natural', 'cn')), 6.6);
assert.equal(buildAccessoryKitLines('2', '2020', 10, 'natural', 'cn')[0].unitPrice, .165);
for (const def of ['1', '2', '3', '7L', '7T', '9']) assert.equal(getAccessoryKit(def, '4040'), null);
assert.equal(getAccessoryKit('3', '3030')?.screw.key, getAccessoryKit('7L', '3030')?.screw.key);
assert.match(getAccessoryKit('1', '2020')!.screw.name.cn, /规格待补/);
const item: any = { id: 'kit-test', kind: 'extruded_connector', quantity: 2, colorId: 'natural', accessoryProfileSize: '2020', position: [0,0,0], rotation: [0,0,0] };
assert.deepEqual(getDesignerKitLines(item), buildAccessoryKitLines('2', '2020', 2, 'natural', 'cn'));
assert.deepEqual(getDesignerKitLines({ ...item, installationKit: false }), []);
assert.equal(normalizeDesignItems([{ ...item, installationKit: false }])[0].installationKit, false);
const kit = getDesignerKitLines(item);
const cfg = { quantities: { '2::2020': 2 }, lines: kit, unitTotal: kitLinesTotal(kit), totalQuantity: 8 };
const scaled = scaleAccessoryKitConfig(cfg, 3);
assert.equal(scaled.lines[0].quantity, 12);
assert.equal(scaled.unitTotal, cfg.unitTotal * 3);
assert.equal(cfg.lines[0].quantity, 4);
assert.equal(isDiyScrewAccessory({ product: {type: ProductType.ACCESSORY}, config: cfg } as any), false);
const production = buildProductionData([{ ...item, installationKit: false }], 'cn');
const bytes = buildProductionXlsx(production);
const xml = Object.values(unzipSync(bytes)).map(bytes => strFromU8(bytes)).join('');
assert.match(xml, /配套安装件/);
assert.match(xml, /否/);
assert.equal(buildProductionData([item], 'cn').parts[0].installationKitLines[0].quantity, 4);
console.log('Accessory kits: ratios, exact SKUs, discount/bulk precision, cart scaling, designer, no screw-estimate overlap, XLSX export passed.');

for (const def of ['1', '3']) {
  const included = buildAccessoryKitLines(def, '2020', 4, 'colored', 'cn');
  assert.deepEqual(included.map(line => line.quantity), [8,8]);
  assert.equal(kitLinesTotal(included), 0);
}
const historical: any = { id: 'old-included', product: { id: 'accessory', type: ProductType.ACCESSORY, name: { cn: '铝型材配件', en: 'Accessories', jp: '部品' } }, quantity: 1, totalPrice: 4, config: { type: 'profile_accessory', profileSize: '2020', totalQuantity: 4, unitTotal: 4, lines: [{ id: '1', code: 1, name: '1号角码', quantity: 4, subtotal: 4 }] } };
const repaired: any = withIncludedAccessoryPacking(historical, 'cn');
assert.equal(repaired.config.lines.length, 3);
assert.equal(repaired.config.lines[1].quantity, 8);
assert.equal(repaired.totalPrice, 4);
assert.equal(historical.config.lines.length, 1);
assert.equal((withIncludedAccessoryPacking(repaired, 'cn').config as any).lines.length, 3);
assert.equal((withIncludedAccessoryPacking({ ...historical, config: { ...historical.config, installationKit: false } }, 'cn').config as any).lines.length, 1);
const html = renderToStaticMarkup(React.createElement(FactorySheet, { cart: [historical], user: null, language: 'cn', orderRef: 'KIT-TEST', dateStr: '2026-10-20', shippingFee: 0 }));
assert.match(html, /1号配套螺丝（规格待补）/);
assert.match(html, /1号配套螺母（规格待补）/);
assert.match(html, /已含配发，不另收费/);
console.log('Included No.1/3, historical packing repair idempotence and actual factory-sheet render passed.');
