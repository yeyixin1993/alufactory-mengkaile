import assert from 'node:assert/strict';
import { buildDesignDocument, completeParametricFurnitureTemplate, restoreCartDesign, originalCartRowForSceneItem } from '../components/DIYDesigner';
import { buildWardrobeTemplate } from '../utils/parametricFurniture';
import { createDesignSourceInfo } from '../utils/designSource';
import { encodeDesignerSnapshot, decodeDesignerSnapshot } from '../utils/designerCartSnapshot';
import { INITIAL_PRODUCTS } from '../constants';
import { ProductType } from '../types';
const payload = buildWardrobeTemplate(1200, 600, 2200, 2, 2, '3030');
const { items } = completeParametricFurnitureTemplate(payload);
const document = buildDesignDocument(items, 'cn', createDesignSourceInfo('parametric_template'), payload.finishedFurniture);
const snapshot = encodeDesignerSnapshot(document);
assert.deepEqual(decodeDesignerSnapshot(snapshot), JSON.parse(JSON.stringify(document)));
const row = { id: 'wardrobe', product: INITIAL_PRODUCTS.find(p => p.id === 'p8')!, quantity: 1, totalPrice: 100, config: { designerProjectId: 'assembly', designerSnapshot: snapshot } };
const reopened = restoreCartDesign([row, { ...row, id: 'another-line' }]);
assert.equal(reopened.items.length, items.length, 'one assembly, not a copy per BOM row');
assert.deepEqual(reopened.items.map(i => i.id), items.map(i => i.id));
assert.deepEqual(reopened.items.map(i => i.position), JSON.parse(JSON.stringify(items.map(i => i.position))));
assert.equal(reopened.finishedFurniture?.productId, 'p8');
assert.equal(restoreCartDesign([{ ...row, id: 'surviving-line' }]).items.length, items.length, 'a surviving line retains the whole scene');
const profile = { id: 'ordinary', product: INITIAL_PRODUCTS.find(p => p.type === ProductType.PROFILE)!, quantity: 3, totalPrice: 98, config: { variantId: '2040', length: 620, colorId: 'natural', tapping: { left: [true, false], right: [false, false] }, holes: [{ id: 'h1', side: 'A', type: 'through', positionMm: 100 }], remark: 'keep', miterCut: { left: 45 } } };
const flat = restoreCartDesign([profile, { ...profile, id: 'ordinary2' }]);
assert.equal(flat.items.length, 2);
assert.notDeepEqual(flat.items[0].position, flat.items[1].position);
assert.equal(flat.items[0].quantity, 3);
assert.deepEqual(originalCartRowForSceneItem(flat.items[0])?.config, profile.config, 'partial tapping, miter and original detail survive unchanged reorder');
assert.equal(originalCartRowForSceneItem({ ...flat.items[0], length: 700 }), null, 'editing material uses the current designer quote');
assert.equal(originalCartRowForSceneItem({ ...flat.items[0], quantity: 6 })?.totalPrice, 196);
assert.throws(() => restoreCartDesign([{ ...row, config: { designerSnapshot: 'bad' } }]));
console.log('PASS: complete snapshot, project deduplication, stable relations, surviving row, flat layout, unchanged reorder, edited repricing, invalid snapshot.');

for (const type of [ProductType.ALUMINUM_PLATE, ProductType.PEGBOARD, ProductType.MARINE_BOARD, ProductType.CABINET_DOOR, ProductType.FRAME].filter(Boolean)) {
  const product = INITIAL_PRODUCTS.find(p => p.type === type)!;
  const catalogRow = { id: String(type), product, quantity: 2, totalPrice: 480, config: { width: 500, height: 2000, thickness: 2, openingSide: 'right', marineSpecId: 'marine_bbb', colorId: 'natural' } };
  const scene = restoreCartDesign([catalogRow]);
  assert.deepEqual(originalCartRowForSceneItem(scene.items[0])?.config, catalogRow.config);
  assert.equal(originalCartRowForSceneItem(scene.items[0])?.totalPrice, 480);
}
console.log('PASS: board, door and catalog row details survive flat restoration.');
