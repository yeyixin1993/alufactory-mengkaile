import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { build } from 'esbuild';

const source = ts.createSourceFile('QuickQuote.tsx', await readFile(new URL('../components/QuickQuote.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node.initializer);
  ts.forEachChild(node, visit);
}
visit(source);
const evaluate = (name, scope) => new Function(...Object.keys(scope), ts.transpile(
  `return (${declarations.get(name).getText(source)});`, { target: ts.ScriptTarget.ES2022 },
))(...Object.values(scope));
const bundle = await build({ entryPoints: ['constants.ts'], bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const round1 = n => Math.round(n * 10) / 10;
const calcShippingOptionsByProvince = evaluate('calcShippingOptionsByProvince', { ...module.exports, round1 });
const useMemo = fn => fn();
function quote(quantity, profileWeight = 0, marineWeight = 0, province = '上海', selection = 'auto', otherRows = {}) {
  const accessorySummary = { totalQuantity: quantity, total: quantity * 3 };
  const rows = { profileRows: profileWeight > 0 ? [{ quantity: 1, length: 1000 }] : [],
    marineBoardRows: marineWeight > 0 ? [{ quantity: 1, width: 500, height: 500 }] : [],
    aluPlateRows: [], pegboardRows: [], frameRows: [], ...otherRows };
  const hasOtherQuotedItems = evaluate('hasOtherQuotedItems', rows);
  const accessoryWeightKg = evaluate('accessoryWeightKg', { accessorySummary, hasOtherQuotedItems });
  const profileSummary = { totalWeightKg: profileWeight, itemTotal: 0 };
  const shipping = evaluate('shippingSummary', { useMemo, round1, accessoryWeightKg, profileSummary,
    marineBoardWeightKg: marineWeight, profileRows: [], selectedProvince: province, shippingSelection: selection, calcShippingOptionsByProvince });
  const total = evaluate('categorySummary', { useMemo, round1, t: {}, profileSummary,
    aluPlateCalculated: [], pegboardCalculated: [], marineBoardCalculated: [], frameCalculated: [],
    accessorySummary, shippingSummary: shipping });
  assert.equal(total.grandTotal, round1(accessorySummary.total + shipping.fee), 'shipping is added exactly once');
  return shipping;
}
const single = quote(1);
const batch = quote(100);
assert.equal(single.totalWeightKg, 1);
assert.equal(batch.totalWeightKg, 1, 'whole batch, not per piece');
assert.equal(single.fee, batch.fee);
assert.ok(single.fee > 0, 'accessory-only quotes charge shipping');
assert.equal(quote(0).totalWeightKg, 0);
assert.equal(quote(0).fee, 0, 'clearing accessories removes their shipping');
assert.equal(quote(30, 2.4, 3.2).totalWeightKg, 5.6);
assert.equal(quote(0, 2.4, 3.2).totalWeightKg, 5.6, 'existing products retain their own weight');
assert.equal(quote(10, 0, 0, '').fee, 0, 'no fee until province is chosen');
for (const method of ['standard', 'sf', 'anneng']) {
  const selected = quote(10, 0, 0, '北京', method);
  assert.equal(selected.method, method);
  assert.equal(selected.fee, calcShippingOptionsByProvince('北京', 1, false).find(x => x.method === method).fee);
}
console.log('PASS: entire accessory batch is 1kg; empty, mixed-product, province, courier, and quote-total calculations.');

for (const category of ['aluPlateRows', 'pegboardRows', 'marineBoardRows']) {
  assert.equal(quote(10, 0, 0, '上海', 'auto', { [category]: [{ quantity: 1, width: 500, height: 500 }] }).totalWeightKg, 0, `${category} waives accessory weight`);
  assert.equal(quote(10, 0, 0, '上海', 'auto', { [category]: [{ quantity: 0, width: 500, height: 500 }] }).totalWeightKg, 1, 'zero quantity is not another quoted product');
  assert.equal(quote(10, 0, 0, '上海', 'auto', { [category]: [{ quantity: 1, width: 0, height: 500 }] }).totalWeightKg, 1, 'incomplete dimensions do not waive weight');
}
assert.equal(quote(10, 0, 0, '上海', 'auto', { frameRows: [{ quantity: 1, innerWidth: 300, innerHeight: 400 }] }).totalWeightKg, 0);
assert.equal(quote(10, 0, 0, '上海', 'auto', { profileRows: [{ quantity: 1, length: 0 }] }).totalWeightKg, 1);
assert.equal(quote(10).totalWeightKg, 1, 'removing other goods restores the accessory-only 1kg allowance');
console.log('PASS: all five other product categories waive accessory weight; blank and zero-quantity rows do not.');
