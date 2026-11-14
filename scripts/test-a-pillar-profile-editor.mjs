import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { build } from 'esbuild';

// Exercise the editor's actual price/save closures, including cart and draft
// branches, without coupling this regression to React hook internals.
const source = ts.createSourceFile('ProfileEditor.tsx', await readFile(new URL('../components/ProfileEditor.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node.initializer);
  ts.forEachChild(node, visit);
}
visit(source);
const evaluate = (name, scope) => new Function(...Object.keys(scope), ts.transpile(
  `return (${declarations.get(name).getText(source)});`, { target: ts.ScriptTarget.ES2022 },
))(...Object.values(scope));
const bundle = await build({ stdin: { contents: `export * from './constants'; export * from './data/aPillarMilling';`, resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'cjs', write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const api = module.exports;
const constants = {};
for (const name of ['PRICE_HOLE_THROUGH', 'PRICE_HOLE_COUNTERSUNK', 'PRICE_TAPPING_PER_END', 'PRICE_MITER_CUT', 'MIN_PROFILE_LENGTH_MM', 'DANGER_FEE_THRESHOLD_MM', 'DANGER_FEE_PER_PIECE']) constants[name] = evaluate(name, {});
const noOp = () => {};
const defaultMiterCut = { left: { enabled: false, direction: 'up', side: 'AC' }, right: { enabled: false, direction: 'up', side: 'AC' } };

function editor(options = {}) {
  let saved;
  let drafts;
  let resetAPillar = false;
  const scope = {
    ...api, ...constants, variantId: '2040', length: 1000, finish: 'oxidized', colorId: 'natural',
    aPillarMilling: { specId: 'narrow_single', face: 'B' }, profileDiscountPerMeter: 0, membershipLevel: 'standard',
    holes: [], tapping: { left: [false, false], right: [false, false] }, showMiterCut: false,
    miterCut: defaultMiterCut, defaultMiterCut, remark: '', initialItem: undefined, editingId: null, draftProfiles: [],
    product: api.INITIAL_PRODUCTS.find(product => product.type === 'PROFILE'),
    onSaveConfiguration: undefined, onUpdateItem: value => { saved = value; },
    setDraftProfiles: value => { drafts = value; },
    setEditingId: noOp, setHoles: noOp, setTapping: noOp, setMiterCut: noOp, setShowMiterCut: noOp,
    setAPillar: value => { resetAPillar = value === undefined; }, setRemark: noOp,
    navigate: noOp, returnCartPath: '/cart', t: {}, alert: message => { throw new Error(`Unexpected editor alert: ${message}`); },
    ...options,
  };
  scope.selectedVariant = api.PROFILE_VARIANTS.find(variant => variant.id === scope.variantId);
  scope.selectedColor = api.PROFILE_COLORS.find(color => color.id === scope.colorId);
  scope.effectiveAPillar = evaluate('effectiveAPillar', scope);
  scope.colorOnlyColoredSection = evaluate('colorOnlyColoredSection', scope);
  scope.effectiveFinish = evaluate('effectiveFinish', scope);
  scope.normalizeTappingForVariant = evaluate('normalizeTappingForVariant', { getProfileTapPortCount: () => 2 });
  scope.roundHolePositionsToWholeMm = evaluate('roundHolePositionsToWholeMm', {});
  scope.calculateItemUnitPrice = evaluate('calculateItemUnitPrice', scope);
  return {
    scope,
    price: () => scope.calculateItemUnitPrice(scope.length, scope.holes, scope.tapping, scope.miterCut),
    save: () => { evaluate('addToBatch', scope)(); return { saved, drafts, resetAPillar }; },
  };
}

for (const [specId, colorId, finish, expected] of [
  ['narrow_single', 'natural', 'oxidized', 40], ['wide_single', 'natural', 'oxidized', 50],
  ['narrow_single', 'black', 'electrophoretic', 51], ['wide_single', 'black', 'powder', 61],
]) {
  const state = editor({ aPillarMilling: { specId, face: 'B' }, colorId, finish });
  assert.equal(state.price(), expected);
  if (colorId !== 'natural') assert.equal(state.scope.effectiveFinish, 'powder');
}
assert.equal(editor({ variantId: '2047', aPillarMilling: { specId: 'narrow_double', face: 'A' } }).price(), 57);
assert.equal(editor({ length: 1500, profileDiscountPerMeter: 4, membershipLevel: 'vip_plus' }).price(), 54);
assert.equal(editor({ variantId: '2020' }).price(), 16, 'incompatible model drops milling and its surcharge');
assert.equal(editor({ aPillarMilling: undefined, finish: 'electrophoretic', colorId: 'black' }).price(), 32, 'plain profiles retain natural cut-end pricing');

const initial = { id: 'cart-row', quantity: 3, totalPrice: 81, config: { variantId: '2040', length: 1000, unitPrice: 27, designerSnapshot: 'obsolete-snapshot', designerProjectId: 'old-project' } };
const updated = editor({ initialItem: initial }).save().saved;
assert.deepEqual(updated.config.aPillarMilling, { specId: 'narrow_single', face: 'B' });
assert.equal(updated.config.unitPrice, 40);
assert.equal(updated.totalPrice, 120);
assert.equal(updated.config.designerSnapshot, undefined, 'an edited cart row cannot reopen its stale source snapshot');
assert.equal(updated.config.designerProjectId, undefined);
assert.equal(initial.config.designerSnapshot, 'obsolete-snapshot', 'source config is not mutated');
const removed = editor({ initialItem: updated, aPillarMilling: undefined }).save().saved;
assert.equal(removed.config.aPillarMilling, undefined);
assert.equal(removed.totalPrice, 81);

const draft = editor().save().drafts[0];
const same = editor({ draftProfiles: [structuredClone(draft)] }).save();
assert.equal(same.drafts.length, 1);
assert.equal(same.drafts[0].quantity, 2);
assert.equal(same.drafts[0].totalPrice, 80);
const otherFace = editor({ draftProfiles: [structuredClone(draft)], aPillarMilling: { specId: 'narrow_single', face: 'D' } }).save();
assert.equal(otherFace.drafts.length, 2, 'same-price milling on different faces must not merge');
const otherSpec = editor({ draftProfiles: [structuredClone(draft)], aPillarMilling: { specId: 'wide_single', face: 'B' } }).save();
assert.equal(otherSpec.drafts.length, 2);
const editedDraft = editor({ draftProfiles: [draft], editingId: draft.id, aPillarMilling: { specId: 'wide_single', face: 'D' } }).save();
assert.deepEqual(editedDraft.drafts[0].config.aPillarMilling, { specId: 'wide_single', face: 'D' });
assert.equal(editedDraft.drafts[0].config.unitPrice, 50);
assert.equal(editedDraft.resetAPillar, true, 'a completed draft edit clears the next machining draft');

console.log('PASS: ProfileEditor A-pillar prices, finish restrictions, cart save/removal, stale snapshot invalidation, and face-aware draft merging.');
