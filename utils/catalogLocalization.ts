import React from 'react';
import type { Language } from '../types';
import translations from '../data/catalogTranslations.json';
import { INITIAL_PRODUCTS, PROFILE_VARIANTS } from '../constants';
import { ACCESSORY_DEFINITIONS } from '../data/accessoryCatalog';

export const catalogLocale = { cn: 'zh-CN', en: 'en', jp: 'ja' } as const;
const copy: Record<string, { en: string; jp: string }> = { ...translations };
const cleanAccessory = (s: string) => s.replace(' only', '（不含螺丝）').replace('10号螺丝 · ', '').replace('10号配件 · ', '');
for (const item of INITIAL_PRODUCTS) copy[item.name.cn] ??= { en: item.name.en, jp: item.name.jp };
for (const item of ACCESSORY_DEFINITIONS) {
  copy[cleanAccessory(item.name.cn)] = {
    en: item.name.en.replace('No.10 Screw · ', '').replace('No.10 · ', '').replace('Aluminum Profile ', '').replace('Corner Bracket', 'Bracket').replace('(Only)', '(no screws)'),
    jp: item.name.jp.replace('10番ねじ · ', '').replace('10番部品 · ', '').replace('コーナーブラケット', '金具'),
  };
  if (item.note) copy[item.note] = {
    en: item.note.replace('：搭配', ': for No.').replace('号配件', '').replace('：T型螺母', ': T-nut'),
    jp: item.note.replace('：搭配', '：').replace('号配件', '番用').replace('：T型螺母', '：Tナット'),
  };
}
for (const item of PROFILE_VARIANTS) {
  copy[item.name] = { en: item.name.replace('方形', 'square').replace('圆形', 'round').replace('对边', 'opposite'), jp: item.name.replace('方形', '角型').replace('圆形', '丸型').replace('对边', '対向') };
  copy[`${item.name}截面图`] = { en: `${copy[item.name].en} section`, jp: `${copy[item.name].jp}断面図` };
}

export function catalogText(text: string, language: Language): string {
  if (language === 'cn') return text;
  const key = text.trim();
  const value = copy[key]?.[language];
  if (value === undefined) return text;
  return text.slice(0, text.indexOf(key)) + value + text.slice(text.indexOf(key) + key.length);
}

/** Localize the catalog's pure presentation tree before React renders or SSR exports it.
 * Catalog children are stateless presentation functions; no DOM mutation or HTML injection.
 * Numbers, URLs, phone numbers and event handlers are preserved.
 */
export function localizeCatalog(node: React.ReactNode, language: Language): React.ReactNode {
  if (language === 'cn') return node;
  if (typeof node === 'string') return catalogText(node, language);
  if (Array.isArray(node)) return React.Children.toArray(node).map(child => localizeCatalog(child, language));
  if (!React.isValidElement(node)) return node;
  const element = node as React.ReactElement<Record<string, any>>;
  if (typeof element.type === 'function') {
    const render = element.type as (props: Record<string, any>) => React.ReactNode;
    const rendered = localizeCatalog(render(element.props), language);
    return React.isValidElement(rendered) ? React.cloneElement(rendered, { key: element.key }) : rendered;
  }
  const props = { ...element.props };
  if (props.lang) props.lang = catalogLocale[language];
  for (const attribute of ['alt', 'title', 'aria-label']) if (typeof props[attribute] === 'string') props[attribute] = catalogText(props[attribute], language);
  if ('children' in props) props.children = localizeCatalog(props.children, language);
  return React.cloneElement(element, props);
}
