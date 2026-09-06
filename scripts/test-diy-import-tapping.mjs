import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Run the actual import callbacks with file/React boundaries replaced by an
// in-memory harness. Never modify a customer's browser or saved design.
const source = ts.createSourceFile('DIYDesigner.tsx', await readFile(new URL('../components/DIYDesigner.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.set(node.name.text, node.initializer);
  ts.forEachChild(node, visit);
}
visit(source);
const compile = (name, scope = {}) => new Function(...Object.keys(scope), ts.transpile(
  `const fn = ${declarations.get(name).getText(source)}; return fn;`, { target: ts.ScriptTarget.ES2022 },
))(...Object.values(scope));
const tap = compile('withImportedProfileEndTapping');
const original = { id: 'existing', kind: 'profile', tappingLeft: false, tappingRight: false };
const imported = { id: 'new-id', kind: 'profile', tappingLeft: true, tappingRight: false, holes: [{ id: 'hole-1' }] };
const board = { id: 'board', kind: 'marine_board' };
const cap = { id: 'cap', kind: 'end_cap', autoAddedTapping: true, attachedProfileIds: ['new-id'] };
const oldCap = { ...cap, id: 'old-cap', attachedProfileIds: ['existing'] };
const items = [original, imported, board, cap, oldCap];
const tapped = tap(items, ['new-id']);
assert.strictEqual(tapped[0], original);
assert.deepEqual(tapped[1], { ...imported, tappingRight: true });
assert.strictEqual(tapped[2], board);
assert.equal(tapped[3].autoAddedTapping, false);
assert.strictEqual(tapped[4], oldCap);
assert.equal(imported.tappingRight, false, 'input stays unchanged for undo');

for (const format of ['design', 'order', 'boards', 'cancel', 'invalid']) {
  let reader, prompt = null, importedOnce = false, warning = false;
  const importJson = compile('importJson', {
    FileReader: class { constructor() { reader = this; } readAsText(file) { this.result = file; } },
    normalizeDesignItems: items => items,
    mapSystemOrderProfileItemsToDesignerItems: items => items,
    createItem: () => ({}),
    designSourceFromDocument: () => ({}),
    normalizeFinishedFurnitureQuote: () => null,
    applyImportedDesign: async incoming => {
      importedOnce = true;
      // Append imports remap IDs; the prompt must use the result, not input IDs.
      return format === 'cancel' ? null : incoming.map(item => ({ ...item, id: `remapped-${item.id}` }));
    },
    setImportTappingPrompt: next => prompt = next,
    showNotice: () => {}, t: {}, console: { warn: () => warning = true },
  });
  const json = format === 'invalid' ? '{bad json' : JSON.stringify(format === 'order'
    ? { order_json: { items: [imported] } }
    : { items: format === 'boards' ? [board] : [imported, board] });
  importJson(json);
  await reader.onload();
  assert.equal(importedOnce, format !== 'invalid');
  assert.equal(warning, format === 'invalid');
  assert.deepEqual(prompt, ['design', 'order'].includes(format)
    ? { source: 'json', profileIds: ['remapped-new-id'] } : null);
}
for (const source of ['json', 'maycad']) {
  let prompt = { source, profileIds: ['new-id'] }, committed, notice;
  const scope = { items, importTappingPrompt: prompt, withImportedProfileEndTapping: tap,
    commit: next => committed = next, setImportTappingPrompt: next => prompt = next,
    showNotice: next => notice = next, t: { jsonTappingSkipped: 'json preserved', maycadTappingSkipped: 'maycad untapped' } };
  compile('keepImportedProfileTapping', scope)();
  assert.equal(prompt, null);
  assert.equal(committed, undefined, 'keep must not change machining');
  assert.equal(notice, source === 'json' ? 'json preserved' : 'maycad untapped');
  compile('applyTappingToAllImportedProfiles', scope)();
  assert.deepEqual(committed, tapped);
  assert.equal(prompt, null);
}
console.log('PASS: JSON/order JSON prompt, remapped batch scope, keep/apply, cancellation, invalid/board-only imports, MayCAD reuse, hole preservation and end-cap tapping ownership.');
