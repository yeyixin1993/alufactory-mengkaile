import {
  ACCESSORY_CODE_IMAGE_MAP,
  ACCESSORY_IMAGE,
  CUSTOMER_ACCESSORY_ROWS,
  ACCESSORY_UNIVERSAL_SERIES,
  buildAccessoryRowKey,
  getAccessoryRowSeriesLabel,
  migrateLegacyAccessoryQuantities,
  type AccessoryColorMode,
  type AccessoryRow,
  type AccessoryRowSeries,
} from '../data/accessoryCatalog';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Language, CartItem, Product, User } from '../types';
import { PROFILE_COLORS, getProfileColorPhotoSrc } from '../constants';
import { ACCESSORY_BULK_THRESHOLD } from '../utils/accessoryPricing';
import {
  normalizeAccessoryColorMode,
  resolveAccessoryUnitPrice,
  setAccessoryQuantity,
  summarizeAccessoryQuote,
} from '../utils/accessoryQuote';
import { normalizeMembershipLevel } from '../utils/membership';
import { ApiService } from '../services/apiService';
import { SHOW_STOREFRONT_INVENTORY } from '../utils/storefrontFeatures';

interface AccessoryConfig {
  type: 'profile_accessory';
  /** Description only: the profile series covered by the selection. */
  profileSize: string;
  colorMode: AccessoryColorMode;
  colorId?: string;
  colorName?: string;
  quantities: Record<string, number>;
  totalQuantity: number;
  shaftLengthMm?: number;
  lines: Array<{
    id: string;
    code: number;
    name: string;
    series: string;
    imageKey?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    isBulk: boolean;
  }>;
  unitTotal: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Language-neutral series description stored on the cart configuration. */
const buildConfigSeriesLabel = (rows: AccessoryRow[]) => {
  const tokens = Array.from(new Set(rows.map((row) => (
    row.series === ACCESSORY_UNIVERSAL_SERIES ? '通用' : row.series
  ))));
  return tokens.length ? tokens.join(' / ') : '-';
};

const normalizeSearch = (value: string) => value.trim().toLowerCase();

const AccessoryQuoteEditor: React.FC<{
  language: Language;
  product: Product;
  user: User | null;
  initialItem?: CartItem;
  returnCartPath: string;
  onAddToCart: (item: CartItem) => void;
  onUpdateItem: (item: CartItem) => void;
}> = ({ language, product, user, initialItem, returnCartPath, onAddToCart, onUpdateItem }) => {
  const navigate = useNavigate();
  const isVipPlus = Boolean(user) && normalizeMembershipLevel(user?.membershipLevel) === 'vip_plus';

  const seeded = (initialItem?.config || {}) as Partial<AccessoryConfig>;

  const [colorMode, setColorMode] = useState<AccessoryColorMode>(
    normalizeAccessoryColorMode(seeded.colorMode),
  );
  const [colorId, setColorId] = useState<string>(seeded.colorId || 'black');
  const [qtyMap, setQtyMap] = useState<Record<string, number>>(() => (
    migrateLegacyAccessoryQuantities(seeded.quantities, seeded.profileSize)
  ));
  const [shaftLengthMm, setShaftLengthMm] = useState(seeded.shaftLengthMm || 500);
  const [search, setSearch] = useState('');
  const [imgError, setImgError] = useState(false);
  const [colorImgError, setColorImgError] = useState(false);
  const colorPhotoSrc = getProfileColorPhotoSrc(colorId);
  const [zoomPreview, setZoomPreview] = useState<{ src: string; alt: string } | null>(null);
  const [inventoryByRowKey, setInventoryByRowKey] = useState<Record<string, number>>({});
  const [inventoryLoaded, setInventoryLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!SHOW_STOREFRONT_INVENTORY || colorMode !== 'natural') {
      setInventoryByRowKey({});
      setInventoryLoaded(false);
      return () => { active = false; };
    }
    setInventoryLoaded(false);
    ApiService.getAccessoryInventory()
      .then((rows) => {
        if (!active) return;
        const next: Record<string, number> = {};
        rows.forEach((row) => {
          next[buildAccessoryRowKey(row.accessoryId, row.profileSize as AccessoryRowSeries)] = row.quantity;
        });
        setInventoryByRowKey(next);
        setInventoryLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setInventoryByRowKey({});
        setInventoryLoaded(false);
      });
    return () => { active = false; };
  }, [colorMode]);

  const ui = useMemo(() => {
    if (language === 'cn') {
      return {
        title: '配件选购',
        hint: '所有配件平铺列出，每种规格独立一行；「适配型号」直接写在配件说明里，无需先选型材规格。',
        fitModel: '适配型号',
        colorMode: '颜色',
        natural: '本色',
        colored: '彩色',
        naturalHint: '本色（默认）',
        color: '彩色选择',
        imageTitle: '铝型材角码识别图',
        noImage: '请将配件图放到 images/accessory/accessory_codes.jpg',
        noColorImage: '缺少对应色卡图',
        search: '搜索配件（编号 / 名称 / 型号）',
        empty: '没有匹配的配件',
        code: '编号',
        item: '配件',
        image: '示意图',
        unit: '单价',
        bulk: `批量单价(≥${ACCESSORY_BULK_THRESHOLD})`,
        qty: '数量',
        subtotal: '小计',
        stock: '库存',
        pieces: '件',
        total: '总计',
        totalQty: '总数量',
        selectedSeries: '已选适配型号',
        freeShippingNotice: isVipPlus ? '🔥 VIP+ 配件不限金额包邮' : '🔥 满30包邮',
        batchRule: `同一行一次买 ${ACCESSORY_BULK_THRESHOLD} 个及以上，自动使用批量单价。`,
        add: '加入购物车',
        update: '更新购物车',
        pickFirst: '请先选择数量',
        clear: '清空数量',
      };
    }
    if (language === 'jp') {
      return {
        title: '部品の選択',
        hint: '全ての部品を一覧表示し、規格ごとに1行ずつ並べています。「対応型番」は部品説明に記載されているため、先に規格を選ぶ必要はありません。',
        fitModel: '対応型番',
        colorMode: 'カラー',
        natural: '本色',
        colored: 'カラー',
        naturalHint: '本色（既定）',
        color: 'カラー選択',
        imageTitle: 'アクセサリー識別図',
        noImage: 'images/accessory/accessory_codes.jpg を追加してください',
        noColorImage: 'カラースウォッチ画像なし',
        search: '部品を検索（番号 / 名称 / 型番）',
        empty: '該当する部品がありません',
        code: '番号',
        item: '部品',
        image: '画像',
        unit: '単価',
        bulk: `大量単価(${ACCESSORY_BULK_THRESHOLD}個以上)`,
        qty: '数量',
        subtotal: '小計',
        stock: '在庫',
        pieces: '個',
        total: '合計',
        totalQty: '総数量',
        selectedSeries: '選択中の対応型番',
        freeShippingNotice: isVipPlus ? '🔥 VIP+ 部品は金額に関わらず送料無料' : '🔥 30元以上で送料無料',
        batchRule: `同一行を${ACCESSORY_BULK_THRESHOLD}個以上購入時、自動で大量単価になります。`,
        add: 'カートに追加',
        update: 'カートを更新',
        pickFirst: '数量を入力してください',
        clear: '数量をクリア',
      };
    }
    return {
      title: 'Accessory selection',
      hint: 'Every accessory is listed flat, one row per compatible profile series. The series is part of the row description, so nothing has to be pre-selected.',
      fitModel: 'Profile series',
      colorMode: 'Color',
      natural: 'Natural',
      colored: 'Colored',
      naturalHint: 'Natural (default)',
      color: 'Colored finish',
      imageTitle: 'Accessory Reference',
      noImage: 'Please place image at images/accessory/accessory_codes.jpg',
      noColorImage: 'Missing color image',
      search: 'Search accessories (no. / name / series)',
      empty: 'No accessory matches this search',
      code: 'No.',
      item: 'Item',
      image: 'Image',
      unit: 'Unit',
      bulk: `Bulk unit (>=${ACCESSORY_BULK_THRESHOLD})`,
      qty: 'Qty',
      subtotal: 'Subtotal',
      stock: 'Stock',
      pieces: 'pcs',
      total: 'Total',
      totalQty: 'Total Qty',
      selectedSeries: 'Selected series',
      freeShippingNotice: isVipPlus ? '🔥 VIP+ accessories ship free at any order amount' : '🔥 Free shipping for orders over ¥30',
      batchRule: `For the same row, qty >=${ACCESSORY_BULK_THRESHOLD} uses bulk unit price.`,
      add: 'Add to Cart',
      update: 'Update Cart',
      pickFirst: 'Please enter quantity first',
      clear: 'Clear quantities',
    };
  }, [isVipPlus, language]);

  const filteredRows = useMemo(() => {
    const needle = normalizeSearch(search);
    if (!needle) return CUSTOMER_ACCESSORY_ROWS;
    return CUSTOMER_ACCESSORY_ROWS.filter((row) => {
      const haystack = [
        String(row.code),
        row.codeLabel?.[language] || '',
        row.name[language],
        getAccessoryRowSeriesLabel(row, language),
        row.series,
        row.note || '',
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });
  }, [language, search]);

  const summary = useMemo(
    () => summarizeAccessoryQuote(qtyMap, colorMode, language, shaftLengthMm),
    [colorMode, language, qtyMap, shaftLengthMm],
  );

  const submit = () => {
    if (summary.totalQuantity <= 0) {
      alert(ui.pickFirst);
      return;
    }

    const config: AccessoryConfig = {
      type: 'profile_accessory',
      shaftLengthMm,
      profileSize: buildConfigSeriesLabel(summary.lines.map((line) => line.row)),
      colorMode,
      colorId: colorMode === 'colored' ? colorId : undefined,
      colorName:
        colorMode === 'colored'
          ? (PROFILE_COLORS.find((c) => c.id === colorId)?.name?.[language] || colorId)
          : undefined,
      quantities: qtyMap,
      totalQuantity: summary.totalQuantity,
      lines: summary.lines.map(({ row, quantity, unitPrice, subtotal, isBulk }) => ({
        id: row.key,
        code: row.code,
        name: [
          row.name[language],
          `${ui.fitModel} ${getAccessoryRowSeriesLabel(row, language)}`,
          row.lengthPriced ? `${shaftLengthMm}mm` : '',
          row.naturalOnly ? (language === 'cn' ? '原色' : 'Natural') : '',
        ].filter(Boolean).join(' · '),
        series: getAccessoryRowSeriesLabel(row, language),
        imageKey: row.imageKey || row.defId,
        quantity,
        unitPrice,
        subtotal,
        isBulk,
      })),
      unitTotal: summary.total,
    };

    const nextItem: CartItem = {
      id: initialItem?.id || Date.now().toString(),
      product,
      quantity: 1,
      config,
      totalPrice: summary.total,
    };

    if (initialItem) {
      onUpdateItem(nextItem);
      navigate(returnCartPath);
      return;
    }

    onAddToCart(nextItem);
  };

  const selectedSeriesText = summary.seriesLabel;
  const selectedRows = new Set(summary.lines.map((line) => line.key));

  return (
    <>
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center">
            {!imgError ? (
              <img
                src={ACCESSORY_IMAGE}
                alt={ui.imageTitle}
                className="w-full max-h-[460px] object-contain rounded-xl"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="text-slate-500 text-sm text-center font-bold py-20">{ui.noImage}</div>
            )}
            <div className="mt-2 text-xs text-slate-500 font-bold">{ui.imageTitle}</div>
          </div>

          {colorMode === 'colored' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center">
              {colorPhotoSrc && !colorImgError ? (
                <img
                  src={colorPhotoSrc}
                  alt={colorId}
                  className="w-full max-h-[460px] object-contain rounded-xl"
                  loading="lazy"
                  decoding="async"
                  onError={() => setColorImgError(true)}
                />
              ) : (
                <div className="text-slate-500 text-sm text-center font-bold py-20">{ui.noColorImage}</div>
              )}
              <div className="mt-2 text-xs text-slate-500 font-bold">
                {PROFILE_COLORS.find((c) => c.id === colorId)?.name?.[language] || colorId}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-5">
        <div>
          <h3 className="text-xl font-black text-slate-900">{ui.title}</h3>
          <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">{ui.hint}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-xs font-black text-slate-500 mb-2">{ui.colorMode}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setColorMode('natural')}
                className={`px-3 py-2.5 rounded-xl border text-sm font-black ${
                  colorMode === 'natural' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {ui.natural}
              </button>
              <button
                type="button"
                onClick={() => setColorMode('colored')}
                className={`px-3 py-2.5 rounded-xl border text-sm font-black ${
                  colorMode === 'colored' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {ui.colored}
              </button>
            </div>
            <div className="mt-1 text-[11px] font-bold text-slate-400">{ui.naturalHint}</div>
          </div>

          {colorMode === 'colored' && (
            <div>
              <label className="block text-xs font-black text-slate-500 mb-2">{ui.color}</label>
              <select
                value={colorId}
                onChange={(e) => {
                  setColorId(e.target.value);
                  setColorImgError(false);
                }}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white font-bold"
              >
                {PROFILE_COLORS.filter((c) => c.id !== 'natural').map((c) => (
                  <option key={c.id} value={c.id}>{c.name[language]}</option>
                ))}
              </select>
            </div>
          )}

          <div className={colorMode === 'colored' ? '' : 'md:col-span-2'}>
            <label className="block text-xs font-black text-slate-500 mb-2">{ui.search}</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={ui.search}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white font-bold"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-slate-700">
            {ui.selectedSeries}: <span className="text-slate-900">{selectedSeriesText}</span>
          </div>
          <button
            type="button"
            onClick={() => setQtyMap({})}
            disabled={!summary.totalQuantity}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-black text-slate-600 disabled:opacity-40"
          >
            {ui.clear}
          </button>
        </div>

        <div className="text-center text-base md:text-lg font-black text-rose-700 bg-rose-50 border-2 border-rose-300 rounded-xl px-4 py-2">
          {ui.freeShippingNotice}
        </div>

        <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{ui.batchRule}</p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="p-2 border border-slate-200">{ui.code}</th>
                <th className="p-2 border border-slate-200">{ui.item}</th>
                <th className="p-2 border border-slate-200">{ui.fitModel}</th>
                <th className="p-2 border border-slate-200">{ui.image}</th>
                <th className="p-2 border border-slate-200">{ui.unit}</th>
                <th className="p-2 border border-slate-200">{ui.bulk}</th>
                {SHOW_STOREFRONT_INVENTORY && <th className="p-2 border border-slate-200">{ui.stock}</th>}
                <th className="p-2 border border-slate-200">{ui.qty}</th>
                <th className="p-2 border border-slate-200">{ui.subtotal}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={SHOW_STOREFRONT_INVENTORY ? 9 : 8} className="p-6 text-center text-slate-500 font-bold">
                    {ui.empty}
                  </td>
                </tr>
              )}
              {filteredRows.map((row, rowIndex) => {
                const qty = Math.max(0, Number(qtyMap[row.key] ?? 0));
                const unitPrice = resolveAccessoryUnitPrice(row, colorMode, qty, shaftLengthMm);
                const isBulk = !row.naturalOnly && qty >= ACCESSORY_BULK_THRESHOLD;
                const subtotal = round1(unitPrice * qty);
                const previousRow = filteredRows[rowIndex - 1];
                const startsGroup = !previousRow || previousRow.defId !== row.defId;
                const catalogUnit = row.naturalOnly || colorMode === 'natural' ? row.price.natural : row.price.colored;
                const catalogBulk = row.naturalOnly || colorMode === 'natural' ? row.price.naturalBulk : row.price.coloredBulk;
                const stock = inventoryByRowKey[row.key] || 0;
                return (
                  <tr
                    key={row.key}
                    className={`odd:bg-white even:bg-slate-50/60 ${startsGroup && rowIndex > 0 ? 'border-t-2 border-slate-200' : ''}`}
                  >
                    <td className="p-2 border border-slate-100 font-black whitespace-nowrap">{row.codeLabel?.[language] || `${row.code}号`}</td>
                    <td className="p-2 border border-slate-100">
                      <div className={`font-semibold ${startsGroup ? 'text-slate-900' : 'text-slate-600'}`}>{row.name[language]}</div>
                      {row.lengthPriced && (
                        <label className="mt-2 flex items-center gap-2 text-xs">
                          {language === 'cn' ? '长度' : language === 'jp' ? '長さ' : 'Length'}
                          <input aria-label="8mm shaft length (mm)" type="number" min={1} max={3000} step={1} value={shaftLengthMm} onChange={e => setShaftLengthMm(Math.max(1, Math.min(3000, Math.round(Number(e.target.value) || 1))))} className="w-20 rounded border border-slate-200 px-2 py-1" /> mm
                        </label>
                      )}
                      {row.naturalOnly && <div className="text-[11px] text-slate-500">{language === 'cn' ? '原色 · 不按型材系列区分' : language === 'jp' ? '原色・シリーズ共通' : 'Natural · all series'}</div>}
                      {row.note && <div className="text-[11px] text-slate-500">{row.note}</div>}
                    </td>
                    <td className="p-2 border border-slate-100">
                      <span className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-black ${startsGroup ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {getAccessoryRowSeriesLabel(row, language)}
                      </span>
                    </td>
                    <td className="p-2 border border-slate-100">
                      <div
                        className="w-16 h-12 rounded-lg border border-slate-200 bg-white overflow-hidden relative cursor-zoom-in"
                        onClick={() => {
                          const src = ACCESSORY_CODE_IMAGE_MAP[row.imageKey || row.defId] || ACCESSORY_CODE_IMAGE_MAP[String(row.code)] || '';
                          if (src) setZoomPreview({ src, alt: row.name[language] });
                        }}
                      >
                        <img
                          src={ACCESSORY_CODE_IMAGE_MAP[row.imageKey || row.defId] || ACCESSORY_CODE_IMAGE_MAP[String(row.code)] || ''}
                          alt={row.name[language]}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (placeholder) placeholder.style.display = 'flex';
                          }}
                        />
                        <div className="absolute inset-0 hidden items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-50">
                          {row.codeLabel?.[language] || `#${row.code}`}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 border border-slate-100 whitespace-nowrap">¥{catalogUnit.toFixed(2)}{row.lengthPriced ? '/m' : ''}</td>
                    <td className="p-2 border border-slate-100 whitespace-nowrap">¥{catalogBulk.toFixed(2)}{row.lengthPriced ? '/m' : ''}</td>
                    {SHOW_STOREFRONT_INVENTORY && <td className="p-2 border border-slate-100">
                      {colorMode === 'natural' && inventoryLoaded ? (
                        <span
                          data-testid={`accessory-inventory-${row.key}`}
                          className={`font-black ${stock > 0 ? 'text-emerald-700' : 'text-amber-700'}`}
                        >
                          {stock} {ui.pieces}
                        </span>
                      ) : colorMode === 'natural' ? <span className="text-slate-400">-</span> : null}
                    </td>}
                    <td className="p-2 border border-slate-100">
                      <input
                        type="number"
                        min={0}
                        value={qty}
                        aria-label={`${row.name[language]} ${getAccessoryRowSeriesLabel(row, language)}`}
                        onChange={(e) => setQtyMap((prev) => setAccessoryQuantity(prev, row.key, Number(e.target.value)))}
                        className={`w-20 border rounded-lg px-2 py-1 ${selectedRows.has(row.key) ? 'border-blue-400 bg-blue-50' : 'border-slate-200'}`}
                      />
                    </td>
                    <td className="p-2 border border-slate-100 font-black text-slate-800 whitespace-nowrap">
                      ¥{subtotal.toFixed(1)} {isBulk ? <span className="text-[10px] text-emerald-600">(Bulk)</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="text-sm font-bold text-slate-700">
            {ui.totalQty}: <span className="text-slate-900">{summary.totalQuantity}</span>
          </div>
          <div className="text-lg font-black text-slate-900">
            {ui.total}: ¥{summary.total.toFixed(1)}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={submit}
            className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black hover:bg-blue-600 transition-all"
          >
            {initialItem ? ui.update : ui.add}
          </button>
          {initialItem && (
            <button
              onClick={() => navigate(returnCartPath)}
              className="bg-slate-100 text-slate-700 px-6 py-3 rounded-2xl font-black hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
    {zoomPreview && (
      <div
        className="fixed inset-0 z-[120] bg-black/65 flex items-center justify-center p-6"
        onClick={() => setZoomPreview(null)}
      >
        <div className="max-w-5xl max-h-[88vh] bg-white rounded-2xl shadow-2xl p-3" onClick={(e) => e.stopPropagation()}>
          <img src={zoomPreview.src} alt={zoomPreview.alt} className="max-w-[calc(100vw-96px)] max-h-[calc(88vh-24px)] object-contain rounded-xl" />
        </div>
      </div>
    )}
    </>
  );
};

export default AccessoryQuoteEditor;
