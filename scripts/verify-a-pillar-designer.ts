import assert from 'node:assert/strict';
import { LineSegments, Mesh } from 'three';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FactorySheet from '../components/FactorySheet';
import { buildDesignDocument, buildProductionData, calculatePrice, createChatProfilePreview, itemsFromProductionWorkbook, normalizeDesignItems, originalCartRowForSceneItem, restoreCartDesign } from '../components/DIYDesigner';
import { getAPillarMillingLayout, readAPillarMillingConfig } from '../data/aPillarMilling';
import { INITIAL_PRODUCTS } from '../constants';
import { ProductType, type CartItem } from '../types';
import { buildProductionXlsx } from '../utils/productionXlsx';
import { strFromU8, unzipSync } from 'fflate';
import { createDesignSourceInfo } from '../utils/designSource';
import { getProfileManufacturingGroupKey, groupIdenticalProfileCartItems } from '../utils/cartAccessories';
import { inspectDesignerImportItems } from '../utils/designerImportPreflight';
import { decodeDesignerSnapshot, encodeDesignerSnapshot } from '../utils/designerCartSnapshot';

type SceneItem = Parameters<typeof buildProductionData>[0][number];
const config = { specId: 'narrow_double', face: 'B' } as const;
const item: SceneItem = { id: 'milled-2047', kind: 'profile', name: '2047', variantId: '2047',
  position: [0, 0, 0], rotation: [0, 0, 0], length: 1000, colorId: 'natural', quantity: 2,
  holes: [], tappingLeft: false, tappingRight: false, aPillarMilling: config };

for (const length of [0, 13, 14, 21, 25, 38, 39, 40, 99, 1000, 3000]) {
  const layout = getAPillarMillingLayout('2047', length, config)!;
  const centers = layout.centersMm;
  for (const [index, center] of centers.entries()) {
    assert(Number.isInteger(center));
    assert(center >= 7 && center + 7 <= length, 'never create a partial end slot');
    if (index > 0) assert.equal(center - centers[index - 1], 25);
  }
  if (centers.length) assert(Math.abs(centers[0] - (length - centers.at(-1)!)) <= 1);
  else assert(length < 14);
  assert.deepEqual(layout.columnOffsetsMm, [-4, 4]);
}
assert.equal(calculatePrice(item), 114, '2047 natural double: (41 + 16) × 1m × 2');
assert.equal(calculatePrice({ ...item, colorId: 'black' }), 148);
assert.equal(calculatePrice({ ...item, length: 1500 }), 171);
assert.equal(calculatePrice({ ...item, aPillarMilling: undefined }), 82);
assert.deepEqual(normalizeDesignItems([item])[0].aPillarMilling, config);
assert.equal(normalizeDesignItems([{ ...item, variantId: '2020' }])[0].aPillarMilling, undefined);
assert.equal(normalizeDesignItems([{ ...item, colorId: 'black', finish: 'electrophoretic' }])[0].finish, 'powder');

const document = buildDesignDocument([item], 'cn', createDesignSourceInfo('manual_designer'));
assert.deepEqual(JSON.parse(JSON.stringify(document)).items[0].aPillarMilling, config);
assert.deepEqual((decodeDesignerSnapshot(encodeDesignerSnapshot(document)) as typeof document).items[0].aPillarMilling, config);
const production = buildProductionData([item], 'cn');
assert.deepEqual(production.parts[0].aPillarMilling, config);
assert.equal(production.holes.length, 0, 'milling must not turn into screw holes');
const xlsx = buildProductionXlsx(production);
const workbookXml = Object.values(unzipSync(xlsx)).map(bytes => strFromU8(bytes)).join('\n');
assert(workbookXml.includes('A柱规格ID') && workbookXml.includes('narrow_double'));
assert(workbookXml.includes('A柱加工面') && workbookXml.includes('孔距25mm'));
assert.deepEqual(itemsFromProductionWorkbook(JSON.parse(JSON.stringify(production)))[0].aPillarMilling, config);

const row: CartItem = { id: 'cart-profile', product: INITIAL_PRODUCTS.find(product => product.type === ProductType.PROFILE)!, quantity: 2, totalPrice: 114,
  config: { variantId: '2047', length: 1000, colorId: 'natural', finish: 'oxidized', aPillarMilling: config,
    tapping: { left: [], right: [] }, holes: [], unitPrice: 57 } };
const restored = restoreCartDesign([row]).items[0];
assert.deepEqual(restored.aPillarMilling, config);
assert.deepEqual(originalCartRowForSceneItem(restored)?.config.aPillarMilling, config);
assert.equal(originalCartRowForSceneItem({ ...restored, aPillarMilling: undefined }), null);
assert.equal(calculatePrice({ ...restored, aPillarMilling: undefined }), 82, 'removing milling invalidates original price cache');
const otherFace = { ...row, id: 'other-face', config: { ...row.config, aPillarMilling: { ...config, face: 'D' } } };
assert.notEqual(getProfileManufacturingGroupKey(row), getProfileManufacturingGroupKey(otherFace));
assert.equal(groupIdenticalProfileCartItems([row, otherFace]).length, 2);
assert.equal(groupIdenticalProfileCartItems([row, { ...row, id: 'identical' }]).length, 1);
const factorySheet = renderToStaticMarkup(createElement(FactorySheet, {
  cart: [row], user: null, language: 'cn', orderRef: 'A-PILLAR-TEST', dateStr: '2026-11-13',
}));
assert(factorySheet.includes('factory-a-pillar-summary'));
assert(factorySheet.includes('孔距25mm，共80孔'));
assert(!factorySheet.includes('无额外加工'));
assert.equal((factorySheet.match(/data-testid="profile-a-pillar-slot"/g) || []).length, 80,
  'the factory drawing must include all slots on the selected milling face');
assert.equal(inspectDesignerImportItems([item]).valid, true);
for (const invalid of [{ specId: 'wide_single', face: 'B' }, { specId: 'narrow_double', face: 'C' }, 'narrow_double', null]) {
  assert.equal(inspectDesignerImportItems([{ ...item, aPillarMilling: invalid }]).valid, false);
  assert.throws(() => readAPillarMillingConfig('2047', invalid));
}
const group = createChatProfilePreview({ ...row.config, length: 1000, holes: [], tapping: { left: [], right: [] } });
const body = group.children.find(child => child instanceof Mesh) as Mesh;
assert.equal(body.geometry.userData.aPillarMilling.slotCount, 80, 'main renderer consumes saved milling');
assert.equal(body.geometry.userData.aPillarMilling.face, 'B');
const ordinary = createChatProfilePreview({ ...row.config, length: 1000, holes: [], tapping: { left: [], right: [] }, aPillarMilling: undefined });
const ordinaryBody = ordinary.children.find(child => child instanceof Mesh) as Mesh;
const outline = body.children.find(child => child instanceof LineSegments) as LineSegments;
const ordinaryOutline = ordinaryBody.children.find(child => child instanceof LineSegments) as LineSegments;
assert.equal(outline.geometry.getAttribute('position').count, ordinaryOutline.geometry.getAttribute('position').count,
  'milling must not draw triangulation seams across the flat profile face');
console.log('PASS: A-pillar full-slot layout, pricing, edit normalization, save/snapshot, production JSON/XLSX fields, cart restoration, grouping, strict import and main renderer.');
