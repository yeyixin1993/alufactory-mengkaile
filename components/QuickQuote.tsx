import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Language, User } from '../types';
import {
  COLOR_ONLY_COLORED_SECTION_IDS,
  PROFILE_COLORS,
  PROFILE_VARIANTS,
  PROFILE_WEIGHTS,
  SHIPPING_METHOD_NAMES,
  SHIPPING_RATES,
  SHIPPING_RATES_AN,
  SHIPPING_RATES_SF,
  TRANSLATIONS,
} from '../constants';
import type { ShippingMethod } from '../constants';

type QuickQuoteProduct = 'profile' | 'aluminum_plate' | 'pegboard' | 'marine_board' | 'frame';
type ProfileSection = 'natural' | 'colored';
type FrameType = 'wood' | 'aluminum' | 'alu_wood';

interface ProfileRow {
  id: string;
  model: string;
  length: number;
  colorId: string;
  section: ProfileSection;
  tappingCount: number;
  throughHoleCount: number;
  countersunkHoleCount: number;
  threadedHoleCount: number;
  miter45CutCount: number;
  quantity: number;
}

interface BoardRow {
  id: string;
  thickness: number;
  colorId: string;
  width: number;
  height: number;
  quantity: number;
}

interface FrameRow {
  id: string;
  frameType: FrameType;
  innerWidth: number;
  innerHeight: number;
  quantity: number;
}

const PROFILE_PRICE_TAPPING = 1.5;
const PROFILE_PRICE_THROUGH_HOLE = 1.0;
const PROFILE_PRICE_COUNTERSUNK = 1.8;
const PROFILE_DANGER_FEE_THRESHOLD_MM = 100;
const PROFILE_DANGER_FEE = 5;
const PROFILE_VIP_DISCOUNT_PER_METER = 2;

const PEGBOARD_PRICE_PER_SQM: Record<number, number> = { 1: 780, 2: 1080, 3: 1380, 4: 1680, 5: 1980 };
const ALUMINUM_PLATE_PRICE_PER_SQM: Record<number, number> = { 1: 500, 2: 700, 3: 1000, 4: 1300, 5: 1600 };
const MARINE_BOARD_PRICE_PER_SQM: Record<number, number> = { 6: 100, 9: 130, 12: 155, 15: 175, 18: 200 };
const MIN_BOARD_CHARGE_AREA_SQM = 0.2;
const MAX_PROFILE_LENGTH_MM = 3000;
const MAX_BOARD_WIDTH_MM = 2400;
const MAX_BOARD_HEIGHT_MM = 1200;

