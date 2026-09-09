import { ACCESSORY_IMAGE, ACCESSORY_CODE_IMAGE_MAP, ACCESSORY_DEFINITIONS, type AccessoryProfileSize, type AccessoryColorMode } from '../data/accessoryCatalog';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Language, CartItem, Product, User } from '../types';
import { PROFILE_COLORS, getProfileColorPhotoSrc } from '../constants';
import { ACCESSORY_BULK_THRESHOLD } from '../utils/accessoryPricing';
import { normalizeMembershipLevel } from '../utils/membership';
import { ApiService } from '../services/apiService';
import { SHOW_STOREFRONT_INVENTORY } from '../utils/storefrontFeatures';

interface AccessoryConfig {
  type: 'profile_accessory';
  profileSize: AccessoryProfileSize;
  colorMode: AccessoryColorMode;
  colorId?: string;
  colorName?: string;
  quantities: Record<string, number>;
  totalQuantity: number;
  lines: Array<{
    id: string;
    code: number;
    name: string;
    imageKey?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    isBulk: boolean;
  }>;
  unitTotal: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

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

  const [profileSize, setProfileSize] = useState<AccessoryProfileSize>((seeded.profileSize as AccessoryProfileSize) || '2020');
  const [colorMode, setColorMode] = useState<AccessoryColorMode>((seeded.colorMode as AccessoryColorMode) || 'natural');
  const [colorId, setColorId] = useState<string>(seeded.colorId || 'black');
  const [qtyMap, setQtyMap] = useState<Record<string, number>>(() => {
    const src = seeded.quantities || {};
    return Object.keys(src).reduce<Record<string, number>>((acc, key) => {
      const qty = Number((src as Record<string, unknown>)[key] || 0);
      if (qty > 0) acc[key] = qty;
      return acc;
    }, {});
  });
  const [imgError, setImgError] = useState(false);
  const [colorImgError, setColorImgError] = useState(false);
  const colorPhotoSrc = getProfileColorPhotoSrc(colorId);
  const [zoomPreview, setZoomPreview] = useState<{ src: string; alt: string } | null>(null);
  const [inventoryByAccessoryId, setInventoryByAccessoryId] = useState<Record<string, number>>({});
  const [inventoryLoaded, setInventoryLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!SHOW_STOREFRONT_INVENTORY || colorMode !== 'natural') {
      setInventoryByAccessoryId({});
      setInventoryLoaded(false);
      return () => { active = false; };
    }
    setInventoryLoaded(false);
    ApiService.getAccessoryInventory()
      .then((rows) => {
        if (!active) return;
        const next: Record<string, number> = {};
        rows.forEach((row) => {
          if (row.profileSize === profileSize) {
            next[row.accessoryId] = row.quantity;
          }
        });
        setInventoryByAccessoryId(next);
        setInventoryLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setInventoryByAccessoryId({});
        setInventoryLoaded(false);
      });
    return () => { active = false; };
  }, [colorMode, profileSize]);

  const ui = useMemo(() => {
    if (language === 'cn') {
      return {
        size: '适配型号',
        colorMode: '颜色类型',
        natural: '银白',
        colored: '彩色',
        color: '彩色选择',
        imageTitle: '铝型材角码识别图',
        noImage: '请将配件图放到 images/accessory/accessory_codes.jpg',
        noColorImage: '缺少对应色卡图',
        code: '编号',
        item: '配件',
        image: '示意图',
        unit: '单价',
        bulk: '批量单价(≥20)',
        qty: '数量',
        subtotal: '小计',
        stock: '库存',
        pieces: '件',
        notAvailable: '该型号暂不提供',
        total: '总计',
        totalQty: '总数量',
        freeShippingNotice: isVipPlus ? '🔥 VIP+ 配件不限金额包邮' : '🔥 满30包邮',
        batchRule: '同一编号一次买 20 个及以上，自动使用批量单价。',
        add: '加入购物车',
        update: '更新购物车',
        pickFirst: '请先选择数量',
      };
    }
    if (language === 'jp') {
      return {
        size: '対応サイズ',
        colorMode: 'カラー種別',
        natural: 'ナチュラル',
        colored: 'カラー',
        color: 'カラー選択',
        imageTitle: 'アクセサリー識別図',
        noImage: 'images/accessory/accessory_codes.jpg を追加してください',
        noColorImage: 'カラースウォッチ画像なし',
        code: '番号',
        item: '部品',
        image: '画像',
        unit: '単価',
        bulk: '大量単価(20個以上)',
        qty: '数量',
        subtotal: '小計',
        stock: '在庫',
        pieces: '個',
        notAvailable: 'このサイズは未提供',
        total: '合計',
        totalQty: '総数量',
        freeShippingNotice: isVipPlus ? '🔥 VIP+ 部品は金額に関わらず送料無料' : '🔥 30元以上で送料無料',
        batchRule: '同一番号を20個以上購入時、自動で大量単価になります。',
        add: 'カートに追加',
        update: 'カートを更新',
        pickFirst: '数量を入力してください',
      };
    }
    return {
      size: 'Profile Size',
      colorMode: 'Color Mode',
      natural: 'Natural',
      colored: 'Colored',
      color: 'Color',
      imageTitle: 'Accessory Reference',
      noImage: 'Please place image at images/accessory/accessory_codes.jpg',
      noColorImage: 'Missing color image',
      code: 'No.',
      item: 'Item',
      image: 'Image',
      unit: 'Unit',
      bulk: 'Bulk Unit (>=20)',
      qty: 'Qty',
      subtotal: 'Subtotal',
      stock: 'Stock',
      pieces: 'pcs',
      notAvailable: 'Not available for this size',
      total: 'Total',
      totalQty: 'Total Qty',
      freeShippingNotice: isVipPlus ? '🔥 VIP+ accessories ship free at any order amount' : '🔥 Free shipping for orders over ¥30',
      batchRule: 'For the same code, qty >=20 uses bulk unit price.',
      add: 'Add to Cart',
      update: 'Update Cart',
      pickFirst: 'Please enter quantity first',
    };
  }, [isVipPlus, language]);

  const availableDefs = useMemo(
    () => ACCESSORY_DEFINITIONS.filter((d) => Boolean(d.prices[profileSize])),
    [profileSize]
  );

  const lines = useMemo(() => {
    return availableDefs
      .map((def) => {
        const p = def.prices[profileSize]!;
        const qty = Math.max(0, Number(qtyMap[def.id] ?? 0));
        const isBulk = qty >= ACCESSORY_BULK_THRESHOLD;
        const unitPrice = colorMode === 'natural'
          ? (isBulk ? p.naturalBulk : p.natural)
          : (isBulk ? p.coloredBulk : p.colored);

        return {
          def,
          qty,
          isBulk,
          unitPrice,
          subtotal: round1(unitPrice * qty),
        };
      })
      .filter((x) => x.qty > 0);
  }, [availableDefs, profileSize, qtyMap, colorMode]);

  const totalQty = lines.reduce((sum, x) => sum + x.qty, 0);
  const total = round1(lines.reduce((sum, x) => sum + x.subtotal, 0));

  const submit = () => {
    if (totalQty <= 0) {
      alert(ui.pickFirst);
      return;
    }

    const config: AccessoryConfig = {
      type: 'profile_accessory',
      profileSize,
      colorMode,
      colorId: colorMode === 'colored' ? colorId : undefined,
      colorName:
        colorMode === 'colored'
          ? (PROFILE_COLORS.find((c) => c.id === colorId)?.name?.[language] || colorId)
          : undefined,
      quantities: qtyMap,
      totalQuantity: totalQty,
      lines: lines.map((x) => ({
        id: x.def.id,
        code: x.def.code,
        name: x.def.name[language],
        imageKey: x.def.imageKey || x.def.id,
        quantity: x.qty,
        unitPrice: x.unitPrice,
        subtotal: x.subtotal,
        isBulk: x.isBulk,
      })),
      unitTotal: total,
    };

    const nextItem: CartItem = {
      id: initialItem?.id || Date.now().toString(),
      product,
      quantity: 1,
      config,
      totalPrice: total,
    };

    if (initialItem) {
      onUpdateItem(nextItem);
      navigate(returnCartPath);
      return;
    }

    onAddToCart(nextItem);
  };

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-black text-slate-500 mb-2">{ui.size}</label>
            <select
              value={profileSize}
              onChange={(e) => setProfileSize(e.target.value as AccessoryProfileSize)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white font-bold"
            >
              <option value="1515">1515</option>
              <option value="2020">2020</option>
              <option value="3030">3030</option>
              <option value="4040">4040</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-2">{ui.colorMode}</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setColorMode('natural')}
                className={`px-3 py-2.5 rounded-xl border text-sm font-black ${
                  colorMode === 'natural' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {ui.natural}
              </button>
              <button
                onClick={() => setColorMode('colored')}
                className={`px-3 py-2.5 rounded-xl border text-sm font-black ${
                  colorMode === 'colored' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                {ui.colored}
              </button>
            </div>
          </div>

          {colorMode === 'colored' ? (
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
          ) : <div />}
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
                <th className="p-2 border border-slate-200">{ui.image}</th>
                <th className="p-2 border border-slate-200">{ui.unit}</th>
                <th className="p-2 border border-slate-200">{ui.bulk}</th>
                {SHOW_STOREFRONT_INVENTORY && <th className="p-2 border border-slate-200">{ui.stock}</th>}
                <th className="p-2 border border-slate-200">{ui.qty}</th>
                <th className="p-2 border border-slate-200">{ui.subtotal}</th>
              </tr>
            </thead>
            <tbody>
              {ACCESSORY_DEFINITIONS.map((def) => {
                const p = def.prices[profileSize];
                if (!p) return null;
                const qty = Math.max(0, Number(qtyMap[def.id] ?? 0));
                const isBulk = qty >= ACCESSORY_BULK_THRESHOLD;
                const unitPrice = colorMode === 'natural'
                  ? (isBulk ? p.naturalBulk : p.natural)
                  : (isBulk ? p.coloredBulk : p.colored);
                const subtotal = round1(unitPrice * qty);

                return (
                  <tr key={def.id} className="odd:bg-white even:bg-slate-50/60">
                    <td className="p-2 border border-slate-100 font-black">{def.codeLabel?.[language] || `${def.code}号`}</td>
                    <td className="p-2 border border-slate-100">
                      <div className="font-semibold text-slate-800">{def.name[language]}</div>
                      {def.note && <div className="text-[11px] text-slate-500">{def.note}</div>}
                    </td>
                    <td className="p-2 border border-slate-100">
                      <div
                        className="w-16 h-12 rounded-lg border border-slate-200 bg-white overflow-hidden relative cursor-zoom-in"
                        onClick={() => {
                          const src = ACCESSORY_CODE_IMAGE_MAP[def.imageKey || def.id] || ACCESSORY_CODE_IMAGE_MAP[String(def.code)] || '';
                          if (src) setZoomPreview({ src, alt: def.name[language] });
                        }}
                      >
                        <img
                          src={ACCESSORY_CODE_IMAGE_MAP[def.imageKey || def.id] || ACCESSORY_CODE_IMAGE_MAP[String(def.code)] || ''}
                          alt={def.name[language]}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
                            if (placeholder) placeholder.style.display = 'flex';
                          }}
                        />
                        <div className="absolute inset-0 hidden items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-50">
                          {def.codeLabel?.[language] || `#${def.code}`}
                        </div>
                      </div>
                    </td>
                    <td className="p-2 border border-slate-100">¥{(colorMode === 'natural' ? p.natural : p.colored).toFixed(2)}</td>
                    <td className="p-2 border border-slate-100">¥{(colorMode === 'natural' ? p.naturalBulk : p.coloredBulk).toFixed(2)}</td>
                    {SHOW_STOREFRONT_INVENTORY && <td className="p-2 border border-slate-100">
                      {colorMode === 'natural' && inventoryLoaded ? (
                        <span
                          data-testid={`accessory-inventory-${def.id}`}
                          className={`font-black ${(inventoryByAccessoryId[def.id] || 0) > 0 ? 'text-emerald-700' : 'text-amber-700'}`}
                        >
                          {inventoryByAccessoryId[def.id] || 0} {ui.pieces}
                        </span>
                      ) : colorMode === 'natural' ? <span className="text-slate-400">-</span> : null}
                    </td>}
                    <td className="p-2 border border-slate-100">
                      <input
                        type="number"
                        min={0}
                        value={qty}
                        onChange={(e) => setQtyMap((prev) => ({
                          ...prev,
                          [def.id]: Math.max(0, Number(e.target.value) || 0),
                        }))}
                        className="w-20 border border-slate-200 rounded-lg px-2 py-1"
                      />
                    </td>
                    <td className="p-2 border border-slate-100 font-black text-slate-800">
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
            {ui.totalQty}: <span className="text-slate-900">{totalQty}</span>
          </div>
          <div className="text-lg font-black text-slate-900">
            {ui.total}: ¥{total.toFixed(1)}
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
