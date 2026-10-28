import assert from 'node:assert/strict';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
const { outputFiles } = await build({ entryPoints: ['components/BoardQuoteEditor.tsx'], bundle: true, platform: 'node', format: 'esm', packages: 'external', write: false });
// Place the module beside node_modules so React resolves to the renderer's instance.
const { writeFile, unlink } = await import('node:fs/promises');
const moduleUrl = new URL('../.verify-marine-editor.mjs', import.meta.url);
await writeFile(moduleUrl, outputFiles[0].text);
try {
  const { default: Editor } = await import(moduleUrl.href);
  const render = (config, quantity = 1) => renderToStaticMarkup(React.createElement(MemoryRouter, null,
    React.createElement(Editor, { language: 'cn', product: { id: 'p6' }, initialItem: { config, quantity }, onAddToCart() {}, onUpdateItem() {} })));
  const base = { width: 1200, height: 2400, thickness: 18, marineSpecId: 'marine_bbb_uv_film' };
  const custom = render(base);
  assert.match(custom, /2\.880㎡/);
  assert.match(custom, /￥576\.0/);
  assert.doesNotMatch(custom, /text-red-600/);
  assert.match(render({ ...base, width: 2400, height: 1200 }), /2\.880㎡/);
  assert.match(render({ ...base, width: 2400, height: 2400 }), /text-red-600/);
  for (const [thickness, marineSpecId, price] of [[12, 'marine_bbb_plain', 226], [12, 'marine_bbb_uv_film', 258], [18, 'marine_bbb_plain', 339], [18, 'marine_bbb_uv_film', 388]]) {
    const html = render({ ...base, thickness, marineSpecId, boardPurchaseMode: 'full_sheet' }, 3);
    assert.match(html, /value="2440"/);
    assert.match(html, /value="1220"/);
    assert.match(html, /2\.977㎡/);
    assert.ok(html.includes(`￥${price.toFixed(1)}`));
    assert.ok(html.includes(`￥${(price * 3).toFixed(1)}`));
    assert.doesNotMatch(html, /text-red-600/);
  }
  assert.match(render({ ...base, width: 100, height: 100 }), /￥40\.0/);
  console.log('PASS: rotated custom dimensions, 2.88m² / ¥576, oversized validation, four full-sheet prices, quantity multiplication, restored sheet dimensions, custom minimum area.');
} finally { await unlink(moduleUrl); }
