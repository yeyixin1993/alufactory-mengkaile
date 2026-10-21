import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, ClipboardCheck, Copy, Info, Package } from 'lucide-react';
import type { CartItem, Language, Product } from '../types';
import { ProductType } from '../types';
import {
  findStorefrontItem,
  findStorefrontSection,
  storefrontPriceLabel,
  storefrontUnitLabel,
  STOREFRONT_SECTIONS,
  type StorefrontItem,
  type StorefrontSection,
} from '../data/storefrontSections';

const ACCENT: Record<StorefrontSection['accent'], { ring: string; chip: string; bar: string; glow: string }> = {
  emerald: { ring: 'border-emerald-200', chip: 'bg-emerald-600', bar: 'from-emerald-950 via-emerald-900 to-teal-900', glow: 'bg-emerald-400/20' },
  amber: { ring: 'border-amber-200', chip: 'bg-amber-600', bar: 'from-amber-950 via-amber-900 to-orange-900', glow: 'bg-amber-400/20' },
  blue: { ring: 'border-blue-200', chip: 'bg-blue-600', bar: 'from-slate-950 via-slate-900 to-blue-950', glow: 'bg-blue-400/20' },
};

export interface StorefrontSelection {
  [optionId: string]: string;
}

export const buildStorefrontProduct = (item: StorefrontItem): Product => ({
  id: item.id,
  type: ProductType.STOREFRONT_SKU,
  name: item.name,
  description: item.summary,
  basePrice: item.price ?? item.priceFrom ?? 0,
  imageUrl: item.imageUrl,
});

const defaultSelection = (item: StorefrontItem): StorefrontSelection => {
  const selection: StorefrontSelection = {};
  (item.options || []).forEach(option => {
    selection[option.id] = option.values[0]?.id;
  });
  return selection;
};

const resolveUnitPrice = (item: StorefrontItem, selection: StorefrontSelection) => {
  let price = Number(item.price ?? 0);
  (item.options || []).forEach(option => {
    const value = option.values.find(candidate => candidate.id === selection[option.id]);
    price += Number(value?.priceDelta || 0);
  });
  return Number(price.toFixed(2));
};

const selectionSummary = (item: StorefrontItem, selection: StorefrontSelection) =>
  (item.options || [])
    .map(option => {
      const value = option.values.find(candidate => candidate.id === selection[option.id]);
      return value ? value.label : null;
    })
    .filter(Boolean) as Array<Record<Language, string>>;

export const buildStorefrontCartItem = (
  item: StorefrontItem,
  selection: StorefrontSelection,
  quantity: number,
): CartItem => {
  const unitPrice = resolveUnitPrice(item, selection);
  const qty = Math.max(1, Math.round(quantity));
  const optionLabels = selectionSummary(item, selection);
  return {
    id: `${item.id}-${Object.values(selection).join('-') || 'default'}-${Date.now().toString(36)}`,
    product: buildStorefrontProduct(item),
    quantity: qty,
    totalPrice: Number((unitPrice * qty).toFixed(2)),
    config: {
      type: 'storefront_sku',
      sectionId: item.sectionId,
      itemId: item.id,
      optionIds: selection,
      optionLabels,
      unitPrice,
      priceSource: item.priceSource,
      needsReview: !!item.needsReview,
      specText: item.spec,
      shippingWeightKg: item.shippingWeightKg,
      // 让工厂单/购物车把数量读成「件数」，与配件口径一致
      totalQuantity: qty,
    } as any,
  };
};

const Media: React.FC<{ item: StorefrontItem; language: Language; tall?: boolean }> = ({ item, language, tall }) => {
  const height = tall ? 'h-56' : 'h-40';
  if (item.imageUrl) {
    const fitClass = item.imageFit === 'contain' ? 'object-contain bg-white' : 'object-cover';
    return (
      <div className={`${height} w-full overflow-hidden rounded-2xl bg-slate-100`}>
        <img src={item.imageUrl} alt={item.name[language]} loading="lazy" decoding="async" className={`h-full w-full ${fitClass}`} />
      </div>
    );
  }
  return (
    <div className={`${height} relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 via-white to-slate-100`}>
      <Package className="h-10 w-10 text-slate-300" />
      <span className="absolute bottom-2 right-3 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-black text-slate-400 shadow-sm">
        {language === 'cn' ? '产品图待补' : language === 'jp' ? '画像準備中' : 'Photo pending'}
      </span>
    </div>
  );
};

