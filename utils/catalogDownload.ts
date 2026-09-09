import type { Language } from '../types';
import { catalogLocale, catalogText } from './catalogLocalization';
/** Snapshot only the currently rendered catalog; never read other account fields. */
export async function downloadCatalogHtml(css: string, language: Language = 'cn') {
  const source = document.querySelector('.mkl-pages');
  if (!source) throw new Error('Catalog not mounted');
  const originalMarkup = source.innerHTML;
  const pages = source.cloneNode(true) as HTMLElement;
  const images = Array.from(pages.querySelectorAll('img'));
  const embedded = new Map<string, Promise<string>>();
  await Promise.all(images.map(async img => {
    const src = img.src;
    if (!embedded.has(src)) embedded.set(src, (async () => {
      const response = await fetch(src);
      if (!response.ok) throw new Error('Image unavailable');
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    })());
    img.src = await embedded.get(src)!;
  }));
  // If the account changed while images loaded, discard its obsolete personalized snapshot.
  if (source !== document.querySelector('.mkl-pages') || source.innerHTML !== originalMarkup) throw new Error('Catalog changed');
  const html = `<!doctype html><html lang="${catalogLocale[language]}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${catalogText('萌开了家居', language)} · ${catalogText('产品与价格画册 ·', language)}</title><style>${css}</style></head><body style="margin:0"><main class="mkl-catalog" lang="${catalogLocale[language]}"><div class="mkl-toolbar"><b>${catalogText('萌开了家居', language)} · ${catalogText('产品与价格画册 ·', language)}</b><button onclick="window.print()">${catalogText('打印 / 保存 PDF', language)}</button></div>${pages.outerHTML}</main></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = pages.querySelector('#catalog-vip-plus') ? `Mengkaile-2026-${language}-VIP+.html` : `Mengkaile-2026-${language}.html`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
