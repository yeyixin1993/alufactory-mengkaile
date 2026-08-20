
import React from 'react';
import { CartItem, User, ProductType, ProfileConfig, Language, ProfileSide, Address } from '../types';
import { TRANSLATIONS, PROFILE_COLORS, getMarineBoardOrderColorName, getProfileColorPhotoSrc, SHIPPING_RATES, SHIPPING_RATES_SF, SHIPPING_RATES_AN, PROFILE_WEIGHTS, SHIPPING_METHOD_NAMES } from '../constants';
import type { ShippingMethod } from '../constants';
import ProfileVisualizer from './ProfileVisualizer';
import { describeHolePassage, getHolePhysicalGrooveIndex } from '../utils/profileMachining';
import { calculateScrewPlan } from '../utils/screwCalculator';
import {
  getProfileManufacturingGroupKey,
  groupFactoryDisplayCartItems,
  isDiyScrewAccessory,
  summarizeDiyScrewCartItems,
} from '../utils/cartAccessories';
import { getAccessoryShippingWeightKg } from '../utils/membership';

interface FactorySheetProps {
  cart: CartItem[];
  user: User | null;
  language: Language;
  orderRef: string;
  dateStr: string;
  id?: string;
  showPrice?: boolean;
  address?: Address;
  shippingMethod?: string;
  shippingFee?: number;
  include304Screws?: boolean;
  includeLabelService?: boolean;
  labelFee?: number;
  overlengthFee?: number;
}

const getCurrency = (lang: Language) => lang === 'cn' ? '￥' : '$';

const ACCESSORY_CODE_IMAGE_MAP: Record<string, string> = {
  '1': '/images/accessory/1.jpg',
  '2': '/images/accessory/2.jpg',
  '3': '/images/accessory/3.jpg',
  '5': '/images/accessory/5.jpg',
  '7': '/images/accessory/7L.jpg',
  '7L': '/images/accessory/7L.jpg',
  '7T': '/images/accessory/7T.jpg',
  '8': '/images/accessory/8.jpg',
  '9': '/images/accessory/9.jpg',
  '10': '/images/accessory/10.jpg',
  '10_1515_m4x6_cap': '/images/accessory/10_1515_m4x6_cap.jpg',
  '10_1515_m4x12_cap': '/images/accessory/10_1515_m4x12_cap.jpg',
  '10_1515_m4_tnut': '/images/accessory/10_1515_m4_tnut.jpg',
  '10_2020_m5x14_cap': '/images/accessory/10_2020_m5x14_cap.jpg',
  '10_2020_m5x8_cap': '/images/accessory/10_2020_m5x8_cap.jpg',
  '10_2020_m6x20_cs': '/images/accessory/10_2020_m6x20_cs.jpg',
  '10_2020_m5_tnut': '/images/accessory/10_2020_m5_tnut.jpg',
  '10_3030_m6x18_cap': '/images/accessory/10_3030_m6x18_cap.jpg',
  '10_3030_m6x12_cap': '/images/accessory/10_3030_m6x12_cap.jpg',
  '10_3030_m8x20_cs': '/images/accessory/10_3030_m8x20_cs.jpg',
  '10_3030_m6_tnut': '/images/accessory/10_3030_m6_tnut.jpg',
};

const pickFirstNonEmpty = (...values: any[]): string => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
      continue;
    }
    if (typeof value === 'number') return String(value);
  }
  return '';
};

const resolveBoardColorLabel = (cfg: any, language: Language, productType?: ProductType): string => {
  if (!cfg || typeof cfg !== 'object') return '-';

  const colorObj = (cfg.color && typeof cfg.color === 'object') ? cfg.color : {};
  const selectedColorObj = (cfg.selectedColor && typeof cfg.selectedColor === 'object') ? cfg.selectedColor : {};
  const isMarineBoard = productType === ProductType.MARINE_BOARD;
  const mappedById = cfg.colorId
    ? (isMarineBoard
      ? getMarineBoardOrderColorName(String(cfg.colorId), language)
      : PROFILE_COLORS.find(c => c.id === cfg.colorId)?.name?.[language])
    : '';

  return pickFirstNonEmpty(
    mappedById,
    cfg.colorName,
    cfg.color_name,
    cfg.colorLabel,
    cfg.color_label,
    cfg.displayColorName,
    cfg.materialColorName,
    cfg.boardColorName,
    cfg.color,
    cfg.colour,
    cfg.materialColor,
    cfg.boardColor,
    cfg.selectedColorName,
    cfg.colorId,
    cfg.colourId,
    cfg.materialColorId,
    cfg.boardColorId,
    colorObj.name,
    colorObj.label,
    colorObj.value,
    colorObj.id,
    selectedColorObj.name,
    selectedColorObj.label,
    selectedColorObj.value,
    selectedColorObj.id,
    '-'
  );
};