const round1 = (n: number) => Number(n.toFixed(1));
const getCurrency = (lang: Language) => (lang === 'cn' ? '￥' : '$');
const safeNonNegative = (value: number | null | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

const createProfileRow = (): ProfileRow => ({
  id: Math.random().toString(36).slice(2, 10),
  model: '2020',
  length: 0,
  colorId: 'natural',
  section: 'natural',
  tappingCount: 0,
  throughHoleCount: 0,
  countersunkHoleCount: 0,
  threadedHoleCount: 0,
  miter45CutCount: 0,
  quantity: 0,
});

const createBoardRow = (thickness: number): BoardRow => ({
  id: Math.random().toString(36).slice(2, 10),
  thickness,
  colorId: 'natural',
  width: 0,
  height: 0,
  quantity: 0,
});

const createFrameRow = (): FrameRow => ({
  id: Math.random().toString(36).slice(2, 10),
  frameType: 'wood',
  innerWidth: 0,
  innerHeight: 0,
  quantity: 0,
});

const getProfileFinishByRow = (row: ProfileRow): 'oxidized' | 'electrophoretic' | 'powder' => {
  if (row.colorId === 'natural') return 'oxidized';
  return row.section === 'natural' ? 'electrophoretic' : 'powder';
};

const calcProfileShippingByProvince = (province: string, totalWeightKg: number, hasOverlength: boolean) => {
  const overlengthFee = hasOverlength ? 20 : 0;

  const standardRate = SHIPPING_RATES[province] || { first: 18, next: 5 };
  const sfRate = SHIPPING_RATES_SF[province] || { first: 15, next: 5 };
  const annengRate = SHIPPING_RATES_AN[province] || { first: 50, next: 3 };

  const roundedWeight = Math.max(1, Math.ceil(totalWeightKg));

  const standard = round1(standardRate.first + (roundedWeight - 1) * standardRate.next + overlengthFee);
  const sf = round1(sfRate.first + (roundedWeight - 1) * sfRate.next + overlengthFee);

  const anneng =
    totalWeightKg <= 15
      ? round1(annengRate.first)
      : round1(annengRate.first + Math.ceil(totalWeightKg - 15) * annengRate.next);

  const options: Array<{ method: ShippingMethod; fee: number }> = [
    { method: 'standard', fee: standard },
    { method: 'sf', fee: sf },
    { method: 'anneng', fee: anneng },
  ];

  const cheapest = options.reduce((best, current) => (current.fee < best.fee ? current : best), options[0]);
  return { method: cheapest.method, fee: cheapest.fee, overlengthFee };
};

const QuickQuote: React.FC<{ language: Language; user?: User | null }> = ({ language, user }) => {
  const t = TRANSLATIONS[language];
  const currency = getCurrency(language);
  const isVipMember = user?.membershipLevel === 'vip' || user?.membershipLevel === 'vip_plus';
  const perPiecePrefix = t.qq_perPiecePrefix || '';
  const buildPerPieceLabel = (label: string) => {
    if (!perPiecePrefix) return label;
    return language === 'cn' ? `${perPiecePrefix}${label}` : `${perPiecePrefix} ${label}`;
  };

  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<QuickQuoteProduct>('profile');

  const [profileRows, setProfileRows] = useState<ProfileRow[]>([createProfileRow()]);
  const [aluPlateRows, setAluPlateRows] = useState<BoardRow[]>([createBoardRow(2)]);
  const [pegboardRows, setPegboardRows] = useState<BoardRow[]>([createBoardRow(2)]);
  const [marineBoardRows, setMarineBoardRows] = useState<BoardRow[]>([createBoardRow(18)]);
  const [frameRows, setFrameRows] = useState<FrameRow[]>([createFrameRow()]);
  const [showSummary, setShowSummary] = useState(false);

  const clearCategory = (key: QuickQuoteProduct) => {
    if (key === 'profile') {
      setProfileRows([createProfileRow()]);
      return;
    }
    if (key === 'aluminum_plate') {
      setAluPlateRows([createBoardRow(2)]);
      return;
    }
    if (key === 'pegboard') {
      setPegboardRows([createBoardRow(2)]);
      return;
    }
    if (key === 'marine_board') {
      setMarineBoardRows([createBoardRow(18)]);
      return;
    }
    if (key === 'frame') {
      setFrameRows([createFrameRow()]);
    }
  };

  const provinces = useMemo(() => Object.keys(SHIPPING_RATES).sort(), []);

  const profileRowsCalculated = useMemo(() => {
    return profileRows.map((row) => {
      const variant = PROFILE_VARIANTS.find((v) => v.id === row.model) || PROFILE_VARIANTS[0];
      const finish = getProfileFinishByRow(row);
      const effectiveLength = Math.min(MAX_PROFILE_LENGTH_MM, safeNonNegative(row.length));
      const basePricePerMeter = variant.price[finish];
      const effectivePricePerMeter = Math.max(0, basePricePerMeter - (isVipMember ? PROFILE_VIP_DISCOUNT_PER_METER : 0));
      const materialPrice = (effectiveLength / 1000) * effectivePricePerMeter;
      const processPrice =
        safeNonNegative(row.tappingCount) * PROFILE_PRICE_TAPPING +
        safeNonNegative(row.throughHoleCount) * PROFILE_PRICE_THROUGH_HOLE +
        safeNonNegative(row.countersunkHoleCount) * PROFILE_PRICE_COUNTERSUNK +
        safeNonNegative(row.threadedHoleCount) * PROFILE_PRICE_COUNTERSUNK +
        safeNonNegative(row.miter45CutCount) * PROFILE_PRICE_THROUGH_HOLE;
      const dangerFee = row.length > 0 && row.length <= PROFILE_DANGER_FEE_THRESHOLD_MM ? PROFILE_DANGER_FEE : 0;
      const unitPrice = round1(materialPrice + processPrice + dangerFee);
      const qty = safeNonNegative(row.quantity || 0);
      const subtotal = round1(unitPrice * qty);
      const weightPerMeter = PROFILE_WEIGHTS[row.model] || 0.6;
      const totalWeightKg = weightPerMeter * (effectiveLength / 1000) * qty;
      return { row, unitPrice, subtotal, totalWeightKg };
    });
  }, [profileRows, isVipMember]);

  const profileSummary = useMemo(() => {
    const itemTotal = round1(profileRowsCalculated.reduce((sum, x) => sum + x.subtotal, 0));
    const totalWeightKg = round1(profileRowsCalculated.reduce((sum, x) => sum + x.totalWeightKg, 0));
    const hasOverlength = profileRows.some((r) => r.length > 1400);

    if (!selectedProvince || itemTotal <= 0) {
      return {
        itemTotal,
        shippingFee: 0,
        categoryTotal: itemTotal,
        method: null as ShippingMethod | null,
        totalWeightKg,
      };
    }

    const shipping = calcProfileShippingByProvince(selectedProvince, totalWeightKg, hasOverlength);
    return {
      itemTotal,
      shippingFee: shipping.fee,
      categoryTotal: round1(itemTotal + shipping.fee),
      method: shipping.method,
      totalWeightKg,
    };
  }, [profileRows, profileRowsCalculated, selectedProvince]);

  const calcBoardRows = (rows: BoardRow[], priceMap: Record<number, number>) => {
    return rows.map((row) => {
      const width = Math.min(MAX_BOARD_WIDTH_MM, Math.max(0, row.width));
      const height = Math.min(MAX_BOARD_HEIGHT_MM, Math.max(0, row.height));
      const qty = Math.max(0, row.quantity || 0);
      const areaSqm = (width * height) / 1_000_000;
      const chargedArea = areaSqm > 0 && areaSqm < MIN_BOARD_CHARGE_AREA_SQM ? MIN_BOARD_CHARGE_AREA_SQM : areaSqm;
      const unitRate = priceMap[row.thickness] || 0;
      const unitPrice = round1(chargedArea * unitRate);
      const subtotal = round1(unitPrice * qty);
      const minAreaApplied = areaSqm > 0 && areaSqm < MIN_BOARD_CHARGE_AREA_SQM;
      return { row, areaSqm, chargedArea, unitRate, unitPrice, subtotal, minAreaApplied };
    });
  };

  const aluPlateCalculated = useMemo(() => calcBoardRows(aluPlateRows, ALUMINUM_PLATE_PRICE_PER_SQM), [aluPlateRows]);
  const pegboardCalculated = useMemo(() => calcBoardRows(pegboardRows, PEGBOARD_PRICE_PER_SQM), [pegboardRows]);
  const marineBoardCalculated = useMemo(() => calcBoardRows(marineBoardRows, MARINE_BOARD_PRICE_PER_SQM), [marineBoardRows]);

  const frameCalculated = useMemo(() => {
    return frameRows.map((row) => {
      const qty = Math.max(0, row.quantity || 0);
      const unitPrice = round1(Math.max(0, row.innerWidth) + Math.max(0, row.innerHeight));
      const subtotal = round1(unitPrice * qty);
      return { row, unitPrice, subtotal };
    });
  }, [frameRows]);

  const compactSummary = useMemo(() => {
    const profileMetersMap = new Map<string, number>();
    profileRows.forEach((row) => {
      const qty = Math.max(0, row.quantity || 0);
      const lengthMm = Math.max(0, row.length || 0);
      if (qty <= 0 || lengthMm <= 0) return;
      const colorName = (PROFILE_COLORS.find((c) => c.id === row.colorId) || PROFILE_COLORS[0]).name[language];
      const key = `${row.model} · ${colorName}`;
      const prev = profileMetersMap.get(key) || 0;
      profileMetersMap.set(key, prev + (lengthMm * qty) / 1000);
    });

    const summarizeBoardArea = (rowsCalculated: ReturnType<typeof calcBoardRows>) => {
      const byThickness = new Map<number, number>();
      rowsCalculated.forEach((x) => {
        const qty = Math.max(0, x.row.quantity || 0);
        if (qty <= 0 || x.chargedArea <= 0) return;
        const prev = byThickness.get(x.row.thickness) || 0;
        byThickness.set(x.row.thickness, prev + x.chargedArea * qty);
      });
      return Array.from(byThickness.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([thickness, area]) => ({ thickness, area: round1(area) }));
    };

    const frameMetersMap = new Map<FrameType, number>();
    frameRows.forEach((row) => {
      const qty = Math.max(0, row.quantity || 0);
      const w = Math.max(0, row.innerWidth || 0);
      const h = Math.max(0, row.innerHeight || 0);
      if (qty <= 0 || (w + h) <= 0) return;
      const prev = frameMetersMap.get(row.frameType) || 0;
      frameMetersMap.set(row.frameType, prev + ((w + h) * qty) / 100);
    });

    const profileDetails = profileRows
      .map((row) => {
        const qty = safeNonNegative(row.quantity || 0);
        const lengthMm = safeNonNegative(row.length || 0);
        if (qty <= 0 || lengthMm <= 0) return null;
        const colorName = (PROFILE_COLORS.find((c) => c.id === row.colorId) || PROFILE_COLORS[0]).name[language];
        const countParts = [
          { label: t.qq_tappingCount, value: safeNonNegative(row.tappingCount) },
          { label: t.qq_throughHoleCount, value: safeNonNegative(row.throughHoleCount) },
          { label: t.qq_countersunkCount, value: safeNonNegative(row.countersunkHoleCount) },
          { label: t.qq_threadedHoleCount, value: safeNonNegative(row.threadedHoleCount) },
          { label: t.qq_miter45CutCount, value: safeNonNegative(row.miter45CutCount) },
        ]
          .filter((x) => x.value > 0)
          .map((x) => `${x.label}:${x.value}`)
          .join(' · ');
        return {
          id: row.id,
          text: `${row.model} · ${colorName} · ${row.section === 'natural' ? t.qq_sectionNatural : t.qq_sectionColored} · ${lengthMm}mm × ${qty}${countParts ? ` · ${countParts}` : ''}`,
        };
      })
      .filter((x): x is { id: string; text: string } => Boolean(x));

    const profileProcessTotals = profileRows.reduce(
      (acc, row) => {
        const qty = safeNonNegative(row.quantity || 0);
        acc.tapping += safeNonNegative(row.tappingCount || 0) * qty;
        acc.through += safeNonNegative(row.throughHoleCount || 0) * qty;
        acc.countersunk += safeNonNegative(row.countersunkHoleCount || 0) * qty;
        acc.threaded += safeNonNegative(row.threadedHoleCount || 0) * qty;
        acc.miter45 += safeNonNegative(row.miter45CutCount || 0) * qty;
        return acc;
      },
      { tapping: 0, through: 0, countersunk: 0, threaded: 0, miter45: 0 }
    );

    const buildBoardDetails = (rows: BoardRow[]) =>
      rows
        .map((row) => {
          const qty = Math.max(0, row.quantity || 0);
          const width = Math.max(0, row.width || 0);
          const height = Math.max(0, row.height || 0);
          if (qty <= 0 || width <= 0 || height <= 0) return null;
          const colorName = (PROFILE_COLORS.find((c) => c.id === row.colorId) || PROFILE_COLORS[0]).name[language];
          return {
            id: row.id,
            text: `${row.thickness}mm · ${colorName} · ${width}×${height}mm × ${qty}`,
          };
        })
        .filter((x): x is { id: string; text: string } => Boolean(x));

    const frameDetails = frameRows
      .map((row) => {
        const qty = Math.max(0, row.quantity || 0);
        const w = Math.max(0, row.innerWidth || 0);
        const h = Math.max(0, row.innerHeight || 0);
        if (qty <= 0 || (w + h) <= 0) return null;
        const frameTypeLabel =
          row.frameType === 'wood' ? t.qq_woodFrame : row.frameType === 'aluminum' ? t.qq_aluFrame : t.qq_aluWoodFrame;
        return {
          id: row.id,
          text: `${frameTypeLabel} · ${w}×${h}mm × ${qty}`,
        };
      })
      .filter((x): x is { id: string; text: string } => Boolean(x));

    return {
      profileMeters: Array.from(profileMetersMap.entries()).map(([name, meters]) => ({ name, meters: round1(meters) })),
      aluminumPlateArea: summarizeBoardArea(aluPlateCalculated),
      pegboardArea: summarizeBoardArea(pegboardCalculated),
      marineBoardArea: summarizeBoardArea(marineBoardCalculated),
      frameMeters: [
        { type: 'wood' as FrameType, label: t.qq_woodFrame },
        { type: 'aluminum' as FrameType, label: t.qq_aluFrame },
        { type: 'alu_wood' as FrameType, label: t.qq_aluWoodFrame },
      ]
        .map((x) => ({ label: x.label, meters: round1(frameMetersMap.get(x.type) || 0) }))
        .filter((x) => x.meters > 0),
      profileDetails,
      aluminumPlateDetails: buildBoardDetails(aluPlateRows),
      pegboardDetails: buildBoardDetails(pegboardRows),
      marineBoardDetails: marineBoardRows
        .map((row) => {
          const qty = Math.max(0, row.quantity || 0);
          const width = Math.max(0, row.width || 0);
          const height = Math.max(0, row.height || 0);
          if (qty <= 0 || width <= 0 || height <= 0) return null;
          return {
            id: row.id,
            text: `${row.thickness}mm · ${width}×${height}mm × ${qty}`,
          };
        })
        .filter((x): x is { id: string; text: string } => Boolean(x)),
      frameDetails,
      profileProcessTotals,
    };
  }, [
    profileRows,
    language,
    aluPlateCalculated,
    pegboardCalculated,
    marineBoardCalculated,
    frameRows,
    t.qq_woodFrame,
    t.qq_aluFrame,
    t.qq_aluWoodFrame,
    t.qq_sectionNatural,
    t.qq_sectionColored,
    t.qq_tappingCount,
    t.qq_throughHoleCount,
    t.qq_countersunkCount,
    t.qq_threadedHoleCount,
    t.qq_miter45CutCount,
    aluPlateRows,
    pegboardRows,
    marineBoardRows,
  ]);

  const categorySummary = useMemo(() => {
    const aluminumPlateItemTotal = round1(aluPlateCalculated.reduce((sum, x) => sum + x.subtotal, 0));
    const pegboardItemTotal = round1(pegboardCalculated.reduce((sum, x) => sum + x.subtotal, 0));
    const marineBoardItemTotal = round1(marineBoardCalculated.reduce((sum, x) => sum + x.subtotal, 0));
    const frameItemTotal = round1(frameCalculated.reduce((sum, x) => sum + x.subtotal, 0));

    const categories = [
      {
        key: 'profile',
        name: t.qq_aluminumProfile,
        itemTotal: profileSummary.itemTotal,
        shippingFee: profileSummary.shippingFee,
        total: profileSummary.categoryTotal,
      },
      {
        key: 'aluminum_plate',
        name: t.qq_aluminumPlate,
        itemTotal: aluminumPlateItemTotal,
        shippingFee: 0,
        total: aluminumPlateItemTotal,
      },
      {
        key: 'pegboard',
        name: t.qq_pegboard,
        itemTotal: pegboardItemTotal,
        shippingFee: 0,
        total: pegboardItemTotal,
      },
      {
        key: 'marine_board',
        name: t.qq_marineBoard,
        itemTotal: marineBoardItemTotal,
        shippingFee: 0,
        total: marineBoardItemTotal,
      },
      {
        key: 'frame',
        name: t.qq_frame,
        itemTotal: frameItemTotal,
        shippingFee: 0,
        total: frameItemTotal,
      },
    ].filter((c) => c.itemTotal > 0);

    const grandTotal = round1(categories.reduce((sum, c) => sum + c.total, 0));
    return { categories, grandTotal };
  }, [
    t.qq_aluminumProfile,
    t.qq_aluminumPlate,
    t.qq_pegboard,
    t.qq_marineBoard,
    t.qq_frame,
    profileSummary,
    aluPlateCalculated,
    pegboardCalculated,
    marineBoardCalculated,
    frameCalculated,
  ]);

  const updateProfileRow = (id: string, patch: Partial<ProfileRow>) => {
    setProfileRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const updateBoardRows = (setter: React.Dispatch<React.SetStateAction<BoardRow[]>>, id: string, patch: Partial<BoardRow>) => {
    setter((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const updateFrameRow = (id: string, patch: Partial<FrameRow>) => {
    setFrameRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const renderBoardEditor = (
    rows: BoardRow[],
    rowsCalculated: ReturnType<typeof calcBoardRows>,
    setter: React.Dispatch<React.SetStateAction<BoardRow[]>>,
    thicknessOptions: number[],
    defaultThickness: number,
    showColorSelector = false
  ) => {
    return (
      <div className="space-y-4">
        {rows.map((row, index) => {
          const calc = rowsCalculated[index];
          const boardColor = PROFILE_COLORS.find((c) => c.id === row.colorId) || PROFILE_COLORS[0];
          return (
            <div key={row.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_thickness} (mm)</label>
                  <select
                    value={row.thickness}
                    onChange={(e) => updateBoardRows(setter, row.id, { thickness: Number(e.target.value) })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                  >
                    {thicknessOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}mm
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_width}</label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_BOARD_WIDTH_MM}
                    value={row.width}
                    onChange={(e) => updateBoardRows(setter, row.id, { width: Math.min(MAX_BOARD_WIDTH_MM, Number(e.target.value) || 0) })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_height}</label>
                  <input
                    type="number"
                    min={1}
                    max={MAX_BOARD_HEIGHT_MM}
                    value={row.height}
                    onChange={(e) => updateBoardRows(setter, row.id, { height: Math.min(MAX_BOARD_HEIGHT_MM, Number(e.target.value) || 0) })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                  />
                </div>
              </div>

              <div className={`grid gap-2 sm:gap-3 ${showColorSelector ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {showColorSelector && (
                  <div>
                    <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_color}</label>
                    <select
                      value={row.colorId}
                      onChange={(e) => updateBoardRows(setter, row.id, { colorId: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                    >
                      {PROFILE_COLORS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name[language]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_quantity}</label>
                  <input
                    type="number"
                    min={0}
                    value={row.quantity}
                    onChange={(e) => updateBoardRows(setter, row.id, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => setter((prev) => prev.filter((r) => r.id !== row.id))}
                    className="w-full px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-bold text-sm flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-4 h-4" /> {t.qq_removeRow}
                  </button>
                </div>
              </div>

              <div className="text-sm text-slate-600 flex flex-wrap items-center gap-x-5 gap-y-1">
                <span>
                  {t.qq_area}: {calc.areaSqm.toFixed(3)} {t.qq_sqm}
                </span>
                <span>
                  {t.qq_unitPrice}: {currency}{calc.unitPrice.toFixed(1)} {t.qq_eachPiece}
                </span>
                <span className="font-black text-blue-600">
                  {t.qq_subtotal}: {currency}{calc.subtotal.toFixed(1)}
                </span>
                {showColorSelector && (
                  <span>
                    {t.qq_color}: {boardColor.name[language]}
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-slate-500">{t.qq_boardMaxSizeNote}</div>
              {calc.minAreaApplied && <div className="text-xs font-bold text-amber-600">⚠ {t.qq_minAreaWarning}</div>}
            </div>
          );
        })}

        <button
          onClick={() => setter((prev) => [...prev, { ...createBoardRow(defaultThickness), quantity: 1 }])}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> {t.qq_addRow}
        </button>
      </div>
    );
  };

  const quickProductOptions: Array<{ value: QuickQuoteProduct; label: string }> = [
    { value: 'profile', label: t.qq_aluminumProfile },
    { value: 'aluminum_plate', label: t.qq_aluminumPlate },
    { value: 'pegboard', label: t.qq_pegboard },
    { value: 'marine_board', label: t.qq_marineBoard },
    { value: 'frame', label: t.qq_frame },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="bg-white border border-slate-100 rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 space-y-6">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900">{t.quickQuote}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_selectProvince}</label>
            <select
              value={selectedProvince}
              onChange={(e) => setSelectedProvince(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-3 bg-slate-50"
            >
              <option value="">{t.selectProvince}</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_selectProduct}</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value as QuickQuoteProduct)}
              className="w-full border border-slate-200 rounded-xl px-3 py-3 bg-slate-50"
            >
              {quickProductOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedProduct === 'profile' && (
          <div className="space-y-4">
            {profileRows.map((row, index) => {
              const calc = profileRowsCalculated[index];
              const color = PROFILE_COLORS.find((c) => c.id === row.colorId) || PROFILE_COLORS[0];
              const shouldShowDangerFee = row.length > 0 && row.length <= PROFILE_DANGER_FEE_THRESHOLD_MM;
              const colorOnlyColoredSection = COLOR_ONLY_COLORED_SECTION_IDS.includes(row.colorId as any);
              return (
                <div key={row.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_model}</label>
                      <select
                        value={row.model}
                        onChange={(e) => updateProfileRow(row.id, { model: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                      >
                        {PROFILE_VARIANTS.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_length}</label>
                      <input
                        type="number"
                        min={1}
                        max={MAX_PROFILE_LENGTH_MM}
                        value={row.length === 0 ? '' : row.length}
                        onChange={(e) => updateProfileRow(row.id, { length: e.target.value === '' ? 0 : Math.min(MAX_PROFILE_LENGTH_MM, Number(e.target.value) || 0) })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_color}</label>
                      <select
                        value={row.colorId}
                        onChange={(e) => {
                          const nextColorId = e.target.value;
                          const restricted = COLOR_ONLY_COLORED_SECTION_IDS.includes(nextColorId as any);
                          updateProfileRow(row.id, {
                            colorId: nextColorId,
                            section: nextColorId === 'natural' ? 'natural' : restricted ? 'colored' : row.section,
                          });
                        }}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                      >
                        {PROFILE_COLORS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name[language]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_section}</label>
                      <select
                        value={row.section}
                        onChange={(e) => updateProfileRow(row.id, { section: e.target.value as ProfileSection })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                      >
                        {row.colorId === 'natural' ? (
                          <option value="natural">{t.qq_sectionNatural}</option>
                        ) : (
                          <>
                            {!colorOnlyColoredSection && <option value="natural">{t.qq_sectionNatural}</option>}
                            <option value="colored">{t.qq_sectionColored}</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  {colorOnlyColoredSection && (
                    <div className="text-xs font-bold text-slate-500">{t.qq_coloredSectionOnly}</div>
                  )}

                  <div className="overflow-x-auto -mx-1 px-1">
                    <div className="grid grid-cols-5 gap-1.5 min-w-[560px]">
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 mb-1 leading-tight">{buildPerPieceLabel(t.qq_tappingCount)}</label>
                      <input
                        type="number"
                        min={0}
                        value={row.tappingCount === 0 ? '' : row.tappingCount}
                        onChange={(e) => updateProfileRow(row.id, { tappingCount: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 mb-1 leading-tight">{buildPerPieceLabel(t.qq_throughHoleCount)}</label>
                      <input
                        type="number"
                        min={0}
                        value={row.throughHoleCount === 0 ? '' : row.throughHoleCount}
                        onChange={(e) => updateProfileRow(row.id, { throughHoleCount: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 mb-1 leading-tight">{buildPerPieceLabel(t.qq_countersunkCount)}</label>
                      <input
                        type="number"
                        min={0}
                        value={row.countersunkHoleCount === 0 ? '' : row.countersunkHoleCount}
                        onChange={(e) => updateProfileRow(row.id, { countersunkHoleCount: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 mb-1 leading-tight">{buildPerPieceLabel(t.qq_threadedHoleCount)}</label>
                      <input
                        type="number"
                        min={0}
                        value={row.threadedHoleCount === 0 ? '' : row.threadedHoleCount}
                        onChange={(e) => updateProfileRow(row.id, { threadedHoleCount: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 mb-1 leading-tight">{buildPerPieceLabel(t.qq_miter45CutCount)}</label>
                      <input
                        type="number"
                        min={0}
                        value={row.miter45CutCount === 0 ? '' : row.miter45CutCount}
                        onChange={(e) => updateProfileRow(row.id, { miter45CutCount: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full border border-slate-200 rounded-lg px-1.5 py-1.5 text-xs bg-white"
                      />
                    </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_quantity}</label>
                      <input
                        type="number"
                        min={0}
                        value={row.quantity === 0 ? '' : row.quantity}
                        onChange={(e) => updateProfileRow(row.id, { quantity: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => setProfileRows((prev) => prev.filter((r) => r.id !== row.id))}
                        className="w-full px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-bold text-sm inline-flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> {t.qq_removeRow}
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-slate-600 flex flex-wrap items-center gap-x-5 gap-y-1">
                    <span>
                      {t.qq_unitPrice}: {currency}{calc.unitPrice.toFixed(1)} {t.qq_eachPiece}
                    </span>
                    <span className="font-black text-blue-600">
                      {t.qq_subtotal}: {currency}{calc.subtotal.toFixed(1)}
                    </span>
                    <span>
                      {t.qq_color}: {color.name[language]}
                    </span>
                  </div>

                  <div className="text-xs font-bold text-slate-500">{t.qq_profileMaxLengthNote}</div>

                  {shouldShowDangerFee && (
                    <div className="text-xs font-bold text-amber-700">⚠ {t.dangerFeeSurcharge}</div>
                  )}
                </div>
              );
            })}

            <button
              onClick={() =>
                setProfileRows((prev) => {
                  const first = prev[0] || createProfileRow();
                  return [
                    ...prev,
                    {
                      ...createProfileRow(),
                      model: first.model,
                      colorId: first.colorId,
                      section: first.section,
                      quantity: 1,
                    },
                  ];
                })
              }
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {t.qq_addRow}
            </button>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm space-y-1">
              <div className="font-bold text-blue-700">{t.qq_profileShippingNote}</div>
              <div className="text-slate-700">
                {t.qq_cheapestCourier}:{' '}
                <span className="font-black">
                  {profileSummary.method ? SHIPPING_METHOD_NAMES[profileSummary.method][language] : '-'}
                </span>
              </div>
              {!selectedProvince && <div className="text-amber-700 font-bold">{t.qq_selectProvince}</div>}
            </div>
          </div>
        )}

        {selectedProduct === 'aluminum_plate' && renderBoardEditor(aluPlateRows, aluPlateCalculated, setAluPlateRows, [1, 2, 3, 4, 5], 2, true)}
        {selectedProduct === 'pegboard' && renderBoardEditor(pegboardRows, pegboardCalculated, setPegboardRows, [1, 2, 3, 4, 5], 2, true)}
        {selectedProduct === 'marine_board' && renderBoardEditor(marineBoardRows, marineBoardCalculated, setMarineBoardRows, [6, 9, 12, 15, 18], 18)}

        {selectedProduct === 'frame' && (
          <div className="space-y-4">
            {frameRows.map((row, index) => {
              const calc = frameCalculated[index];
              return (
                <div key={row.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-5 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_frameType}</label>
                      <select
                        value={row.frameType}
                        onChange={(e) => updateFrameRow(row.id, { frameType: e.target.value as FrameType })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                      >
                        <option value="wood">{t.qq_woodFrame}</option>
                        <option value="aluminum">{t.qq_aluFrame}</option>
                        <option value="alu_wood">{t.qq_aluWoodFrame}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_innerWidth}</label>
                      <input
                        type="number"
                        min={1}
                        value={row.innerWidth}
                        onChange={(e) => updateFrameRow(row.id, { innerWidth: Number(e.target.value) || 0 })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_innerHeight}</label>
                      <input
                        type="number"
                        min={1}
                        value={row.innerHeight}
                        onChange={(e) => updateFrameRow(row.id, { innerHeight: Number(e.target.value) || 0 })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black text-slate-500 mb-1">{t.qq_quantity}</label>
                      <input
                        type="number"
                        min={0}
                        value={row.quantity === 0 ? '' : row.quantity}
                        onChange={(e) => updateFrameRow(row.id, { quantity: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => setFrameRows((prev) => prev.filter((r) => r.id !== row.id))}
                        className="w-full px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 font-bold text-sm inline-flex items-center justify-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" /> {t.qq_removeRow}
                      </button>
                    </div>
                  </div>

                  <div className="text-sm text-slate-600 flex flex-wrap items-center gap-x-5 gap-y-1">
                    <span>{t.qq_priceFormula}</span>
                    <span>
                      {t.qq_unitPrice}: {currency}{calc.unitPrice.toFixed(1)} {t.qq_perUnit}
                    </span>
                    <span className="font-black text-blue-600">
                      {t.qq_subtotal}: {currency}{calc.subtotal.toFixed(1)}
                    </span>
                    <span className="text-green-700 font-bold">{t.qq_freeShipping}</span>
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => setFrameRows((prev) => [...prev, { ...createFrameRow(), quantity: 1 }])}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-sm inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> {t.qq_addRow}
            </button>
          </div>
        )}

        <button
          onClick={() => setShowSummary(true)}
          className="w-full md:w-auto px-6 py-3 rounded-xl bg-blue-600 text-white font-black text-sm"
        >
          {t.qq_calculateQuote}
        </button>
      </div>

      {showSummary && !selectedProvince && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-3xl shadow-sm p-4 sm:p-6 md:p-8">
          <div className="text-amber-800 font-black text-base sm:text-lg">⚠ {t.qq_selectProvince}</div>
        </div>
      )}

      {showSummary && selectedProvince && (
        <div className="mt-6 bg-white border border-slate-100 rounded-3xl shadow-xl p-4 sm:p-6 md:p-8">
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-4">{t.qq_categorySummary}</h3>
          {categorySummary.categories.length === 0 ? (
            <div className="text-slate-500">{t.qq_noItems}</div>
          ) : (
            <div className="space-y-3">
              {categorySummary.categories.map((cat) => (
                <div key={cat.key} className="border border-slate-100 rounded-2xl p-4 bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black text-slate-800">{cat.name}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => clearCategory(cat.key as QuickQuoteProduct)}
                        className="px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-600 text-xs font-bold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> {t.qq_removeRow}
                      </button>
                      <div className="font-black text-blue-600">
                        {currency}{cat.total.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {t.qq_itemTotal}: {currency}{cat.itemTotal.toFixed(1)}
                  </div>
                  <div className="text-sm text-slate-600">
                    {t.qq_shippingFee}: {currency}{cat.shippingFee.toFixed(1)}
                    {cat.key === 'profile' ? ` (${t.qq_shippingExtra})` : ` (${t.qq_shippingIncluded})`}
                  </div>
                </div>
              ))}

              <div className="mt-4 border-t border-slate-200 pt-4 flex items-center justify-between">
                <div className="text-lg sm:text-xl font-black text-slate-800">{t.qq_grandTotal}</div>
                <div className="text-2xl sm:text-3xl font-black text-blue-600">
                  {currency}{categorySummary.grandTotal.toFixed(1)}
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4 space-y-2">
                <div className="text-base font-black text-slate-800">{t.qq_compactSummary}</div>
                {selectedProvince && (
                  <div className="text-sm font-semibold text-slate-700">
                    {t.qq_shippingProvince}: <span className="text-slate-900">{selectedProvince}</span>
                  </div>
                )}

                {compactSummary.profileMeters.length > 0 && (
                  <div className="text-sm text-slate-700">
                    <div className="font-bold text-slate-800">{t.qq_profileMetersByModelColor}</div>
                    <ul className="list-disc pl-5 mt-1 space-y-1 font-semibold text-slate-700">
                      {compactSummary.profileMeters.map((x) => (
                        <li key={x.name}>{x.name}: {x.meters.toFixed(1)} {t.qq_meter}</li>
                      ))}
                    </ul>
                    <ul className="list-disc pl-5 mt-2 space-y-1 font-semibold text-slate-700">
                      {compactSummary.profileProcessTotals.tapping > 0 && <li>{t.qq_tappingCount}: {compactSummary.profileProcessTotals.tapping}</li>}
                      {compactSummary.profileProcessTotals.through > 0 && <li>{t.qq_throughHoleCount}: {compactSummary.profileProcessTotals.through}</li>}
                      {compactSummary.profileProcessTotals.countersunk > 0 && <li>{t.qq_countersunkCount}: {compactSummary.profileProcessTotals.countersunk}</li>}
                      {compactSummary.profileProcessTotals.threaded > 0 && <li>{t.qq_threadedHoleCount}: {compactSummary.profileProcessTotals.threaded}</li>}
                      {compactSummary.profileProcessTotals.miter45 > 0 && <li>{t.qq_miter45CutCount}: {compactSummary.profileProcessTotals.miter45}</li>}
                    </ul>
                    {compactSummary.profileDetails.length > 0 && (
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-slate-500">
                        {compactSummary.profileDetails.map((x) => (
                          <li key={`profile-detail-${x.id}`}>{x.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {compactSummary.aluminumPlateArea.length > 0 && (
                  <div className="text-sm text-slate-700">
                    <div className="font-bold text-slate-800">{t.qq_aluminumPlate} - {t.qq_boardAreaByThickness}</div>
                    <ul className="list-disc pl-5 mt-1 space-y-1 font-semibold text-slate-700">
                      {compactSummary.aluminumPlateArea.map((x) => (
                        <li key={`alu-${x.thickness}`}>{x.thickness}mm: {x.area.toFixed(1)} {t.qq_sqm}</li>
                      ))}
                    </ul>
                    {compactSummary.aluminumPlateDetails.length > 0 && (
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-slate-500">
                        {compactSummary.aluminumPlateDetails.map((x) => (
                          <li key={`alu-detail-${x.id}`}>{x.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {compactSummary.pegboardArea.length > 0 && (
                  <div className="text-sm text-slate-700">
                    <div className="font-bold text-slate-800">{t.qq_pegboard} - {t.qq_boardAreaByThickness}</div>
                    <ul className="list-disc pl-5 mt-1 space-y-1 font-semibold text-slate-700">
                      {compactSummary.pegboardArea.map((x) => (
                        <li key={`peg-${x.thickness}`}>{x.thickness}mm: {x.area.toFixed(1)} {t.qq_sqm}</li>
                      ))}
                    </ul>
                    {compactSummary.pegboardDetails.length > 0 && (
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-slate-500">
                        {compactSummary.pegboardDetails.map((x) => (
                          <li key={`peg-detail-${x.id}`}>{x.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {compactSummary.marineBoardArea.length > 0 && (
                  <div className="text-sm text-slate-700">
                    <div className="font-bold text-slate-800">{t.qq_marineBoard} - {t.qq_boardAreaByThickness}</div>
                    <ul className="list-disc pl-5 mt-1 space-y-1 font-semibold text-slate-700">
                      {compactSummary.marineBoardArea.map((x) => (
                        <li key={`marine-${x.thickness}`}>{x.thickness}mm: {x.area.toFixed(1)} {t.qq_sqm}</li>
                      ))}
                    </ul>
                    {compactSummary.marineBoardDetails.length > 0 && (
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-slate-500">
                        {compactSummary.marineBoardDetails.map((x) => (
                          <li key={`marine-detail-${x.id}`}>{x.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {compactSummary.frameMeters.length > 0 && (
                  <div className="text-sm text-slate-700">
                    <div className="font-bold text-slate-800">{t.qq_frameLengthByType}</div>
                    <ul className="list-disc pl-5 mt-1 space-y-1 font-semibold text-slate-700">
                      {compactSummary.frameMeters.map((x) => (
                        <li key={x.label}>{x.label}: {x.meters.toFixed(1)} {t.qq_meter}</li>
                      ))}
                    </ul>
                    {compactSummary.frameDetails.length > 0 && (
                      <ul className="list-disc pl-5 mt-2 space-y-1 text-xs text-slate-500">
                        {compactSummary.frameDetails.map((x) => (
                          <li key={`frame-detail-${x.id}`}>{x.text}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuickQuote;
