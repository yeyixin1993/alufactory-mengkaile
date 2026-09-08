import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync } from 'node:fs';
import PrintableCatalog, { CatalogPages } from '../components/PrintableCatalog';
import type { User } from '../types';
const user: User = { id: '13800000000', name: '测试账户', role: 'customer', addresses: [] };
const guest = renderToStaticMarkup(<CatalogPages />);
for (const membershipLevel of ['standard', 'vip']) assert.equal(renderToStaticMarkup(<CatalogPages user={{ ...user, membershipLevel }} />), guest);
assert(!guest.includes('VIP'));
assert(!guest.includes('彩色批量'));
assert(!guest.includes('彩色配件批量'));
assert(guest.includes('相框定价 · ¥50 / 米'));
assert(guest.includes('价格 ¥120'));
assert.equal((guest.match(/class="mkl-table mkl-consolidated-table"/g) || []).length, 2);
assert(!guest.includes('2012'));
assert.equal((guest.match(/class="mkl-page /g) || []).length, 17);
assert(!guest.includes('catalog-vip-plus'));
assert(!guest.includes('catalog-marine-vip'));
assert.equal((guest.match(/class="mkl-section-cell"/g) || []).length, 25);
for (const membershipLevel of ['vip_plus', 'VIP+']) {
  const vip = renderToStaticMarkup(<CatalogPages user={{ ...user, membershipLevel }} />);
  assert.equal((vip.match(/class="mkl-page /g) || []).length, 19);
  const appendix = vip.indexOf('<section class="mkl-page mkl-page-18 " id="catalog-vip-plus"');
  assert(appendix > 0);
  assert.equal(vip.slice(0, appendix), guest.slice(0, -6));
  assert(vip.slice(appendix).includes(`账号手机号：${user.id}`));
  assert(vip.slice(appendix).includes('彩色配件批量价'));
  assert(vip.includes('id="catalog-marine-vip"'));
  assert(vip.includes('VIP+ 会员价'));
  // 普通页不含任何「会员价」列；VIP+ 专属会员价只在第 19 页附录出现
  assert.equal((guest.match(/<th>会员价<\/th>/g) || []).length, 0);
  assert(vip.includes('mkl-marine-vip-table'));
}
const escaped = renderToStaticMarkup(<CatalogPages user={{...user, id: '<script>alert(1)</script>', membershipLevel: 'vip_plus'}} />);
assert(!escaped.includes('<script>'));
assert(escaped.includes('&lt;script&gt;'));
const publicHtml = readFileSync('public/catalog/mengkaile-catalog-2026.html', 'utf8');
assert(!publicHtml.includes('VIP+ 专'));
assert(!publicHtml.includes(user.id));
assert(!publicHtml.includes('data-catalog-download'));
if (process.env.CATALOG_QA_VIP) {
  const vip = renderToStaticMarkup(<CatalogPages user={{ ...user, membershipLevel: 'vip_plus' }} />);
  writeFileSync('/private/tmp/mengkaile-vip-test.html', `<!doctype html><html><head><meta charset="utf-8"><base href="file://${process.cwd()}/public/"><style>${readFileSync('components/PrintableCatalog.css','utf8')}</style></head><body><main class="mkl-catalog">${vip.replaceAll('src="/images/', 'src="images/')}</main></body></html>`);
}
console.log('Catalog checks passed: guest/standard/VIP identical; VIP+ appendix last, correct account phone, escaped text, 25 section cells, public snapshot clean.');

for (const language of ['en', 'jp'] as const) {
  const regular = renderToStaticMarkup(<CatalogPages language={language} />);
  const page = renderToStaticMarkup(<PrintableCatalog language={language} />);
  assert(page.includes(language === 'en' ? 'Print / Save PDF' : '印刷 / PDF保存'));
  assert(page.includes(language === 'en' ? 'Download offline HTML' : 'オフラインHTMLをダウンロード'));
  assert(page.includes(`class="mkl-pages" lang="${language === 'en' ? 'en' : 'ja'}"`));
  const snapshot = readFileSync(`public/catalog/mengkaile-catalog-2026-${language}.html`, 'utf8');
  assert(snapshot.includes(language === 'en' ? 'Print / Save PDF' : '印刷 / PDF保存'));
  assert(!snapshot.includes(user.id));
  assert.equal(renderToStaticMarkup(<CatalogPages language={language} user={{ ...user, membershipLevel: 'vip' }} />), regular);
  assert.equal((regular.match(/class="mkl-page /g) || []).length, 17);
  const member = renderToStaticMarkup(<CatalogPages language={language} user={{ ...user, membershipLevel: 'vip_plus' }} />);
  assert.equal((member.match(/class="mkl-page /g) || []).length, 19);
  const appendix = member.indexOf('<section class="mkl-page mkl-page-18 ');
  assert.equal(member.slice(0, appendix), regular.slice(0, -6));
  assert(member.includes(user.id));
  assert(!regular.includes(user.id));
  assert(regular.includes(language === 'en' ? 'Natural ends' : '切断面：素地'));
  assert(regular.includes(language === 'en' ? 'Frame pricing' : '額縁価格'));
  if (language === 'en') {
    const chinese = [...member.matchAll(/[^<>]*[\u3400-\u9fff][^<>]*/g)].map(m => m[0]);
    assert.deepEqual(chinese, [], `Untranslated English text: ${chinese.join('\n')}`);
  }
  writeFileSync(`/private/tmp/mkl-language-${language}.html`, `<!doctype html><html lang="${language === 'jp' ? 'ja' : 'en'}"><head><meta charset="utf-8"><base href="file://${process.cwd()}/public/"><style>${readFileSync('components/PrintableCatalog.css','utf8')}</style></head><body><main class="mkl-catalog" lang="${language === 'jp' ? 'ja' : 'en'}">${member.replaceAll('src="/images/', 'src="images/')}</main></body></html>`);
}
console.log('English/Japanese checks passed: translated text, 16/17 pages, equal public pages across membership levels, private phone only in VIP+ appendix.');