const FactorySheet: React.FC<FactorySheetProps> = ({ cart, user, language, orderRef, dateStr, id, showPrice = true, address, shippingMethod, shippingFee: passedShippingFee, include304Screws = false, includeLabelService = false, labelFee: passedLabelFee, overlengthFee: passedOverlengthFee }) => {
  const t = TRANSLATIONS[language];
  const currency = getCurrency(language);
 
// Summarize profiles for a sheet: length, model, color, finish, tap, quantity, remarks
  const profileSummary = React.useMemo(() => {
    type Row = { length: string; model: string; color: string; section: string; tap: string; quantity: number; remark: string; key: string; miter: string };
    const map = new Map<string, Row>();

    groupFactoryDisplayCartItems(cart).forEach(item => {
      if (item.product.type !== ProductType.PROFILE) return;

      const cfg = item.config as ProfileConfig;

      const length = `${cfg.length}`;
      const model = `${cfg.variantId}`;
      const colorDef = PROFILE_COLORS.find(c => c.id === cfg.colorId);
      const colorName = colorDef?.name[language] || '';

      const finishLabel = cfg.finish === 'oxidized' ? t.finishOxidized :
                          cfg.finish === 'powder' ? t.finishPowder :
                          cfg.finish === 'electrophoretic' ? t.finishElectrophoretic : cfg.finish;
      const section = `${finishLabel}`.trim();

      // --- UPDATED DETECTION LOGIC START ---

      // 1. Check for Tapping (based on TappingConfig)
      // Determine left/right tap presence and one/both-side flags
      const leftTap = Array.isArray(cfg.tapping?.left) && cfg.tapping.left.some(Boolean);
      const rightTap = Array.isArray(cfg.tapping?.right) && cfg.tapping.right.some(Boolean);
      const bothSideTap = leftTap && rightTap;
      const hasTap = leftTap || rightTap;

      // 2. Check for Drilling (based on DrillHole[])
      const hasDrill = Array.isArray(cfg.holes) && cfg.holes.length > 0;

      // 3. Determine unique Processing State
      // 'tap' takes precedence (usually implies holes + tapping), 'drill' is just holes, 'raw' is nothing.
      let processingState = 'raw';
      
      if (hasDrill) {
        processingState = 'drill';
      } else if (hasTap) {
        processingState = 'tap';
      }

      // 4. Check for Miter Cut
      const hasMiterLeft = cfg.miterCut?.left?.enabled;
      const hasMiterRight = cfg.miterCut?.right?.enabled;

      // 5. Create Key
      // This ensures a profile with tapping is stored separately from one without
      // Legacy designer cart entries appended scene coordinates to this field.
      // Printed documents keep only customer/manufacturing remarks.
      const customRemark = String(cfg.remark || '')
        .split(/[；\n]+/)
        .map((part) => part.trim())
        .filter((part) => {
          if (!part) return false;
          const isSceneTransform = /^3D\s*(?:DIY|design(?:er)?)?\b/i.test(part)
            && /\b(?:position|rotation)\b/i.test(part);
          const isMaycadSourceReference = /^MayCAD\b/i.test(part)
            && (/(?:source\s*#|PDF AI reconstruction)/i.test(part));
          return !isSceneTransform && !isMaycadSourceReference;
        })
        .join('；');
      const key = getProfileManufacturingGroupKey(item);

      // 6. Create Remark
      const hasMiter = hasMiterLeft || hasMiterRight;
      const needsProcessingRemark = processingState === 'drill' || hasMiter;
      let remark = '无额外加工';
      if (needsProcessingRemark && customRemark) {
        remark = `加工如下图；${customRemark}`;
      } else if (needsProcessingRemark) {
        remark = '加工如下图';
      } else if (customRemark) {
        remark = customRemark;
      }

      const leftTapCount = Array.isArray(cfg.tapping?.left) ? cfg.tapping.left.filter(Boolean).length : 0;
      const rightTapCount = Array.isArray(cfg.tapping?.right) ? cfg.tapping.right.filter(Boolean).length : 0;
      const tapLabel = bothSideTap
        ? `两端攻丝（左${leftTapCount}孔 / 右${rightTapCount}孔）`
        : leftTapCount > 0
          ? `左端攻丝（${leftTapCount}孔）`
          : rightTapCount > 0
            ? `右端攻丝（${rightTapCount}孔）`
            : '无';
      
      // Miter cut label for map key (kept simple)
      let miterLabel = '';
      if (hasMiterLeft && hasMiterRight) miterLabel = '两端斜切45°';
      else if (hasMiterLeft) miterLabel = '左端斜切45°';
      else if (hasMiterRight) miterLabel = '右端斜切45°';

      // --- UPDATED DETECTION LOGIC END ---

      const qty = item.quantity || 0;
      const existing = map.get(key);

      if (existing) {
        existing.quantity += qty;
        if (!existing.remark && remark) existing.remark = remark;
      } else {
        map.set(key, { length, model, color: colorName, section, tap: tapLabel, quantity: qty, remark, key, miter: miterLabel });
      }
    });

    return Array.from(map.values());
  }, [cart, language, t]);

  // Use passed address or fallback to default user address
  const activeAddress = address || user?.addresses.find(a => a.isDefault) || user?.addresses[0];
  const userName = activeAddress?.recipient_name || user?.name || 'Guest User';
  const userPhone = activeAddress?.phone || user?.id || '-';

  const baseTotal = cart.reduce((acc, i) => acc + i.totalPrice, 0);
  const displayCart = React.useMemo(() => groupFactoryDisplayCartItems(cart), [cart]);
  const diyScrewRows = React.useMemo(() => summarizeDiyScrewCartItems(cart), [cart]);
  const hasDiyScrewRows = diyScrewRows.length > 0;
  const nonScrewDisplayCart = React.useMemo(
    () => displayCart.filter((item) => !isDiyScrewAccessory(item)),
    [displayCart],
  );

  const profileMetersSummary = React.useMemo(() => {
    const meterMap = new Map<string, number>();

    cart.forEach((item) => {
      if (item.product.type !== ProductType.PROFILE) return;
      const cfg = item.config as ProfileConfig;
      const lengthMm = Number(cfg.length) || 0;
      const qty = Number(item.quantity) || 0;
      if (lengthMm <= 0 || qty <= 0) return;

      const colorDef = PROFILE_COLORS.find((c) => c.id === cfg.colorId);
      const colorName = colorDef?.name?.[language] || cfg.colorId || '-';
      const finishLabel =
        cfg.finish === 'oxidized'
          ? t.finishOxidized
          : cfg.finish === 'powder'
            ? t.finishPowder
            : cfg.finish === 'electrophoretic'
              ? t.finishElectrophoretic
              : cfg.finish || '-';
      const key = `${cfg.variantId || '-'} · ${colorName} · ${finishLabel}`;

      const prev = meterMap.get(key) || 0;
      meterMap.set(key, prev + (lengthMm * qty) / 1000);
    });

    return Array.from(meterMap.entries())
      .map(([name, meters]) => ({ name, meters }))
      .sort((a, b) => b.meters - a.meters);
  }, [cart, language, t.finishOxidized, t.finishPowder, t.finishElectrophoretic]);

  const profileHoleTotals = React.useMemo(() => {
    return cart.reduce(
      (acc, item) => {
        if (item.product.type !== ProductType.PROFILE) return acc;
        const cfg = item.config as ProfileConfig;
        const qty = Number(item.quantity) || 0;
        if (!Array.isArray(cfg.holes) || qty <= 0) return acc;

        cfg.holes.forEach((hole) => {
          if (hole.type === 'countersunk') acc.countersunk += qty;
          if (hole.type === 'through') acc.through += qty;
        });

        return acc;
      },
      { through: 0, countersunk: 0 }
    );
  }, [cart]);

  // Explicit DIY screw rows already carry customer-confirmed quantities and
  // prices. They replace (rather than stack with) the legacy per-hole add-on.
  const effectiveInclude304Screws = include304Screws && !hasDiyScrewRows;
  const screwPlan = React.useMemo(
    () => calculateScrewPlan(cart, effectiveInclude304Screws),
    [cart, effectiveInclude304Screws],
  );
  const diyScrewByModel = React.useMemo(() => {
    const map = new Map<string, { socketCylinder: number; buttonSocket: number; flatSocket: number }>();
    diyScrewRows.forEach((row) => {
      const current = map.get(row.profileModel) || { socketCylinder: 0, buttonSocket: 0, flatSocket: 0 };
      if (row.screwHead === 'button_socket') current.buttonSocket += row.quantity;
      else if (row.screwHead === 'flat_socket') current.flatSocket += row.quantity;
      else current.socketCylinder += row.quantity;
      map.set(row.profileModel, current);
    });
    return map;
  }, [diyScrewRows]);
  const screwByModel = React.useMemo(() => {
    const m = new Map<string, { countersunk: number; through: number; totalHoles: number; recommended: number }>();
    screwPlan.models.forEach((row) => {
      m.set(row.model, {
        countersunk: row.countersunkHoles,
        through: row.throughHoles,
        totalHoles: row.totalHoles,
        recommended: row.recommendedScrewCount,
      });
    });
    return m;
  }, [screwPlan.models]);

  const labelProfileCount = React.useMemo(() => {
    return cart.reduce((sum, item) => {
      if (item.product.type !== ProductType.PROFILE) return sum;
      const cfg = item.config as ProfileConfig;
      if (includeLabelService || cfg.labelService) {
        return sum + (Number(item.quantity) || 0);
      }
      return sum;
    }, 0);
  }, [cart, includeLabelService]);

  const labelFee = typeof passedLabelFee === 'number' ? passedLabelFee : labelProfileCount;

  // 1. 先计算总重量（如果还没计算的话）
  const calculateTotalWeight = () => {
    let totalWeightKg = 0;
    let hasAccessory = false;
    cart.forEach(item => {
      if (item.product.type === ProductType.PROFILE) {
        const cfg = item.config as ProfileConfig;
        const weightPerM = PROFILE_WEIGHTS[cfg.variantId!] || 0.6;
        totalWeightKg += weightPerM * (cfg.length / 1000) * item.quantity;
      } else if (item.product.type === ProductType.ACCESSORY) {
        hasAccessory = true;
      } else {
        totalWeightKg += 1 * item.quantity;
      }
    });
    return totalWeightKg + getAccessoryShippingWeightKg(user, hasAccessory, baseTotal);
  };

  // 2. 运费计算 — use passed-in values if available, otherwise auto-calculate cheapest
  const hasOverlength = cart.some(item => {
    if (item.product.type === ProductType.PROFILE) {
      const cfg = item.config as ProfileConfig;
      return cfg.length > 1500;
    }
    return false;
  });

  const calcForMethod = (method: 'standard' | 'sf' | 'anneng' | 'sf_collect', province: string, weightKg: number) => {
    if (method === 'sf_collect') return 0;
    if (weightKg <= 0) return 0;
    const olFee = (method === 'standard' || method === 'sf') && hasOverlength ? 20 : 0;
    if (method === 'anneng') {
      const rate = SHIPPING_RATES_AN[province] || { first: 50, next: 3 };
      return weightKg <= 15 ? rate.first : rate.first + Math.ceil(weightKg - 15) * rate.next;
    } else if (method === 'sf') {
      const rate = SHIPPING_RATES_SF[province] || { first: 15, next: 5 };
      const rw = Math.max(1, Math.ceil(weightKg));
      return rate.first + (rw - 1) * rate.next + olFee;
    } else {
      const rate = SHIPPING_RATES[province] || { first: 18, next: 5 };
      const rw = Math.max(1, Math.ceil(weightKg));
      return rate.first + (rw - 1) * rate.next + olFee;
    }
  };

  let shippingFee = 0;
  let shippingLabel = shippingMethod || '';
  if (typeof passedShippingFee === 'number') {
    shippingFee = passedShippingFee;
  } else if (activeAddress) {
    const totalWeightKg = calculateTotalWeight();
    const province = activeAddress.province;
    const stdFee = calcForMethod('standard', province, totalWeightKg);
    const sfFee = calcForMethod('sf', province, totalWeightKg);
    const anFee = calcForMethod('anneng', province, totalWeightKg);
    if (stdFee <= sfFee && stdFee <= anFee) { shippingFee = stdFee; shippingLabel = SHIPPING_METHOD_NAMES.standard[language]; }
    else if (sfFee <= anFee) { shippingFee = sfFee; shippingLabel = SHIPPING_METHOD_NAMES.sf[language]; }
    else { shippingFee = anFee; shippingLabel = SHIPPING_METHOD_NAMES.anneng[language]; }
  }

  const normalizedShippingMethod = (shippingMethod || '').toLowerCase();
  if (!shippingLabel && normalizedShippingMethod in SHIPPING_METHOD_NAMES) {
    shippingLabel = SHIPPING_METHOD_NAMES[normalizedShippingMethod as ShippingMethod][language];
  }

  const isAccessoryOnlyOrder =
    cart.length > 0 && cart.every((item) => item.product.type === ProductType.ACCESSORY);
  const accessoryOnlyOrderAmount = isAccessoryOnlyOrder
    ? cart.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0)
    : 0;
  const isConfirmedFreeAccessoryOnlyOrder =
    isAccessoryOnlyOrder && getAccessoryShippingWeightKg(user, true, accessoryOnlyOrderAmount) === 0;

  // A missing address or an unexplained zero-fee order remains freight
  // collect. An authenticated VIP+ accessory order, or an accessory-only
  // order reaching the ¥30 accessory threshold, is confirmed free shipping.
  if (!activeAddress || (shippingFee <= 0 && !isConfirmedFreeAccessoryOnlyOrder)) {
    shippingFee = 0;
    shippingLabel = SHIPPING_METHOD_NAMES.sf_collect[language];
  }

  const finalTotal = baseTotal + shippingFee + screwPlan.totalFee + labelFee;

  //const shipRate = activeAddress ? (SHIPPING_RATES[activeAddress.province] || { first: 15, next: 0 }) : { first: 0, next: 0 };
  //const shippingFee = activeAddress ? shipRate.first : 0;
  //const finalTotal = baseTotal + shippingFee;

  return (
    <div id={id} className="bg-white p-10 font-mono text-slate-900 w-[210mm] mx-auto shadow-none box-border border border-slate-100 flex flex-col gap-6">
      {/* Header */}
      <div data-pdf-block className="border-b-4 border-slate-900 pb-6 flex justify-between items-end">
        <div className="flex-1">
          <h1 className="text-3xl font-black uppercase tracking-widest mb-3">{t.factorySheet}</h1>
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
            <p><span className="font-bold">{t.customer}:</span> {userName}</p>
            <p><span className="font-bold">{t.contact}:</span> {userPhone}</p>
            <p><span className="font-bold">{t.shippingMethodLabel || 'Shipping Method'}:</span> {shippingLabel || '-'}</p>
            {activeAddress && (
              <p className="col-span-2 mt-1 bg-slate-50 p-2 rounded border border-slate-200">
                <span className="font-bold">{t.shippingAddress}:</span> {activeAddress.province} {activeAddress.detail}
              </p>
            )}
          </div>
        </div>
        <div className="text-right ml-4">
          <div className="text-xl font-black text-slate-300 mb-1">#{orderRef}</div>
          <p className="text-xs font-bold">{t.date}: {dateStr}</p>
        </div>
      </div>

      {/* Profiles Summary Spreadsheet (after header, before items) */}
      {labelProfileCount > 0 && (
        <div data-pdf-block className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm font-bold text-amber-700">
          标签服务提醒：需要打标签
        </div>
      )}

      {(hasDiyScrewRows || screwPlan.totalRecommendedScrewCount > 0) && (
        <div data-pdf-block className="bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3 text-sm font-bold text-cyan-700">
          螺丝配件提醒：需要配螺丝
        </div>
      )}

      {profileMetersSummary.length > 0 && (
        <div data-pdf-block className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">{t.qq_profileMetersByModelColor || '型材米数汇总'}</div>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {profileMetersSummary.map((row) => (
              <li key={row.name} className="flex justify-between gap-3">
                <span className="truncate">
                  {row.name}
                  {(() => {
                    const model = String(row.name || '').split('·')[0].trim();
                    const diyScrews = diyScrewByModel.get(model);
                    if (diyScrews && (diyScrews.socketCylinder > 0 || diyScrews.buttonSocket > 0 || diyScrews.flatSocket > 0)) {
                      return (
                        <span className="ml-2 text-[10px] text-cyan-700">
                          ｜圆柱头内六角 {diyScrews.socketCylinder} / 半圆头内六角 {diyScrews.buttonSocket} / 扁头内六角 {diyScrews.flatSocket}（按3D设计器确认数量）
                        </span>
                      );
                    }
                    if (!effectiveInclude304Screws) return null;
                    const screw = screwByModel.get(model);
                    if (!screw || screw.recommended <= 0) return null;
                    return (
                      <span className="ml-2 text-[10px] text-slate-500">
                        ｜圆柱头内六角 {screw.countersunk > 0 ? screw.countersunk + 2 : 0} / 半圆头内六角+弹性扣件套装 {screw.through > 0 ? screw.through + 2 : 0}
                      </span>
                    );
                  })()}
                </span>
                <span className="font-black whitespace-nowrap">{row.meters.toFixed(1)}m</span>
              </li>
            ))}
          </ul>
          {/*<div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-700 space-y-1">
            <div className="flex justify-between gap-3">
              <span>{t.typeThrough || '通孔'}总数</span>
              <span className="font-black">{profileHoleTotals.through}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>{t.typeCountersunk || '沉头孔'}总数</span>
              <span className="font-black">{profileHoleTotals.countersunk}</span>
            </div>
          </div>*/}
        </div>
      )}

      <div data-pdf-block className="bg-slate-50 p-4 rounded border border-slate-200">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{t.profileSummary || 'Profiles Summary'}</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-white/50 text-left text-xs">
                <th className="p-2 border border-slate-200">长度 (mm)</th>
                <th className="p-2 border border-slate-200">型材型号</th>
                <th className="p-2 border border-slate-200">颜色</th>
                <th className="p-2 border border-slate-200">表面处理</th>
                <th className="p-2 border border-slate-200">攻丝</th>
                <th className="p-2 border border-slate-200">数量</th>
                <th className="p-2 border border-slate-200">备注</th>
              </tr>
            </thead>
            <tbody>
              {profileSummary.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-400">—</td></tr>
              ) : (
                <>
                {profileSummary.map((r, i) => (
                  <tr key={r.key + i} className="odd:bg-white even:bg-slate-50">
                    <td className="p-2 border border-slate-100">{r.length}</td>
                    <td className="p-2 border border-slate-100">{r.model}</td>
                    <td className="p-2 border border-slate-100">{r.color}</td>
                    <td className="p-2 border border-slate-100">{r.section}</td>
                    <td className="p-2 border border-slate-100">{r.tap}</td>
                    <td className="p-2 border border-slate-100">{r.quantity}</td>
                    <td className="p-2 border border-slate-100">{r.remark}</td>
                  </tr>
                ))}
                <tr className="bg-white">
                  <td className="p-2 border border-slate-100"></td>
                  <td className="p-2 border border-slate-100"></td>
                  <td className="p-2 border border-slate-100"></td>
                  <td className="p-2 border border-slate-100"></td>
                  <td className="p-2 border border-slate-100 font-bold underline text-left">合计</td>
                  <td className="p-2 border border-slate-100 font-bold underline text-right">
                    {profileSummary.reduce((sum, r) => sum + r.quantity, 0)}
                  </td>
                  <td className="p-2 border border-slate-100"></td>
                </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {diyScrewRows.length > 0 && (
        <div data-pdf-block className="break-inside-avoid overflow-hidden rounded-xl border-2 border-cyan-700 bg-white">
          <div className="flex items-center justify-between bg-cyan-700 px-5 py-3 text-white">
            <div className="font-black tracking-wide">
              {language === 'cn' ? '3D设计器螺丝汇总' : language === 'jp' ? '3Dデザイナーねじ集計' : '3D designer screw summary'}
            </div>
            <div className="flex items-center gap-5 text-xs font-bold">
              <span>{t.quantity}: {diyScrewRows.reduce((sum, row) => sum + row.quantity, 0)}</span>
              {showPrice && <span>{currency}{diyScrewRows.reduce((sum, row) => sum + row.totalPrice, 0).toFixed(1)}</span>}
            </div>
          </div>
          <div className="p-4">
            <div className="mb-3 text-[10px] font-bold text-cyan-700">
              {language === 'cn'
                ? '以下数量以客户在3D设计器中最终确认的数量为准。'
                : language === 'jp'
                  ? '数量は3Dデザイナーでお客様が最終確認した値です。'
                  : 'Quantities below are the customer-confirmed values from the 3D designer.'}
            </div>
            <table className="w-full border-collapse text-left text-[10px]">
              <thead>
                <tr className="bg-cyan-50 text-cyan-900">
                  <th className="border border-cyan-100 p-2">{language === 'cn' ? '来源型材 / 规格' : language === 'jp' ? '元形材 / 規格' : 'Profile / spec'}</th>
                  <th className="border border-cyan-100 p-2">{language === 'cn' ? '螺丝类型' : language === 'jp' ? 'ねじタイプ' : 'Screw type'}</th>
                  <th className="border border-cyan-100 p-2">{language === 'cn' ? '长度' : language === 'jp' ? '長さ' : 'Length'}</th>
                  <th className="border border-cyan-100 p-2">{t.color}</th>
                  <th className="border border-cyan-100 p-2 text-right">{t.quantity}</th>
                  {showPrice && <th className="border border-cyan-100 p-2 text-right">{language === 'cn' ? '小计' : language === 'jp' ? '小計' : 'Subtotal'}</th>}
                </tr>
              </thead>
              <tbody>
                {diyScrewRows.map((row, rowIndex) => {
                  const screwType = row.screwHead === 'button_socket'
                    ? (language === 'cn'
                      ? `半圆头内六角${row.includesElasticFastener ? '+弹性扣件' : ''}`
                      : language === 'jp'
                        ? `六角穴付きボタンボルト${row.includesElasticFastener ? '+ばね金具' : ''}`
                        : `Button-head socket${row.includesElasticFastener ? ' + spring fastener' : ''}`)
                    : row.screwHead === 'flat_socket'
                      ? (language === 'cn' ? '扁头内六角' : language === 'jp' ? '六角穴付き低頭ボルト' : 'Flat-head socket')
                      : (language === 'cn' ? '圆柱头内六角' : language === 'jp' ? '六角穴付き円筒頭ボルト' : 'Cylinder-head socket');
                  const screwSpec = row.screwThreadSize && row.screwLengthMm
                    ? `${row.screwThreadSize}×${row.screwLengthMm}`
                    : '';
                  const colorName = PROFILE_COLORS.find((color) => color.id === row.colorId)?.name?.[language]
                    || row.colorName
                    || '-';
                  const profileSpec = row.profileModel === row.profileSize
                    ? row.profileModel
                    : `${row.profileModel} / ${row.profileSize}`;
                  return (
                    <tr key={`${row.profileModel}-${row.profileSize}-${row.screwHead}-${row.screwThreadSize}-${row.screwLengthMm}-${rowIndex}`}>
                      <td className="border border-slate-100 p-2 font-black">{profileSpec}</td>
                      <td className="border border-slate-100 p-2">{screwSpec ? `${screwType} · ${screwSpec}` : screwType}</td>
                      <td className="border border-slate-100 p-2">{row.screwLengthMm ? `${row.screwLengthMm}mm` : '-'}</td>
                      <td className="border border-slate-100 p-2">{colorName}</td>
                      <td className="border border-slate-100 p-2 text-right font-black">{row.quantity}</td>
                      {showPrice && <td className="border border-slate-100 p-2 text-right font-bold">{currency}{row.totalPrice.toFixed(1)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="space-y-10">
        {nonScrewDisplayCart.map((item, idx) => {
           const isProfile = item.product.type === ProductType.PROFILE;
            const isAccessory = item.product.type === ProductType.ACCESSORY;
           const cfg = (item.config || {}) as any;
           const profileCfg = cfg as ProfileConfig;
           const colorDef = isProfile ? PROFILE_COLORS.find(c => c.id === profileCfg.colorId) : null;
           
           // Correctly translate finish to Chinese terms as requested
           const finishLabel = isProfile
             ? (profileCfg.finish === 'oxidized' ? t.finishOxidized : 
                profileCfg.finish === 'powder' ? t.finishPowder : 
                profileCfg.finish === 'electrophoretic' ? t.finishElectrophoretic : profileCfg.finish)
             : '';

           // Early per-item processing detection: if raw (no drilling/tapping/miter), skip rendering this PROFILE item
           const itemHasTap = isProfile && !!(profileCfg.tapping?.left?.some(Boolean) || profileCfg.tapping?.right?.some(Boolean));
           const itemHasDrill = isProfile && Array.isArray(profileCfg.holes) && profileCfg.holes.length > 0;
           const itemHasMiter = isProfile && !!(profileCfg.miterCut?.left?.enabled || profileCfg.miterCut?.right?.enabled);
           let itemProcessingState: 'raw' | 'tap' | 'drill' | 'miter' = 'raw';
           if (itemHasDrill) itemProcessingState = 'drill';
           else if (itemHasMiter) itemProcessingState = 'miter';
           else if (itemHasTap && ['2040', '3060', '3060-N1-60', '2040-N1-20', '2040-N1-40', '2047', '2060', '20100', '4080'].includes(String(profileCfg.variantId))) itemProcessingState = 'tap';

           if (isProfile && itemProcessingState === 'raw') return null;

           return (
           <div key={idx} data-pdf-block className="break-inside-avoid border-2 border-slate-900 rounded-xl overflow-hidden bg-white shadow-sm">
             <div className="bg-slate-900 text-white px-5 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                   <span className="bg-white text-slate-900 w-8 h-8 flex items-center justify-center rounded-lg font-black text-xl">{idx + 1}</span>
                   <span className="font-black text-xl tracking-tight">{item.product.name[language]}</span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="bg-white/20 px-3 py-1 rounded font-bold uppercase text-xs">{t.quantity}: {isAccessory ? Number(cfg?.totalQuantity || item.quantity) : item.quantity}</div>
                  {showPrice && <div className="font-black text-xl">{currency}{item.totalPrice.toFixed(1)}</div>}
                </div>
             </div>
             
             <div className="p-6">
               {isProfile ? (
                 <div className="space-y-8">
                    {/* Specs Information */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                       <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">{t.specs}</h4>
                       <div className="grid grid-cols-4 gap-4 text-xs">
                          <div className="flex flex-col"><span className="text-slate-400 mb-1">{t.model}</span><span className="font-black">{profileCfg.variantId}</span></div>
                          <div className="flex flex-col"><span className="text-slate-400 mb-1">{t.length}</span><span className="font-black">{profileCfg.length}mm</span></div>
                          <div className="flex flex-col"><span className="text-slate-400 mb-1">{t.color}</span><span className="font-black">{colorDef?.name[language]}</span></div>
                          <div className="flex flex-col"><span className="text-slate-400 mb-1">{t.finish}</span><span className="font-black">{finishLabel}</span></div>
                       </div>
                    </div>

                    {/* All-Sides Visualization */}
                    {(() => {
                      const itemHasTap = !!(profileCfg.tapping?.left?.some(Boolean) || profileCfg.tapping?.right?.some(Boolean));
                      const itemHasDrill = Array.isArray(profileCfg.holes) && profileCfg.holes.length > 0;
                      const itemHasMiterInner = !!(profileCfg.miterCut?.left?.enabled || profileCfg.miterCut?.right?.enabled);
                      let itemProcessingState2: 'raw' | 'tap' | 'drill' | 'miter' = 'raw';
                      if (itemHasDrill) itemProcessingState2 = 'drill';
                      else if (itemHasMiterInner) itemProcessingState2 = 'miter';
                      else if (itemHasTap && ['2040', '3060', '3060-N1-60', '2040-N1-20', '2040-N1-40', '2047', '2060', '20100', '4080'].includes(String(profileCfg.variantId))) itemProcessingState2 = 'tap';

                      // For miter cut, determine which sides to show based on cut face (AC/BD)
                      let sidesToShow: ProfileSide[] = [];
                      if (itemProcessingState2 === 'raw') {
                        sidesToShow = [];
                      } else if (itemProcessingState2 === 'tap') {
                        sidesToShow = ['B'];
                      } else if (itemProcessingState2 === 'drill') {
                        sidesToShow = ['A', 'B', 'C', 'D'];
                      } else if (itemProcessingState2 === 'miter') {
                        // Show sides relevant to each miter cut's face
                        const miterSides = new Set<ProfileSide>();
                        if (profileCfg.miterCut?.left?.enabled) {
                          const s = profileCfg.miterCut.left.side || 'AC';
                          if (s === 'AC') { miterSides.add('A'); miterSides.add('C'); }
                          else { miterSides.add('B'); miterSides.add('D'); }
                        }
                        if (profileCfg.miterCut?.right?.enabled) {
                          const s = profileCfg.miterCut.right.side || 'AC';
                          if (s === 'AC') { miterSides.add('A'); miterSides.add('C'); }
                          else { miterSides.add('B'); miterSides.add('D'); }
                        }
                        // Deduplicate and order
                        const order: ProfileSide[] = ['A', 'B', 'C', 'D'];
                        sidesToShow = order.filter(s => miterSides.has(s));
                      }

                      // If miter is combined with drill, ensure all sides
                      if (itemHasDrill && itemHasMiterInner) {
                        sidesToShow = ['A', 'B', 'C', 'D'];
                      }

                      if (sidesToShow.length === 0) return null;

                      const previewLabel = itemProcessingState2 === 'drill' ? `${t.preview} (All Sides)` : 
                                           itemProcessingState2 === 'miter' ? `${t.preview} (${t.miterCutLabel || '45° Cut'})` :
                                           `${t.preview} (Side B)`;

                      return (
                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{previewLabel}</h4>
                          <div className="grid grid-cols-1 gap-4">
                            {sidesToShow.map(side => (
                              <div key={side} className="flex gap-4 items-center">
                                <div className="w-10 h-10 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xl">{side}</div>
                                <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-visible">
                                  <ProfileVisualizer config={profileCfg} selectedSide={side} onSideChange={() => {}} interactive={false} tapLabel={t.tapAction} showSideSelector={false} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Miter Cut Details – hidden per request */}

                    {/* Drilling Spreadsheet */}
                    {profileCfg.holes.length > 0 ? (
                      <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex justify-between">
                           <span>{t.drillingInstr}</span>
                           <span className="text-[10px] lowercase text-slate-300 font-normal">total: {profileCfg.holes.length} holes</span>
                        </h4>
                        <table className="w-full text-left text-[10px] border-collapse">
                           <thead>
                             <tr className="bg-slate-100">
                               <th className="p-2 border border-slate-200">#</th>
                               <th className="p-2 border border-slate-200">{t.side}（入口 → 出口）</th>
                               <th className="p-2 border border-slate-200">{t.position} (mm)</th>
                               <th className="p-2 border border-slate-200">{t.holeType}</th>
                               <th className="p-2 border border-slate-200">物理槽 ID</th>
                             </tr>
                           </thead>
                           <tbody>
                             {profileCfg.holes.map((hole, hIdx) => (
                               <tr key={hole.id} className="hover:bg-slate-50">
                                 <td className="p-2 border border-slate-100 font-bold">{hIdx + 1}</td>
                                 <td className="p-2 border border-slate-100 font-black">
                                   {describeHolePassage(hole, profileCfg.variantId || '2020', language)}
                                 </td>
                                 <td className="p-2 border border-slate-100 font-black text-blue-600">{hole.positionMm}</td>
                                 <td className="p-2 border border-slate-100">
                                   {hole.type === 'countersunk'
                                     ? t.typeCountersunk
                                     : hole.type === 'threaded'
                                       ? `${t.typeThreaded || '螺纹孔'}${hole.threadSize ? ` (${hole.threadSize})` : ''}`
                                       : t.typeThrough}
                                 </td>
                                 <td className="p-2 border border-slate-100">
                                   P{getHolePhysicalGrooveIndex(hole, profileCfg.variantId || '2020') + 1}
                                 </td>
                               </tr>
                             ))}
                           </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded border border-dashed border-slate-200 text-center uppercase tracking-widest">
                        {t.noDrilling}
                      </div>
                    )}
                 </div>
               ) : isAccessory ? (
                <div className="space-y-4">
                  {(() => {
                    const lines = Array.isArray(cfg?.lines) ? cfg.lines : [];
                    const selectedLines = lines.filter((line: any) => Number(line?.quantity || 0) > 0);
                    const fitModel = cfg?.profileSize || cfg?.size || cfg?.variantId || '-';
                    const rawColorMode = String(cfg?.colorMode || '').toLowerCase();
                    const selectedAccessoryColorName = cfg?.colorName || (cfg?.colorId ? PROFILE_COLORS.find(c => c.id === cfg.colorId)?.name?.[language] : '');
                    const colorModeText = rawColorMode === 'natural'
                      ? (language === 'cn' ? '银白' : language === 'jp' ? 'シルバーホワイト' : 'Silver White')
                      : rawColorMode === 'colored'
                        ? (selectedAccessoryColorName || (language === 'cn' ? '彩色' : language === 'jp' ? 'カラー' : 'Colored'))
                        : (cfg?.colorMode || '-');
                    const totalQty = Number(cfg?.totalQuantity || 0);
                    const showAccessorySwatch = rawColorMode === 'colored' && !!cfg?.colorId;
                    const accessorySwatchSrc = showAccessorySwatch ? getProfileColorPhotoSrc(String(cfg.colorId)) : '';

                    return (
                      <>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">{t.specs}</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div><span className="text-slate-400">{language === 'cn' ? '适配型号' : language === 'jp' ? '適合型番' : 'Fit Model'}:</span> <span className="font-black">{fitModel}</span></div>
                            <div><span className="text-slate-400">{language === 'cn' ? '颜色' : language === 'jp' ? '色' : 'Color'}:</span> <span className="font-black">{colorModeText}</span></div>
                            <div><span className="text-slate-400">{language === 'cn' ? '总数量' : language === 'jp' ? '総数量' : 'Total Qty'}:</span> <span className="font-black">{totalQty}</span></div>
                            <div><span className="text-slate-400">{language === 'cn' ? '小计' : language === 'jp' ? '小計' : 'Subtotal'}:</span> <span className="font-black">{currency}{Number(cfg?.unitTotal || item.totalPrice || 0).toFixed(1)}</span></div>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">
                            {language === 'cn' ? '配件明细' : language === 'jp' ? '部品明細' : 'Accessory Details'}
                          </h4>
                          {selectedLines.length === 0 ? (
                            <div className="text-xs text-slate-500">-</div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {showAccessorySwatch && accessorySwatchSrc && (
                                <div className="border border-slate-200 rounded-xl bg-white p-3 flex gap-3 items-center">
                                  <div className="w-20 h-16 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden relative shrink-0">
                                    <img
                                      src={accessorySwatchSrc}
                                      alt={String(selectedAccessoryColorName || cfg?.colorId || 'swatch')}
                                      className="w-full h-full object-contain"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
                                        if (placeholder) placeholder.style.display = 'flex';
                                      }}
                                    />
                                    <div className="absolute inset-0 hidden items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-50">
                                      {language === 'cn' ? '色板缺失' : language === 'jp' ? '色見本なし' : 'No Swatch'}
                                    </div>
                                  </div>
                                  <div className="min-w-0 flex-1 text-xs">
                                    <div className="font-black text-slate-800 whitespace-normal break-words leading-snug">{selectedAccessoryColorName || String(cfg?.colorId || '-')}</div>
                                  </div>
                                </div>
                              )}
                              {selectedLines.map((line: any, lineIdx: number) => {
                                const code = String(line?.code || '');
                                const imageKey = String(line?.imageKey || line?.id || code || '');
                                const imgSrc = ACCESSORY_CODE_IMAGE_MAP[imageKey] || ACCESSORY_CODE_IMAGE_MAP[code] || '';
                                const lineName = line?.name || `#${code || lineIdx + 1}`;
                                const qty = Number(line?.quantity || 0);
                                const subtotal = Number(line?.subtotal || 0);

                                return (
                                  <div key={`acc-line-${imageKey || code}-${lineIdx}`} className="border border-slate-200 rounded-xl bg-white p-3 flex gap-3 items-center">
                                    <div className="w-20 h-16 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden relative shrink-0">
                                      <img
                                        src={imgSrc}
                                        alt={lineName}
                                        className="w-full h-full object-contain"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
                                          if (placeholder) placeholder.style.display = 'flex';
                                        }}
                                      />
                                      <div className="absolute inset-0 hidden items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-50">IMG #{imageKey || code || lineIdx + 1}</div>
                                    </div>
                                    <div className="min-w-0 flex-1 text-xs">
                                      <div className="font-black text-slate-800 whitespace-normal break-words leading-snug" title={lineName}>{lineName}</div>
                                      <div className="text-slate-500">{language === 'cn' ? '数量' : language === 'jp' ? '数量' : 'Qty'}: {qty}</div>
                                      <div className="text-slate-700 font-bold">{language === 'cn' ? '小计' : language === 'jp' ? '小計' : 'Subtotal'}: {currency}{subtotal.toFixed(1)}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
               ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">{t.specs}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      <div><span className="text-slate-400">{language === 'cn' ? '厚度' : language === 'jp' ? '厚さ' : 'Thickness'}:</span> <span className="font-black">{cfg.thickness ?? '-'}mm</span></div>
                      <div><span className="text-slate-400">{language === 'cn' ? '宽' : language === 'jp' ? '幅' : 'Width'}:</span> <span className="font-black">{cfg.width ?? '-'}mm</span></div>
                      <div><span className="text-slate-400">{language === 'cn' ? '高' : language === 'jp' ? '高さ' : 'Height'}:</span> <span className="font-black">{cfg.height ?? '-'}mm</span></div>
                      <div><span className="text-slate-400">{language === 'cn' ? '颜色' : language === 'jp' ? '色' : 'Color'}:</span> <span className="font-black">{resolveBoardColorLabel(cfg, language, item.product.type)}</span></div>
                      {cfg.cabinetDoor && (
                        <>
                          <div><span className="text-slate-400">{language === 'cn' ? '柜门材料' : language === 'jp' ? '扉材質' : 'Door Material'}:</span> <span className="font-black">{cfg.doorMaterial === 'marine' ? (language === 'cn' ? '海洋板门' : language === 'jp' ? 'マリンボード扉' : 'Marine-board door') : cfg.doorMaterial === 'pegboard' ? (language === 'cn' ? '铝洞洞板门' : language === 'jp' ? 'アルミペグボード扉' : 'Aluminum pegboard door') : (language === 'cn' ? '铝柜门' : language === 'jp' ? 'アルミ扉' : 'Aluminum door')}</span></div>
                          <div><span className="text-slate-400">{language === 'cn' ? '覆盖方式' : language === 'jp' ? 'かぶせ方式' : 'Overlay'}:</span> <span className="font-black">{cfg.doorOverlay === 'half' ? (language === 'cn' ? '半盖' : language === 'jp' ? '半かぶせ' : 'Half overlay') : cfg.doorOverlay === 'inset' ? (language === 'cn' ? '大弯（不盖型材）' : language === 'jp' ? 'インセット' : 'Inset') : (language === 'cn' ? '全盖' : language === 'jp' ? '全かぶせ' : 'Full overlay')}</span></div>
                          <div><span className="text-slate-400">{language === 'cn' ? '开门方向' : language === 'jp' ? '開き方向' : 'Opening'}:</span> <span className="font-black">{cfg.openingSide === 'right' ? (language === 'cn' ? '右开' : language === 'jp' ? '右開き' : 'Right') : (language === 'cn' ? '左开' : language === 'jp' ? '左開き' : 'Left')}</span></div>
                        </>
                      )}
                      {item.product.type === ProductType.PEGBOARD && (
                        <div><span className="text-slate-400">{language === 'cn' ? '孔型' : language === 'jp' ? '穴形状' : 'Hole Pattern'}:</span> <span className="font-black">{cfg.pegHolePatternName || (language === 'cn' ? '宜家孔（竖向长圆孔）' : language === 'jp' ? 'IKEA穴（縦長穴）' : 'IKEA holes (vertical slots)')}</span></div>
                      )}
                      {item.product.type === ProductType.MARINE_BOARD && (
                        <div><span className="text-slate-400">{language === 'cn' ? '海洋板规格' : language === 'jp' ? '海洋板仕様' : 'Marine Spec'}:</span> <span className="font-black">{cfg.marineSpecName || (cfg.marineSpecId === 'marine_bbb_plain' ? (language === 'cn' ? 'BBB素板' : language === 'jp' ? 'BBB素板' : 'BBB plain board') : (language === 'cn' ? 'BBB两面UV清漆+覆膜' : language === 'jp' ? 'BBB両面UVクリア+フィルム' : 'BBB double-side UV varnish + film'))}</span></div>
                      )}
                      <div><span className="text-slate-400">{language === 'cn' ? '单价' : language === 'jp' ? '単価' : 'Unit Price'}:</span> <span className="font-black">{currency}{Number(cfg.unitPrice || (item.totalPrice / Math.max(1, item.quantity))).toFixed(1)}</span></div>
                      <div><span className="text-slate-400">{language === 'cn' ? '面积' : language === 'jp' ? '面積' : 'Area'}:</span> <span className="font-black">{Number(cfg.areaSqm || 0).toFixed(3)}㎡</span></div>
                    </div>
                    {cfg.openingSide && (
                      <div className="mt-3 text-xs font-bold text-slate-700">
                        {language === 'cn' ? '备注' : language === 'jp' ? '備考' : 'Note'}：
                        {language === 'cn'
                          ? `铰链数量 ${cfg.hingeCount || (Array.isArray(cfg.hingePositions) ? cfg.hingePositions.length : 0)} 个。上铰链离上端 ${Number(cfg.topHingeOffset ?? 100).toFixed(0)}mm，下铰链离下端 ${Number(cfg.bottomHingeOffset ?? 100).toFixed(0)}mm；铰链间距：${Array.isArray(cfg.hingeGaps) && cfg.hingeGaps.length ? cfg.hingeGaps.map((x: number) => `${Number(x).toFixed(0)}mm`).join(' / ') : '-'}。`
                          : language === 'jp'
                            ? `ヒンジ数 ${cfg.hingeCount || (Array.isArray(cfg.hingePositions) ? cfg.hingePositions.length : 0)}。上端距離 ${Number(cfg.topHingeOffset ?? 100).toFixed(0)}mm、下端距離 ${Number(cfg.bottomHingeOffset ?? 100).toFixed(0)}mm；間隔: ${Array.isArray(cfg.hingeGaps) && cfg.hingeGaps.length ? cfg.hingeGaps.map((x: number) => `${Number(x).toFixed(0)}mm`).join(' / ') : '-'}`
                            : `Hinges: ${cfg.hingeCount || (Array.isArray(cfg.hingePositions) ? cfg.hingePositions.length : 0)}. Top offset ${Number(cfg.topHingeOffset ?? 100).toFixed(0)}mm, bottom offset ${Number(cfg.bottomHingeOffset ?? 100).toFixed(0)}mm; spacing: ${Array.isArray(cfg.hingeGaps) && cfg.hingeGaps.length ? cfg.hingeGaps.map((x: number) => `${Number(x).toFixed(0)}mm`).join(' / ') : '-'}.`}
                      </div>
                    )}
                    {(() => {
                      const showSwatch = !!cfg?.colorId && (String(cfg.colorId) !== 'natural' || item.product.type === ProductType.MARINE_BOARD);
                      const swatchSrc = showSwatch
                        ? (String(cfg.colorId) === 'wood_natural' || (item.product.type === ProductType.MARINE_BOARD && String(cfg.colorId) === 'natural')
                          ? '/images/color_wood_natural.svg'
                          : getProfileColorPhotoSrc(String(cfg.colorId)))
                        : '';
                      return showSwatch && swatchSrc ? (
                        <div className="mt-3">
                          <div className="w-36 h-24 rounded-lg border border-slate-200 bg-white overflow-hidden relative">
                            <img
                              src={swatchSrc}
                              alt={String(cfg?.colorName || cfg?.colorId || 'swatch')}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (placeholder) placeholder.style.display = 'flex';
                              }}
                            />
                            <div className="absolute inset-0 hidden items-center justify-center text-[10px] font-bold text-slate-400 bg-slate-50">
                              {language === 'cn' ? '色板缺失' : language === 'jp' ? '色見本なし' : 'No Swatch'}
                            </div>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <svg viewBox="0 0 320 180" className="w-full h-auto">
                      {(() => {
                        const w = Math.max(1, Number(cfg.width || 0));
                        const h = Math.max(1, Number(cfg.height || 0));
                        const ratio = w / h;
                        const areaX = 30;
                        const areaY = 15;
                        const areaW = 230;
                        const areaH = 145;
                        let rw = areaW;
                        let rh = rw / ratio;
                        if (rh > areaH) {
                          rh = areaH;
                          rw = rh * ratio;
                        }
                        const rx = areaX + (areaW - rw) / 2;
                        const ry = areaY + (areaH - rh) / 2;

                        const isPegboard = item.product.id === 'p1' || cfg.doorMaterial === 'pegboard';
                        const isDoor = item.product.id === 'p3' || cfg.cabinetDoor === true;

                        return (
                          <>
                            <rect x={rx} y={ry} width={rw} height={rh} fill="#fff" stroke="#334155" strokeWidth="2" rx="4" />
                            {isPegboard && (
                              <>
                                {Array.from({ length: Math.max(4, Math.min(18, Math.round(w / 120))) }).map((_, c) =>
                                  Array.from({ length: Math.max(4, Math.min(14, Math.round(h / 120))) }).map((__, r) => (
                                    <ellipse
                                      key={`hole-${c}-${r}`}
                                      cx={rx + ((c + 1) * rw) / (Math.max(4, Math.min(18, Math.round(w / 120))) + 1)}
                                      cy={ry + ((r + 1) * rh) / (Math.max(4, Math.min(14, Math.round(h / 120))) + 1)}
                                      rx={Math.max(2, rw / 110)}
                                      ry={Math.max(3, rh / 75)}
                                      fill="#94a3b8"
                                    />
                                  ))
                                )}
                              </>
                            )}
                            {isDoor && (
                              <>
                                {Array.isArray(cfg.hingePositions) && cfg.hingePositions.map((hp: number, i: number) => {
                                  const hy = ry + (Math.max(0, Math.min(h, Number(hp || 0))) / h) * rh;
                                  const hx = cfg.openingSide === 'left' ? rx : (rx + rw - 6);
                                  return <rect key={`h-${i}`} x={hx} y={hy - 3} width="6" height="6" fill="#ef4444" rx="1" />;
                                })}
                                <rect
                                  x={cfg.openingSide === 'left' ? (rx + rw - 8) : (rx - 4)}
                                  y={ry + rh / 2 - 14}
                                  width="8"
                                  height="28"
                                  fill="#2563eb"
                                  rx="2"
                                />
                              </>
                            )}
                            <text x="145" y="174" fontSize="10" fill="#334155" textAnchor="middle">W {w}mm</text>
                            <text x="12" y="92" fontSize="10" fill="#334155" transform="rotate(-90 12 92)" textAnchor="middle">H {h}mm</text>
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                </div>
               )}
             </div>
           </div>
        )})}
      </div>

      {/* Totals */}
      {showPrice && (
        <div data-pdf-block className="mt-12 border-t-4 border-slate-900 pt-8 pb-3 flex justify-between items-start gap-8">
           <div className="flex-1" />

           <div className="w-80 space-y-3 text-right">
             <div className="flex justify-between text-slate-500 text-xs"><span>{t.total}:</span><span className="font-bold text-slate-800">{currency}{baseTotal.toFixed(1)}</span></div>
             <div className="flex justify-between text-slate-500 text-xs">
               <span>{t.shippingFee}{shippingLabel ? ` (${shippingLabel})` : ''}:</span>
               <span className="font-bold text-slate-800">{currency}{shippingFee.toFixed(1)}</span>
             </div>
             {effectiveInclude304Screws && screwPlan.totalRecommendedScrewCount > 0 && (
               <div className="flex justify-between text-slate-500 text-xs">
                 <span>304螺丝及弹性配件费（总孔{screwPlan.totalHoles}）:</span>
                 <span className="font-bold text-slate-800">{currency}{screwPlan.totalFee.toFixed(1)}</span>
               </div>
             )}
             {labelFee > 0 && (
               <div className="flex justify-between text-slate-500 text-xs">
                 <span>贴标签服务费（{labelProfileCount}根）:</span>
                 <span className="font-bold text-slate-800">{currency}{labelFee.toFixed(1)}</span>
               </div>
             )}
             {(passedOverlengthFee ?? 0) > 0 && (
               <div className="flex justify-between text-amber-600 text-xs"><span>{t.overlengthFee} (含):</span><span className="font-bold">+{currency}{passedOverlengthFee!.toFixed(0)}</span></div>
             )}
             <div className="flex justify-between text-3xl font-black pt-4 border-t border-slate-100 text-blue-600">
               <span>{t.total}</span>
               <span>{currency}{finalTotal.toFixed(1)}</span>
             </div>
           </div>
        </div>
      )}

      {/* Payment QR Codes */}
      {showPrice && (
        <div data-pdf-block data-pdf-keep-together className="break-inside-avoid border-t-2 border-slate-200 pt-6 mt-8">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">付款方式</h4>
          <div className="grid grid-cols-3 gap-4">
            {/* Alipay */}
            <div className="text-center space-y-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
              <div className="text-xs font-bold text-slate-900">{t.alipayPayment}</div>
              <div className="flex justify-center">
                <img src="images/alipay-qr.jpg" alt="Alipay" className="w-24 h-24 rounded-lg border border-slate-200" />
              </div>
              <p className="text-[9px] text-slate-500 leading-tight">{t.alipayInstructions}</p>
              <p className="text-[9px] font-bold text-slate-700">上海暖橙黄信息科技有限公司</p>
            </div>
            {/* WeChat Pay */}
            <div className="text-center space-y-2 p-3 bg-green-50 rounded-xl border border-green-200">
              <div className="text-xs font-bold text-slate-900">{t.wechatPayment}</div>
              <div className="flex justify-center">
                <img src="images/wechatpay-qr.png" alt="WeChat Pay" className="w-24 h-24 rounded-lg border border-slate-200" />
              </div>
              <p className="text-[9px] text-slate-500 leading-tight">{t.wechatInstructions}</p>
              <p className="text-[9px] font-bold text-slate-700">{t.wechatPhone}</p>
            </div>
            {/* After-sales WeChat */}
            <div className="text-center space-y-2 p-3 bg-green-50 rounded-xl border border-green-200">
              <div className="text-xs font-bold text-slate-900">{t.afterpay}</div>
              <div className="flex justify-center">
                <img src="images/wechat-qr.jpg" alt="WeChat" className="w-24 h-24 rounded-lg border border-slate-200" />
              </div>
              <p className="text-[9px] text-slate-500 leading-tight">{t.afterpayinstructions}</p>
            </div>
          </div>
        </div>
      )}

      <div data-pdf-block className="mt-auto pt-16 pb-4 text-center text-[10px] text-slate-400 uppercase tracking-widest font-bold">
         {t.generatedBy} · {dateStr} · {orderRef}
      </div>
    </div>
  );
};

export default FactorySheet;
