import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronRight, Image as ImageIcon } from 'lucide-react';
import type { Language } from '../types';
import { PROFILE_VARIANTS } from '../constants';
import { A_PILLAR_MILLING_SPECS, getAPillarMillingSpecs } from '../data/aPillarMilling';

const COPY = {
  cn: {
    eyebrow: 'A-PILLAR MILLING',
    title: '铝型材铣型 A 柱一体化定制',
    intro: '选好型材，直接定制 A 柱开槽。三种铣型规格，按实际长度计价，本色与彩色截面彩色可选。',
    fee: '额外铣型加工费',
    perMeter: '/ 米',
    photo: '产品图片待上传',
    models: '适用型材',
    quote: '选择此规格报价',
    formula: '（型材每米单价 + A 柱铣型每米单价）× 长度（米）× 数量',
    note: '以上为每米额外开槽加工费，不含型材材料费；来料加工或单独核算铣型成本，可按加工单价 × 总长度（米）参考。',
    finish: '可选本色、彩色截面彩色；暂不支持彩色截面本色。',
    example: '2040 普通报价示例 · 每米，含型材与 A 柱铣型',
    natural: '本色',
    colored: '彩色截面彩色',
  },
  en: {
    eyebrow: 'A-PILLAR MILLING',
    title: 'Custom A-pillar milling, integrated into your profile',
    intro: 'Choose a profile and add A-pillar slots in three milling styles. Priced by length, in natural aluminum or color with colored cut ends.',
    fee: 'Additional milling fee',
    perMeter: '/ m',
    photo: 'Product photo coming soon',
    models: 'Compatible profiles',
    quote: 'Quote this option',
    formula: '(Profile price per metre + A-pillar milling price per metre) × length (m) × quantity',
    note: 'These are additional milling charges per metre, excluding profile material. For customer-supplied material or milling costs alone, use the milling rate × total length in metres.',
    finish: 'Natural aluminum or color with colored cut ends. Color with natural cut ends is currently unavailable.',
    example: '2040 standard pricing · per metre, profile and A-pillar milling included',
    natural: 'Natural',
    colored: 'Color / colored cut ends',
  },
  jp: {
    eyebrow: 'A-PILLAR MILLING',
    title: 'アルミプロファイル・A柱一体型カスタム加工',
    intro: 'プロファイルを選んでA柱の溝加工を追加。3種類の加工仕様を長さに応じて見積もり、本色とカラー（断面同色）から選べます。',
    fee: '追加のフライス加工料金',
    perMeter: '/ m',
    photo: '製品写真準備中',
    models: '対応プロファイル',
    quote: 'この仕様で見積もる',
    formula: '（プロファイル単価 / m + A柱加工単価 / m）× 長さ（m）× 数量',
    note: '表示額は1m当たりの追加加工費で、材料費は含みません。材料持ち込みや加工費のみの目安は、加工単価 × 合計長さ（m）で計算できます。',
    finish: '本色またはカラー（断面同色）に対応。カラーの断面本色は現在選択できません。',
    example: '2040 通常価格例 · 1m当たり、材料費とA柱加工費込み',
    natural: '本色',
    colored: 'カラー・断面同色',
  },
} satisfies Record<Language, Record<string, string>>;

