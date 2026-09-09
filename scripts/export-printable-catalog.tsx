import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import PrintableCatalog from '../components/PrintableCatalog';
import { PROFILE_VARIANTS } from '../constants';
import { ACCESSORY_DEFINITIONS } from '../data/accessoryCatalog';
import type { Language } from '../types';
import { catalogLocale, catalogText } from '../utils/catalogLocalization';
import * as boardPricing from '../data/boardPricing';

// One self-contained HTML snapshot, rendered from the same component/data as #/catalog.
// Run via npm run catalog:html before a deployment so the downloadable snapshot is current.
async function main() {
const root = process.cwd();
const css = await readFile(path.join(root, 'components/PrintableCatalog.css'), 'utf8');
for (const language of ['cn', 'en', 'jp'] as Language[]) {
let markup = renderToStaticMarkup(<PrintableCatalog language={language} />);
const imageSources = [...new Set([...markup.matchAll(/(?:src|href)="(\/images\/[^\"]+)"/g)].map(m => m[1]))];
for (const src of imageSources) {
  const buffer = await readFile(path.join(root, 'public', src));
  const extension = path.extname(src).slice(1).toLowerCase();
  const mime = extension === 'svg' ? 'image/svg+xml' : extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
  markup = markup.split(`"${src}"`).join(`"data:${mime};base64,${buffer.toString('base64')}"`);
}
// Offline snapshot cannot download itself from a website-relative URL.
markup = markup.replace(/<a href="\/catalog\/mengkaile-catalog-2026.html" download="">.*?<\/a>/, '');
markup = markup.replace(/<button[^>]*data-catalog-download[^>]*>.*?<\/button>/, '');
const html = `<!doctype html><html lang="${catalogLocale[language]}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${catalogText('萌开了家居', language)} · 2026</title><style>${css}</style></head><body style="margin:0">${markup}<script>
document.querySelector('[data-catalog-print]').addEventListener('click', async function () {
  this.disabled = true; this.textContent = ${JSON.stringify(catalogText('正在准备图片…', language))};
  try {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => undefined)));
    window.print();
  } finally { this.disabled = false; this.textContent = ${JSON.stringify(catalogText('打印 / 保存 PDF', language))}; }
});
</script></body></html>`;
const directory = path.join(root, 'public/catalog');
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, `mengkaile-catalog-2026${language === 'cn' ? '' : '-' + language}.html`), html);
await writeFile(path.join(root, '.catalog-export/prices.json'), JSON.stringify({ profiles: PROFILE_VARIANTS, accessories: ACCESSORY_DEFINITIONS, boards: boardPricing }, null, 2));
console.log(`Catalog ${language} exported: ${imageSources.length} embedded images, ${Buffer.byteLength(html)} bytes.`);
}

}
main().catch(error => { console.error(error); process.exitCode = 1; });
