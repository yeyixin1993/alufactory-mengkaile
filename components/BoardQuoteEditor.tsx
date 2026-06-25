import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Language, Product, CartItem, User } from '../types';
import { TRANSLATIONS, PROFILE_COLORS } from '../constants';

interface BoardQuoteEditorProps {
  language: Language;
  product: Product;
  user?: User | null;
  initialItem?: CartItem;
  returnCartPath?: string;
  onAddToCart: (item: CartItem) => void;
  onUpdateItem: (item: CartItem) => void;
}

const PEGBOARD_PRICE_PER_SQM: Record<number, number> = { 1: 780, 2: 1080, 3: 1380, 4: 1680, 5: 1980 };
const ALUMINUM_PLATE_PRICE_PER_SQM: Record<number, number> = { 1: 500, 2: 700, 3: 1000, 4: 1300, 5: 1600 };
const MARINE_BOARD_PRICE_PER_SQM: Record<number, number> = { 6: 100, 9: 130, 12: 155, 15: 175, 18: 200 };
const MIN_BOARD_CHARGE_AREA_SQM = 0.2;
const MAX_BOARD_WIDTH_MM = 2400;
const MAX_BOARD_HEIGHT_MM = 1200;
const MARINE_BOARD_MAX_WIDTH_MM = 2440;
const MARINE_BOARD_MAX_HEIGHT_MM = 1220;
const MAX_DOOR_HEIGHT_MM = 3000;
const MAX_DOOR_WIDTH_MM = 1500;
const DOOR_HINGE_UNIT_PRICE = 10;

const getCurrency = (lang: Language) => (lang === 'cn' ? '￥' : '$');

const UI_TEXT: Record<Language, {
  openingSide: string;
  leftOpen: string;
  rightOpen: string;
  doorNote: string;
  previewTitle: string;
  handle: string;
  hinge: string;
  widthHeightHint: string;
  unavailable: string;
  widthShort: string;
  heightShort: string;
  rangeError: string;
  hingeGap: string;
  hingeFee: string;
  diagramNotice: string;
  wechatNotice: string;
  doorSizeLimit: string;
  pegboardLimit: string;
  pegboardRangeText: string;
}> = {
  cn: {
    openingSide: '开门方向',
    leftOpen: '左开',
    rightOpen: '右开',
    doorNote: '注：门板厚度2mm；门框厚度18mm；拉手默认200mm并居中。',
    previewTitle: '预览图',
    handle: '拉手',
    hinge: '铰链',
    widthHeightHint: '宽×高',
    unavailable: '暂不可选',
    widthShort: '宽',
    heightShort: '高',
    rangeError: '请输入正确范围内的数值',
    hingeGap: '铰链间距',
    hingeFee: '铰链费',
    diagramNotice: '示意图仅供参考，实际以下单图纸为准。',
    wechatNotice: '下单后请添加微信19821200413，确认图纸后下单生产。',
    doorSizeLimit: '提示：最大单扇门不能超过1.5 × 3 米。',
    pegboardLimit: '最大单块板子不能超过1200×2400或2400×1200。',
    pegboardRangeText: '请输入正确范围内的数值（宽: 101-2400mm, 高: 101-2400mm）',
  },
  en: {
    openingSide: 'Opening Side',
    leftOpen: 'Left Open',
    rightOpen: 'Right Open',
    doorNote: 'Note: panel 2mm, frame 18mm, default centered handle length 200mm.',
    previewTitle: 'Preview',
    handle: 'Handle',
    hinge: 'Hinge',
    widthHeightHint: 'W×H',
    unavailable: 'Unavailable',
    widthShort: 'W',
    heightShort: 'H',
    rangeError: 'Please enter values within the valid range',
    hingeGap: 'Hinge spacing',
    hingeFee: 'Hinge fee',
    diagramNotice: 'Diagram is for reference only; final production follows confirmed drawing.',
    wechatNotice: 'After placing order, add WeChat 19821200413 to confirm drawing before production.',
    doorSizeLimit: 'Note: max single door leaf is 1.5 × 3 m.',
    pegboardLimit: 'Max single board cannot exceed 1200×2400 or 2400×1200.',
    pegboardRangeText: 'Please enter values within range (W: 101-2400mm, H: 101-2400mm)',
  },
  jp: {
    openingSide: '開閉方向',
    leftOpen: '左開き',
    rightOpen: '右開き',
    doorNote: '注: パネル2mm、フレーム18mm、取っ手は200mmで中央。',
    previewTitle: 'プレビュー',
    handle: '取っ手',
    hinge: 'ヒンジ',
    widthHeightHint: '幅×高',
    unavailable: '選択不可',
    widthShort: '幅',
    heightShort: '高',
    rangeError: '有効範囲内の数値を入力してください',
    hingeGap: 'ヒンジ間隔',
    hingeFee: 'ヒンジ費用',
    diagramNotice: '図は参考用です。実際は確定図面に従います。',
    wechatNotice: '注文後はWeChat 19821200413を追加し、図面確認後に生産します。',
    doorSizeLimit: '注: 扉1枚の最大は1.5 × 3mです。',
    pegboardLimit: '最大板サイズは1200×2400または2400×1200まで。',
    pegboardRangeText: '有効範囲内で入力してください（幅:101-2400mm, 高:101-2400mm）',
  },
};