export default function APillarMillingSection({ language }: { language: Language }) {
  const text = COPY[language];
  const exampleProfile = PROFILE_VARIANTS.find(profile => profile.id === '2040')!;
  // Keep the public fee in RMB in every language; these are the owner's RMB rates.
  const money = (value: number) => `${language === 'cn' ? '¥' : 'RMB '}${value}`;

  return (
    <section id="a-pillar-milling" aria-labelledby="a-pillar-milling-title" className="mt-12 scroll-mt-28 rounded-[2rem] border border-blue-100 bg-blue-50/50 p-5 sm:p-8">
      <div className="max-w-3xl">
        <p className="text-[10px] font-black tracking-[0.24em] text-blue-600">{text.eyebrow}</p>
        <h2 id="a-pillar-milling-title" className="mt-2 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">{text.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{text.intro}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {A_PILLAR_MILLING_SPECS.map((spec, index) => {
          const models = PROFILE_VARIANTS.filter(profile => getAPillarMillingSpecs(profile.id).some(option => option.id === spec.id));
          const quoteModel = models[0].id;
          return (
            <article key={spec.id} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="m-3 mb-0 flex h-40 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400">
                {spec.imageUrl ? (
                  <img src={spec.imageUrl} alt={`${spec.name[language]} A柱`} loading="lazy" decoding="async" className="h-full w-full object-contain" />
                ) : (
                  <>
                    <ImageIcon className="h-8 w-8 text-slate-300" aria-hidden="true" />
                    <span className="text-xs">{text.photo}</span>
                  </>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold text-blue-500">0{index + 1}</span>
                  <h3 className="text-lg font-black text-slate-900">{spec.name[language]}</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">{spec.dimensions[language]}</p>
                <p className="mt-5 text-xs font-bold text-slate-500">{text.fee}</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-blue-700">
                  +{money(spec.feePerMeter)} <span className="text-sm font-semibold text-slate-500">{text.perMeter}</span>
                </p>
                <div className="mb-5 mt-5">
                  <p className="mb-2 text-xs font-bold text-slate-500">{text.models}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {models.map(profile => <span key={profile.id} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{profile.id}</span>)}
                  </div>
                </div>
                <Link to={`/quick-quote?profile=${quoteModel}&aPillarMilling=${spec.id}`} className="mt-auto inline-flex items-center justify-between gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-600">
                  {text.quote}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-blue-100 bg-white px-5 py-4">
        <p className="text-sm font-bold leading-relaxed text-blue-900">{text.formula}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{text.note}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{text.finish}</p>
      </div>
      <div className="mt-5 text-xs leading-relaxed text-slate-600">
        <p className="font-bold text-slate-700">{text.example}</p>
        <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-6">
          {getAPillarMillingSpecs('2040').map(spec => (
            <p key={spec.id}>
              {spec.name[language]} · {text.natural} {money(exampleProfile.price.oxidized + spec.feePerMeter)} / {text.colored} {money(exampleProfile.price.powder + spec.feePerMeter)}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function APillarMillingCard({ language }: { language: Language }) {
  const text = COPY[language];
  return <div className="flex flex-col bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-100 hover:shadow-2xl transition-all duration-300 group">
    <div className="h-64 shrink-0 overflow-hidden relative flex flex-col items-center justify-center gap-3 bg-slate-100 text-slate-400">
      <ImageIcon className="h-12 w-12 text-slate-300" aria-hidden="true" />
      <span className="text-sm">{text.photo}</span>
      <div className="absolute top-6 left-6 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-800 shadow-xl">A-PILLAR MILLING</div>
    </div>
    <div className="p-8 flex flex-1 flex-col">
      <h3 className="text-2xl font-black text-slate-900 mb-3">{text.title}</h3>
      <p className="text-slate-500 text-sm mb-10 line-clamp-2 leading-relaxed">{text.intro}</p>
      <Link to="/section/a-pillar-milling" className="mt-auto w-full bg-slate-900 text-white py-5 rounded-3xl font-black flex items-center justify-center gap-3 hover:bg-blue-600 transition-all shadow-xl shadow-slate-900/20 group-hover:-translate-y-1">
        {language === 'cn' ? '进入选购' : language === 'jp' ? '商品を選ぶ' : 'Shop now'} <ChevronRight className="w-5 h-5" />
      </Link>
    </div>
  </div>;
}

export function APillarMillingPage({ language }: { language: Language }) {
  React.useEffect(() => { window.scrollTo(0, 0); }, []);
  return <div className="mx-auto max-w-7xl px-6 py-10">
    <Link to="/" className="inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-slate-900">
      <ArrowLeft className="h-4 w-4" /> {language === 'cn' ? '返回首页' : language === 'jp' ? 'ホームへ' : 'Back to home'}
    </Link>
    <APillarMillingSection language={language} />
  </div>;
}