const PriceBlock: React.FC<{ item: StorefrontItem; language: Language }> = ({ item, language }) => (
  <div className="flex flex-wrap items-baseline gap-2">
    <span className="text-2xl font-black tracking-tight text-slate-900">{storefrontPriceLabel(item, language)}</span>
    <span className="text-xs font-bold text-slate-400">{storefrontUnitLabel(item, language)}</span>
    {item.purchase === 'quote' && (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black text-amber-700">
        {language === 'cn' ? '按配置报价' : language === 'jp' ? '構成見積' : 'Quoted'}
      </span>
    )}
    {item.needsReview && (
      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black text-blue-600">
        {language === 'cn' ? '价待确认' : language === 'jp' ? '価格確認中' : 'Price TBC'}
      </span>
    )}
  </div>
);

const QuotePanel: React.FC<{ item: StorefrontItem; selection: StorefrontSelection; language: Language }> = ({ item, selection, language }) => {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const lines = [
    `${item.name.cn}`,
    item.spec ? `规格：${item.spec.cn}` : '',
    ...selectionSummary(item, selection).map((label, index) => `${(item.options || [])[index]?.label.cn || '选项'}：${label.cn}`),
    item.priceFrom != null ? `参考价：¥${item.priceFrom}${item.priceTo != null ? `–${item.priceTo}` : ''}` : '',
    item.note ? `备注：${item.note.cn}` : '',
  ].filter(Boolean);
  const text = `【询价】\n${lines.join('\n')}\n数量：`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="inline-flex items-center gap-2 rounded-2xl bg-amber-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-amber-600/20 transition hover:bg-amber-500"
      >
        <Info className="h-4 w-4" />
        {open
          ? (language === 'cn' ? '收起询价单' : language === 'jp' ? '閉じる' : 'Hide request')
          : (language === 'cn' ? '按配置报价' : language === 'jp' ? '構成で見積' : 'Get a quote')}
        <ChevronRight className={`h-4 w-4 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="mb-2 text-xs font-black text-amber-800">
            {language === 'cn' ? '把下面这段发给客服，按配置报价' : language === 'jp' ? '以下を担当者へ送ってください' : 'Send this to our team for a quote'}
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-white/80 p-3 text-[11px] leading-relaxed text-slate-700">{text}</pre>
          <button
            type="button"
            onClick={copy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white hover:bg-amber-500"
          >
            {copied ? <ClipboardCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied
              ? (language === 'cn' ? '已复制' : language === 'jp' ? 'コピー済' : 'Copied')
              : (language === 'cn' ? '复制询价单' : language === 'jp' ? '見積内容をコピー' : 'Copy quote request')}
          </button>
        </div>
      )}
    </div>
  );
};

const PurchasePanel: React.FC<{
  item: StorefrontItem;
  language: Language;
  onAddToCart?: (item: CartItem) => void;
}> = ({ item, language, onAddToCart }) => {
  const [selection, setSelection] = useState<StorefrontSelection>(() => defaultSelection(item));
  const [quantity, setQuantity] = useState(1);

  const unitPrice = resolveUnitPrice(item, selection);
  const addToCart = () => {
    if (!onAddToCart) return;
    onAddToCart(buildStorefrontCartItem(item, selection, quantity));
  };

  return (
    <div>
      {(item.options || []).map(option => (
        <div key={option.id} className="mb-3">
          <div className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">{option.label[language]}</div>
          <div className="flex flex-wrap gap-2">
            {option.values.map(value => {
              const active = selection[option.id] === value.id;
              return (
                <button
                  key={value.id}
                  type="button"
                  onClick={() => setSelection(prev => ({ ...prev, [option.id]: value.id }))}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
                >
                  {value.label[language]}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {item.purchase === 'cart' ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white">
            <button type="button" className="px-3 py-2 text-sm font-black text-slate-500 hover:text-slate-900" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={event => setQuantity(Math.max(1, Math.round(Number(event.target.value) || 1)))}
              className="w-14 border-x border-slate-200 py-2 text-center text-sm font-black text-slate-900 outline-none"
            />
            <button type="button" className="px-3 py-2 text-sm font-black text-slate-500 hover:text-slate-900" onClick={() => setQuantity(q => q + 1)}>+</button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white shadow-lg shadow-slate-900/20 transition hover:bg-blue-600"
          >
            {language === 'cn' ? '加入购物车' : language === 'jp' ? 'カートに入れる' : 'Add to cart'}
            <span className="text-xs font-bold text-white/70">¥{(unitPrice * quantity).toFixed(2)}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <QuotePanel item={item} selection={selection} language={language} />
      )}
    </div>
  );
};

/** 首页三张板块入口卡 */
export const StorefrontSectionCards: React.FC<{ language: Language }> = ({ language }) => (
  <div className="mt-14">
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-400">
          {language === 'cn' ? '新增板块' : language === 'jp' ? '新セクション' : 'New sections'}
        </div>
        <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">
          {language === 'cn' ? '配件、成品与样品' : language === 'jp' ? '部品・完成品・サンプル' : 'Accessories, finished goods & samples'}
        </h2>
      </div>
      <div className="hidden text-xs font-bold text-slate-400 sm:block">
        {language === 'cn' ? '三块原来只在网店卖的东西，现在网站能直接下单' : language === 'jp' ? '店舗のみだった3カテゴリをサイトでも購入可能に' : 'Three categories that used to be shop-only, now orderable on the site'}
      </div>
    </div>
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {STOREFRONT_SECTIONS.map(section => {
        const accent = ACCENT[section.accent];
        const fromPrice = section.items
          .map(item => (item.purchase === 'cart' ? Number(item.price ?? 0) : Number(item.priceFrom ?? 0)))
          .filter(value => Number.isFinite(value) && value > 0);
        const minPrice = fromPrice.length ? Math.min(...fromPrice) : null;
        return (
          <Link
            key={section.id}
            to={`/section/${section.id}`}
            className="group relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-xl transition-all hover:-translate-y-1 hover:shadow-2xl"
          >
            {section.coverImage ? (
              <div className="h-36 overflow-hidden">
                <img src={section.coverImage} alt={section.title[language]} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
            ) : (
              <div className={`relative h-36 overflow-hidden bg-gradient-to-br ${accent.bar}`}>
                <div className={`absolute -right-10 -top-12 h-40 w-40 rounded-full ${accent.glow} blur-3xl`} />
                <div className="relative flex h-full items-center px-6 text-white">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/60">{section.eyebrow[language]}</div>
                    <div className="mt-1 text-xl font-black">{section.title[language]}</div>
                  </div>
                </div>
              </div>
            )}
            <div className="p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-black text-slate-900">{section.title[language]}</h3>
                <span className={`rounded-full ${accent.chip} px-2.5 py-0.5 text-[10px] font-black text-white`}>{section.items.length}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">{section.description[language]}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs font-black text-slate-400">
                  {minPrice != null ? `${language === 'cn' ? '低至' : language === 'jp' ? '最安' : 'from'} ¥${minPrice}` : (language === 'cn' ? '按配置报价' : language === 'jp' ? '見積' : 'Quoted')}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-black text-slate-900 group-hover:text-blue-600">
                  {language === 'cn' ? '查看全部' : language === 'jp' ? 'すべて見る' : 'View all'}
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  </div>
);

/** 板块详情页：/section/:sectionId */
export const StorefrontSectionPage: React.FC<{
  sectionId?: string;
  language: Language;
  onAddToCart: (item: CartItem) => void;
}> = ({ sectionId, language, onAddToCart }) => {
  const params = useParams<{ sectionId?: string }>();
  const resolvedId = sectionId || params.sectionId;
  const section = useMemo(() => findStorefrontSection(resolvedId), [resolvedId]);
  const [added, setAdded] = useState<string | null>(null);

  if (!section) {
    return <div className="p-24 text-center text-lg font-black text-slate-400">Section Not Found</div>;
  }
  const accent = ACCENT[section.accent];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-400 transition hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> {language === 'cn' ? '返回首页' : language === 'jp' ? 'ホームへ' : 'Home'}
      </Link>

      <div className={`mb-8 overflow-hidden rounded-[2rem] bg-gradient-to-br ${accent.bar} p-8 text-white`}>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-white/60">{section.eyebrow[language]}</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight">{section.title[language]}</h1>
        <p className="mt-3 max-w-3xl text-sm font-medium leading-relaxed text-white/80">{section.description[language]}</p>
        <div className="mt-4 text-xs font-bold text-white/60">
          {section.items.length} {language === 'cn' ? '款' : language === 'jp' ? '点' : 'items'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {section.items.map(item => (
          <div key={item.id} className={`flex flex-col rounded-[1.75rem] border ${accent.ring} bg-white p-5 shadow-lg shadow-slate-900/5`}>
            <Media item={item} language={language} tall />
            <h3 className="mt-4 text-base font-black leading-snug text-slate-900">{item.name[language]}</h3>
            {item.spec && <div className="mt-1 text-[11px] font-bold text-slate-400">{item.spec[language]}</div>}
            <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{item.summary[language]}</p>
            <div className="mt-3"><PriceBlock item={item} language={language} /></div>
            {item.note && (
              <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-slate-500">{item.note[language]}</div>
            )}
            <div className="mt-auto border-t border-slate-100 pt-4">
              <PurchasePanel
                item={item}
                language={language}
                onAddToCart={cart => {
                  onAddToCart(cart);
                  setAdded(item.id);
                  window.setTimeout(() => setAdded(current => (current === item.id ? null : current)), 2200);
                }}
              />
            </div>
            {added === item.id && (
              <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700">
                {language === 'cn' ? '已加入购物车' : language === 'jp' ? 'カートに追加しました' : 'Added to cart'}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl bg-slate-50 px-5 py-4 text-[11px] font-medium leading-relaxed text-slate-500">
        {language === 'cn'
          ? '固定价商品可直接下单；标「按配置报价」的按尺寸/配置核价，点开后复制询价内容发给客服。标「价待确认」的沿用网店现售价，官网定价确认后会统一。'
          : language === 'jp'
            ? '固定価格は直接注文できます。「構成見積」は寸法・構成で見積、「価格確認中」は店舗価格を暫用しています。'
            : 'Fixed-price items can be ordered directly; “Quoted” items are priced per size/configuration. “Price TBC” reuses the current shop price until the site price is confirmed.'}
      </div>
    </div>
  );
};

/** 购物车里点「编辑」时用的编辑器 */
export const StorefrontSkuEditor: React.FC<{
  language: Language;
  itemId: string | undefined;
  initialItem?: CartItem;
  onSave: (item: CartItem) => void;
}> = ({ language, itemId, initialItem, onSave }) => {
  const item = findStorefrontItem(itemId);
  if (!item) return <div className="p-20 text-center font-bold text-slate-400">Item Not Found</div>;
  const initialConfig = (initialItem?.config || {}) as any;
  const presetSelection: StorefrontSelection = { ...defaultSelection(item), ...(initialConfig.optionIds || {}) };
  const presetQty = Math.max(1, Number(initialItem?.quantity || 1));

  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-2xl">
      <div className="mb-6 flex items-start gap-4">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
          {item.imageUrl
            ? <img src={item.imageUrl} alt={item.name[language]} className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center"><Package className="h-8 w-8 text-slate-300" /></div>}
        </div>
        <div>
          <h2 className="text-xl font-black text-slate-900">{item.name[language]}</h2>
          <p className="mt-1 text-xs font-medium text-slate-500">{item.summary[language]}</p>
          <div className="mt-2"><PriceBlock item={item} language={language} /></div>
        </div>
      </div>
      <PurchasePanelWithPreset item={item} language={language} presetSelection={presetSelection} presetQty={presetQty} onSave={onSave} />
    </div>
  );
};

const PurchasePanelWithPreset: React.FC<{
  item: StorefrontItem;
  language: Language;
  presetSelection: StorefrontSelection;
  presetQty: number;
  onSave: (item: CartItem) => void;
}> = ({ item, language, presetSelection, presetQty, onSave }) => {
  const [selection, setSelection] = useState<StorefrontSelection>(presetSelection);
  const [quantity, setQuantity] = useState(presetQty);
  const unitPrice = resolveUnitPrice(item, selection);

  if (item.purchase === 'quote') {
    return <QuotePanel item={item} selection={selection} language={language} />;
  }

  return (
    <div>
      {(item.options || []).map(option => (
        <div key={option.id} className="mb-3">
          <div className="mb-1.5 text-[11px] font-black uppercase tracking-widest text-slate-400">{option.label[language]}</div>
          <div className="flex flex-wrap gap-2">
            {option.values.map(value => {
              const active = selection[option.id] === value.id;
              return (
                <button
                  key={value.id}
                  type="button"
                  onClick={() => setSelection(prev => ({ ...prev, [option.id]: value.id }))}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
                >
                  {value.label[language]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl border border-slate-200 bg-white">
          <button type="button" className="px-3 py-2 text-sm font-black text-slate-500 hover:text-slate-900" onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={event => setQuantity(Math.max(1, Math.round(Number(event.target.value) || 1)))}
            className="w-14 border-x border-slate-200 py-2 text-center text-sm font-black outline-none"
          />
          <button type="button" className="px-3 py-2 text-sm font-black text-slate-500 hover:text-slate-900" onClick={() => setQuantity(q => q + 1)}>+</button>
        </div>
        <button
          type="button"
          onClick={() => onSave(buildStorefrontCartItem(item, selection, quantity))}
          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-blue-600"
        >
          {language === 'cn' ? '保存修改' : language === 'jp' ? '変更を保存' : 'Save changes'}
          <span className="text-xs font-bold text-white/70">¥{(unitPrice * quantity).toFixed(2)}</span>
        </button>
      </div>
    </div>
  );
};