const getDoorHingePositions = (heightMm: number): number[] => {
  const h = Math.max(0, Math.min(MAX_DOOR_HEIGHT_MM, Number(heightMm) || 0));
  if (h <= 0) return [];
  if (h <= 1500) return [100, h - 100];
  if (h <= 2000) return [100, h / 2, h - 100];
  if (h <= 2500) {
    const top = 100;
    const bottom = h - 100;
    const step = (bottom - top) / 3;
    return [top, top + step, top + step * 2, bottom];
  }
  return [100, (h - 200) * 0.25 + 100, h / 2, (h - 200) * 0.75 + 100, h - 100];
};

const BoardQuoteEditor: React.FC<BoardQuoteEditorProps> = ({ language, product, initialItem, returnCartPath = '/cart', onAddToCart, onUpdateItem }) => {
  const t = TRANSLATIONS[language];
  const ui = UI_TEXT[language];
  const navigate = useNavigate();
  const currency = getCurrency(language);
  const isPegboard = product.id === 'p1';
  const isDoor = product.id === 'p3';
  const isAluminumPlate = product.id === 'p5';
  const isMarineBoard = product.id === 'p6';
  const marineBoardColor = {
    id: 'marine_bbb_uv_film',
    name: {
      cn: 'BBB两面UV清漆+覆膜',
      en: 'BBB double-side UV varnish + film',
      jp: 'BBB両面UVクリア+フィルム',
    } as Record<Language, string>,
  };

  const getPriceMap = (): Record<number, number> => {
    if (isPegboard) return PEGBOARD_PRICE_PER_SQM;
    if (isAluminumPlate) return ALUMINUM_PLATE_PRICE_PER_SQM;
    if (isMarineBoard) return MARINE_BOARD_PRICE_PER_SQM;
    if (isDoor) return { 2: ALUMINUM_PLATE_PRICE_PER_SQM[2] || 700 };
    return ALUMINUM_PLATE_PRICE_PER_SQM;
  };

  const priceMap = getPriceMap();
  const allThicknessOptions = isMarineBoard ? [6, 9, 12, 15, 18] : [1, 2, 3, 4, 5];
  const allowedThicknessSet = new Set<number>(
    isPegboard || isAluminumPlate
      ? [2, 5]
      : isMarineBoard
        ? [12, 18]
        : isDoor
          ? [2]
          : allThicknessOptions
  );
  const defaultThickness = isDoor ? 2 : (allThicknessOptions.find((x) => allowedThicknessSet.has(x)) || 2);

  const initialCfg = (initialItem?.config || {}) as any;
  const [thickness, setThickness] = useState<number>(allowedThicknessSet.has(initialCfg.thickness) ? initialCfg.thickness : defaultThickness);
  const [colorId, setColorId] = useState<string>(
    isMarineBoard
      ? marineBoardColor.id
      : (initialCfg.colorId || 'natural')
  );
  const defaultWidth = (isPegboard || isDoor) ? 500 : 0;
  const defaultHeight = (isPegboard || isDoor) ? 2000 : 0;
  const [width, setWidth] = useState<number>(initialCfg.width || defaultWidth);
  const [height, setHeight] = useState<number>(initialCfg.height || defaultHeight);
  const [quantity, setQuantity] = useState<number>(initialItem?.quantity || initialCfg.quantity || 1);
  const [openingSide, setOpeningSide] = useState<'left' | 'right'>(initialCfg.openingSide === 'right' ? 'right' : 'left');

  const maxHeight = isDoor
    ? MAX_DOOR_HEIGHT_MM
    : isPegboard
      ? 2400
      : isMarineBoard
        ? MARINE_BOARD_MAX_HEIGHT_MM
        : MAX_BOARD_HEIGHT_MM;
  const minWidth = (isPegboard || isDoor) ? 101 : 1;
  const minHeight = isDoor ? 230 : ((isPegboard || isDoor) ? 101 : 1);
  const maxWidth = isDoor ? MAX_DOOR_WIDTH_MM : (isMarineBoard ? MARINE_BOARD_MAX_WIDTH_MM : MAX_BOARD_WIDTH_MM);

  const effectiveThickness = isDoor ? 2 : thickness;
  const rawWidth = Number(width) || 0;
  const rawHeight = Number(height) || 0;
  const widthOutOfRange = rawWidth < minWidth || rawWidth > maxWidth;
  const heightOutOfRange = rawHeight < minHeight || rawHeight > maxHeight;
  const pegboardShapeInvalid = isPegboard && rawWidth > 0 && rawHeight > 0 && !(Math.min(rawWidth, rawHeight) <= 1200 && Math.max(rawWidth, rawHeight) <= 2400);
  const hasRangeError = widthOutOfRange || heightOutOfRange || pegboardShapeInvalid;

  const calc = useMemo(() => {
    const w = Math.min(maxWidth, Math.max(0, Number(width) || 0));
    const h = Math.min(maxHeight, Math.max(0, Number(height) || 0));
    const qty = Math.max(1, Number(quantity) || 1);
    const areaSqm = (w * h) / 1_000_000;
    const chargedArea = areaSqm > 0 && areaSqm < MIN_BOARD_CHARGE_AREA_SQM ? MIN_BOARD_CHARGE_AREA_SQM : areaSqm;
    const unitRate = priceMap[effectiveThickness] || 0;
    const boardUnitPrice = Number((chargedArea * unitRate).toFixed(1));
    const hingeCount = isDoor ? getDoorHingePositions(h).length : 0;
    const hingeFeePerPiece = isDoor ? hingeCount * DOOR_HINGE_UNIT_PRICE : 0;
    const unitPrice = Number((boardUnitPrice + hingeFeePerPiece).toFixed(1));
    const subtotal = Number((unitPrice * qty).toFixed(1));
    const minAreaApplied = areaSqm > 0 && areaSqm < MIN_BOARD_CHARGE_AREA_SQM;

    return { w, h, qty, areaSqm, chargedArea, unitRate, boardUnitPrice, hingeCount, hingeFeePerPiece, unitPrice, subtotal, minAreaApplied };
  }, [width, height, quantity, effectiveThickness, maxHeight, maxWidth, isDoor]);

  const hingePositions = useMemo(() => (isDoor ? getDoorHingePositions(calc.h) : []), [isDoor, calc.h]);
  const hingeGaps = useMemo(() => {
    if (!isDoor || hingePositions.length < 2) return [] as number[];
    const gaps: number[] = [];
    for (let i = 0; i < hingePositions.length - 1; i++) {
      gaps.push(Number((hingePositions[i + 1] - hingePositions[i]).toFixed(1)));
    }
    return gaps;
  }, [isDoor, hingePositions]);
  const topOffset = useMemo(() => (isDoor && hingePositions.length ? Number(hingePositions[0].toFixed(1)) : 0), [isDoor, hingePositions]);
  const bottomOffset = useMemo(() => (isDoor && hingePositions.length ? Number((calc.h - hingePositions[hingePositions.length - 1]).toFixed(1)) : 0), [isDoor, hingePositions, calc.h]);

  const buildItem = (): CartItem => {
    const config = {
      thickness: effectiveThickness,
      colorId,
      colorName: isMarineBoard ? marineBoardColor.name[language] : undefined,
      width: calc.w,
      height: calc.h,
      unitPrice: calc.unitPrice,
      areaSqm: calc.areaSqm,
      chargedArea: calc.chargedArea,
      unitRate: calc.unitRate,
      minAreaApplied: calc.minAreaApplied,
      ...(isDoor
        ? {
            openingSide,
            panelThickness: 2,
            frameThickness: 18,
            handleLength: 200,
            handlePosition: openingSide === 'left' ? 'right_center' : 'left_center',
            hingeSide: openingSide === 'left' ? 'left' : 'right',
            hingePositions,
            hingeCount: hingePositions.length,
            hingeUnitPrice: DOOR_HINGE_UNIT_PRICE,
            hingeFeePerPiece: calc.hingeFeePerPiece,
            hingeGaps,
            topHingeOffset: topOffset,
            bottomHingeOffset: bottomOffset,
          }
        : {}),
    };

    if (initialItem) {
      return {
        ...initialItem,
        quantity: calc.qty,
        config,
        totalPrice: calc.subtotal,
      };
    }

    return {
      id: Math.random().toString(36).slice(2, 10),
      product,
      quantity: calc.qty,
      config,
      totalPrice: calc.subtotal,
    };
  };

  const handleSubmit = () => {
    if (calc.w <= 0 || calc.h <= 0) {
      alert(language === 'cn' ? '请填写宽和高' : language === 'jp' ? '幅と高さを入力してください' : 'Please enter width and height');
      return;
    }

    if (hasRangeError) {
      if (isPegboard) {
        alert(`${ui.pegboardRangeText}，${ui.pegboardLimit}`);
      } else {
        alert(`${ui.rangeError}（${ui.widthShort}: ${minWidth}-${maxWidth}mm, ${ui.heightShort}: ${minHeight}-${maxHeight}mm）`);
      }
      return;
    }

    if (initialItem) {
      onUpdateItem(buildItem());
    } else {
      onAddToCart(buildItem());
    }
    navigate(returnCartPath);
  };

  return (
    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl space-y-6">
      <h3 className="text-2xl font-black text-slate-800">{t.configure}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t.qq_thickness || '厚度'}</label>
          <select
            value={effectiveThickness}
            onChange={(e) => setThickness(Number(e.target.value))}
            disabled={isDoor}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-slate-50 font-black text-slate-700 disabled:opacity-60"
          >
            {allThicknessOptions.map((x) => (
              <option key={x} value={x} disabled={!allowedThicknessSet.has(x)}>
                {x}mm{allowedThicknessSet.has(x) ? '' : ` (${ui.unavailable})`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t.qq_width || '宽 (mm)'}</label>
          <input
            type="number"
            min={minWidth}
            max={maxWidth}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value) || 0)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-slate-50 font-black text-slate-700"
          />
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t.qq_height || '高 (mm)'}</label>
          <input
            type="number"
            min={minHeight}
            max={maxHeight}
            value={height}
            onChange={(e) => setHeight(Number(e.target.value) || 0)}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-slate-50 font-black text-slate-700"
          />
        </div>

        {isDoor && (
          <div>
            <label className="block text-xs font-black text-slate-400 uppercase mb-2">{ui.openingSide}</label>
            <select
              value={openingSide}
              onChange={(e) => setOpeningSide(e.target.value === 'right' ? 'right' : 'left')}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-slate-50 font-black text-slate-700"
            >
              <option value="left">{ui.leftOpen}</option>
              <option value="right">{ui.rightOpen}</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t.qq_color || '颜色'}</label>
          <select
            value={colorId}
            onChange={(e) => setColorId(e.target.value)}
            disabled={isMarineBoard}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-slate-50 font-black text-slate-700"
          >
            {isMarineBoard ? (
              <option value={marineBoardColor.id}>{marineBoardColor.name[language]}</option>
            ) : (
              PROFILE_COLORS.map((c) => (
                <option key={c.id} value={c.id}>{c.name[language]}</option>
              ))
            )}
          </select>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-400 uppercase mb-2">{t.qq_quantity || '数量'}</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none bg-slate-50 font-black text-slate-700"
          />
        </div>
      </div>

      {hasRangeError && (
        <div className="text-xs font-bold text-red-600">
          {isPegboard
            ? `${ui.pegboardRangeText}，${ui.pegboardLimit}`
            : `${ui.rangeError}（${ui.widthShort}: ${minWidth}-${maxWidth}mm, ${ui.heightShort}: ${minHeight}-${maxHeight}mm）`}
        </div>
      )}

      {(isPegboard || isDoor) && calc.w > 0 && calc.h > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <div className="text-xs font-black text-slate-400 uppercase mb-3">{ui.previewTitle}</div>
          <svg viewBox="0 0 320 220" className="w-full h-auto bg-slate-50 rounded-xl border border-slate-200">
            {(() => {
              const areaX = 30;
              const areaY = 20;
              const areaW = 220;
              const areaH = 170;
              const ratio = Math.max(0.0001, calc.w / Math.max(1, calc.h));
              let rw = areaW;
              let rh = rw / ratio;
              if (rh > areaH) {
                rh = areaH;
                rw = rh * ratio;
              }
              const rx = areaX + (areaW - rw) / 2;
              const ry = areaY + (areaH - rh) / 2;

              const pegCols = Math.max(4, Math.min(18, Math.round(calc.w / 120)));
              const pegRows = Math.max(4, Math.min(14, Math.round(calc.h / 120)));

              return (
                <>
                  <rect x={rx} y={ry} width={rw} height={rh} fill="#ffffff" stroke="#334155" strokeWidth="2" rx="4" />

                  {isPegboard && (
                    <>
                      {Array.from({ length: pegCols }).map((_, c) =>
                        Array.from({ length: pegRows }).map((__, r) => {
                          const cx = rx + ((c + 1) * rw) / (pegCols + 1);
                          const cy = ry + ((r + 1) * rh) / (pegRows + 1);
                          return (
                            <ellipse
                              key={`h-${c}-${r}`}
                              cx={cx}
                              cy={cy}
                              rx={Math.max(2, rw / 100)}
                              ry={Math.max(3, rh / 70)}
                              fill="#94a3b8"
                              opacity="0.9"
                            />
                          );
                        })
                      )}
                    </>
                  )}

                  {isDoor && (
                    <>
                      {/* handle贴边，左右示意已对调 */}
                      <rect
                        x={openingSide === 'left' ? (rx + rw - 8) : (rx - 4)}
                        y={ry + rh / 2 - Math.min(40, rh * 0.32) / 2}
                        width="8"
                        height={Math.min(40, rh * 0.32)}
                        fill="#2563eb"
                        rx="2"
                      />
                      <text
                        x={openingSide === 'left' ? (rx + rw - 12) : (rx + 10)}
                        y={ry + rh / 2 + 3}
                        fontSize="10"
                        fill="#1e3a8a"
                        textAnchor={openingSide === 'left' ? 'end' : 'start'}
                      >
                        {ui.handle}
                      </text>

                      {hingePositions.map((hp, idx) => {
                        const hy = ry + (Math.max(0, Math.min(calc.h, hp)) / Math.max(1, calc.h)) * rh;
                        const hx = openingSide === 'left' ? rx : (rx + rw - 6);
                        return <rect key={`hinge-${idx}`} x={hx} y={hy - 3} width="6" height="6" fill="#ef4444" rx="1" />;
                      })}
                      {hingePositions.slice(0, -1).map((hp, idx) => {
                        const hy1 = ry + (Math.max(0, Math.min(calc.h, hp)) / Math.max(1, calc.h)) * rh;
                        const hy2 = ry + (Math.max(0, Math.min(calc.h, hingePositions[idx + 1])) / Math.max(1, calc.h)) * rh;
                        const midY = (hy1 + hy2) / 2;
                        const tx = openingSide === 'left' ? (rx + 14) : (rx + rw - 14);
                        return (
                          <text
                            key={`gap-${idx}`}
                            x={tx}
                            y={midY}
                            fontSize="9"
                            fill="#7f1d1d"
                            textAnchor={openingSide === 'left' ? 'start' : 'end'}
                          >
                            {`${Math.round(hingePositions[idx + 1] - hp)}mm`}
                          </text>
                        );
                      })}
                      <text
                        x={openingSide === 'left' ? (rx + 10) : (rx + rw - 10)}
                        y={ry + 12}
                        fontSize="10"
                        fill="#991b1b"
                        textAnchor={openingSide === 'left' ? 'start' : 'end'}
                      >
                        {ui.hinge} × {hingePositions.length}
                      </text>
                    </>
                  )}
                </>
              );
            })()}

            {/* dimension labels */}
            <line x1="30" y1="202" x2="250" y2="202" stroke="#64748b" strokeWidth="1" />
            <line x1="22" y1="20" x2="22" y2="190" stroke="#64748b" strokeWidth="1" />
            <text x="140" y="214" fontSize="11" fill="#334155" textAnchor="middle">{ui.widthShort} {calc.w}mm</text>
            <text x="10" y="108" fontSize="11" fill="#334155" transform="rotate(-90 10 108)" textAnchor="middle">{ui.heightShort} {calc.h}mm</text>
            <text x="260" y="30" fontSize="10" fill="#334155">{ui.widthHeightHint}</text>
          </svg>
        </div>
      )}

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-2">
        <div className="flex justify-between font-bold text-slate-600">
          <span>{t.qq_area || '面积'}</span>
          <span>{calc.areaSqm.toFixed(3)}㎡</span>
        </div>
        <div className="flex justify-between font-bold text-slate-600">
          <span>{t.qq_unitPrice || '单价'}</span>
          <span>{currency}{calc.unitPrice.toFixed(1)}</span>
        </div>
        {isDoor && (
          <>
            <div className="flex justify-between font-bold text-slate-600">
              <span>{language === 'cn' ? '门板计价' : language === 'jp' ? 'パネル単価' : 'Panel price'}</span>
              <span>{currency}{calc.boardUnitPrice.toFixed(1)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-600">
              <span>{ui.hingeFee} ({calc.hingeCount} × {currency}{DOOR_HINGE_UNIT_PRICE})</span>
              <span>{currency}{calc.hingeFeePerPiece.toFixed(1)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between font-black text-slate-900 text-lg">
          <span>{t.total || '总计'}</span>
          <span>{currency}{calc.subtotal.toFixed(1)}</span>
        </div>
        {calc.minAreaApplied && (
          <div className="text-xs font-bold text-orange-600">{t.qq_minAreaWarning || '单张面积不足0.2㎡，按0.2㎡计算'}</div>
        )}
        {isDoor && <div className="text-xs font-bold text-slate-600">{ui.doorNote}</div>}
        {isDoor && <div className="text-xs font-bold text-slate-600">{ui.doorSizeLimit}</div>}
        {isPegboard && <div className="text-xs font-bold text-slate-600">{ui.pegboardLimit}</div>}
        {(isPegboard || isDoor) && <div className="text-xs font-bold text-slate-500">{ui.diagramNotice}</div>}
        {(isPegboard || isDoor) && <div className="text-xs font-bold text-slate-500">{ui.wechatNotice}</div>}
        {isDoor && (
          <div className="text-xs font-bold text-slate-600">
            {language === 'cn' ? '备注' : language === 'jp' ? '備考' : 'Note'}：
            {language === 'cn'
              ? `上铰链离上端 ${topOffset}mm，下铰链离下端 ${bottomOffset}mm；${ui.hingeGap}：${hingeGaps.length ? hingeGaps.map(g => `${g}mm`).join(' / ') : '-'}。`
              : language === 'jp'
                ? `上ヒンジ端距離 ${topOffset}mm、下ヒンジ端距離 ${bottomOffset}mm；${ui.hingeGap}: ${hingeGaps.length ? hingeGaps.map(g => `${g}mm`).join(' / ') : '-'}`
                : `Top hinge offset ${topOffset}mm, bottom hinge offset ${bottomOffset}mm; ${ui.hingeGap}: ${hingeGaps.length ? hingeGaps.map(g => `${g}mm`).join(' / ') : '-'}.`}
          </div>
        )}
      </div>

      {isDoor && calc.h > MAX_DOOR_HEIGHT_MM && (
        <div className="text-xs font-bold text-red-600">{language === 'cn' ? '高度不支持超过3000mm' : language === 'jp' ? '高さは3000mmを超えられません' : 'Height over 3000mm is not supported'}</div>
      )}

      <button
        onClick={handleSubmit}
        disabled={hasRangeError}
        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black hover:bg-blue-500 transition-all"
      >
        {initialItem ? (language === 'cn' ? '更新并返回购物车' : language === 'jp' ? '更新してカートへ戻る' : 'Update & Back to Cart') : (language === 'cn' ? '加入购物车并去支付' : language === 'jp' ? 'カートに追加して支払いへ' : 'Add to Cart and Pay')}
      </button>
    </div>
  );
};

export default BoardQuoteEditor;
