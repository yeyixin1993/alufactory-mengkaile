import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  Minus,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type { Language } from '../types';
import {
  MARINE_BOARD_COLORS,
  MARINE_BOARD_ORIGINAL_ORDER_NAME,
  PROFILE_COLORS,
} from '../constants';
import { DIY_TEMPLATE_STORAGE_PREFIX } from '../utils/parametricFurniture';
import {
  buildDisplayRack3Template,
  calculateDisplayRack3Price,
  calculateDisplayRack3Layout,
  DISPLAY_RACK_3_BASELINE,
  DISPLAY_RACK_3_LIMITS,
  type DisplayRack3Layout,
  type DisplayRack3Parameters,
  validateDisplayRack3Parameters,
} from '../utils/parametricDisplayRack';

interface DisplayRackConfiguratorProps {
  language: Language;
}

const COPY = {
  cn: {
    title: '3.0参数化展示架',
    hint: '固定规格与灵活布置分开控制。修改尺寸时，右侧结构、层数、比例和构件统计会立即更新。',
    dimensions: '成品与地柜尺寸',
    width: '整体宽度 W',
    height: '整体高度 H',
    depth: '整体深度 D',
    baseHeight: '地柜高度',
    levels: '层板与抽屉数量',
    upperLevels: '上部层板数量',
    lowerLevels: '下部抽屉层数',
    colors: '外观颜色',
    profileColor: '型材颜色',
    marineBoardColor: '海洋板颜色',
    trackLayout: '上部层板高度布置',
    auto: '自动安全均分',
    custom: '逐层自定义',
    trackHeight: '第{index}层层板安装基准高度',
    trackHint: '自定义的是展示层板安装基准高度；Ø8光轴孔位按固定偏移自动换算。相邻层板必须保留至少324.9mm。',
    reset: '恢复3.0母版参数',
    fixedTitle: '锁定的制造规格',
    fixedRules: '3030型材｜18mm海洋板｜Ø8光轴｜每层3×SK8 + 2×SHF8｜层板20°斜装｜固定件禁止缩放',
    preview: '实时结构预览',
    previewHint: '比例、地柜高度、层板与抽屉数量随输入同步变化',
    profiles: '3030型材',
    panels: '18mm板件',
    shafts: 'Ø8光轴',
    supports: 'SK8 + SHF8',
    drawerSlides: '抽屉滑轨套装',
    total: '材料与配件数量',
    quote: '成品家具总价',
    basePrice: '本色标准款',
    sizeFee: '定制尺寸服务费',
    upperAdjustment: '展示层板调整',
    lowerAdjustment: '抽屉调整',
    profileColorFee: '彩色型材',
    boardColorFee: '彩色海洋板',
    pricingHint: '材料明细会完整生成；成品家具按整件报价，不显示单项材料价格。',
    valid: '组合可生成',
    invalid: '当前组合不可生成',
    generate: '生成完整展架并进入3D设计器',
    generateHint: '生成型材、板件、光轴、固定库夹具、抽屉滑轨及经冲突校验的连接加工。',
  },
  en: {
    title: '3.0 Parametric Display Rack',
    hint: 'Fixed specifications and flexible placement are controlled separately. The structure, proportions and count update immediately.',
    dimensions: 'Product and base dimensions',
    width: 'Overall width W',
    height: 'Overall height H',
    depth: 'Overall depth D',
    baseHeight: 'Base cabinet height',
    levels: 'Shelf and drawer counts',
    upperLevels: 'Upper shelf count',
    lowerLevels: 'Lower drawer count',
    colors: 'Finish colors',
    profileColor: 'Profile color',
    marineBoardColor: 'Marine-board color',
    trackLayout: 'Upper-shelf height layout',
    auto: 'Automatic safe spacing',
    custom: 'Set every level',
    trackHeight: 'Shelf {index} datum height',
    trackHint: 'This is the display-shelf datum. Ø8 shaft holes follow the locked offset. Adjacent shelves need at least 324.9mm.',
    reset: 'Restore 3.0 baseline',
    fixedTitle: 'Locked manufacturing specifications',
    fixedRules: '3030 profiles | 18mm marine board | Ø8 shaft | 3×SK8 + 2×SHF8 per level | 20° shelf tilt | no fixed-part scaling',
    preview: 'Live structure preview',
    previewHint: 'Proportions, base height, shelves and drawers follow the current inputs',
    profiles: '3030 profiles',
    panels: '18mm panels',
    shafts: 'Ø8 shafts',
    supports: 'SK8 + SHF8',
    drawerSlides: 'Drawer-slide sets',
    total: 'Materials and accessories',
    quote: 'Finished-furniture total',
    basePrice: 'Natural standard model',
    sizeFee: 'Custom-size service',
    upperAdjustment: 'Display-shelf adjustment',
    lowerAdjustment: 'Drawer adjustment',
    profileColorFee: 'Colored profiles',
    boardColorFee: 'Colored marine board',
    pricingHint: 'The full material list is generated. Finished furniture is quoted as one product without component prices.',
    valid: 'Ready to generate',
    invalid: 'This combination cannot be generated',
    generate: 'Generate complete rack in 3D designer',
    generateHint: 'Creates profiles, boards, shafts, registered supports, drawer slides and collision-checked connection machining.',
  },
  jp: {
    title: '3.0パラメトリック展示棚',
    hint: '固定仕様と可変配置を分離して管理します。寸法変更と同時に構造、段数、比率、部品数が更新されます。',
    dimensions: '製品・下台寸法',
    width: '全体幅 W',
    height: '全体高さ H',
    depth: '全体奥行 D',
    baseHeight: '下台高さ',
    levels: '棚板・引出し数',
    upperLevels: '上部棚板数',
    lowerLevels: '下部引出し数',
    colors: '仕上げ色',
    profileColor: '形材カラー',
    marineBoardColor: 'マリンボードカラー',
    trackLayout: '上部棚板高さ配置',
    auto: '安全間隔で自動配置',
    custom: '各段を個別指定',
    trackHeight: '第{index}段 棚板基準高さ',
    trackHint: '展示棚板の基準高さです。Ø8軸穴は固定オフセットで自動計算し、隣接棚板は324.9mm以上確保します。',
    reset: '3.0基準値に戻す',
    fixedTitle: '固定製造仕様',
    fixedRules: '3030形材｜18mmマリンボード｜Ø8軸｜各段3×SK8 + 2×SHF8｜棚板20°｜固定部品は伸縮禁止',
    preview: 'リアルタイム構造プレビュー',
    previewHint: '比率、下台高さ、棚板数、引出し数が入力値に追従します',
    profiles: '3030形材',
    panels: '18mm板材',
    shafts: 'Ø8軸',
    supports: 'SK8 + SHF8',
    drawerSlides: '引出しレールセット',
    total: '材料・部品数',
    quote: '完成家具合計',
    basePrice: '標準ナチュラル仕様',
    sizeFee: '特注寸法サービス',
    upperAdjustment: '展示棚板調整',
    lowerAdjustment: '引出し調整',
    profileColorFee: 'カラー形材',
    boardColorFee: 'カラーマリンボード',
    pricingHint: '材料明細はすべて生成します。完成家具は一式価格とし、材料ごとの価格は表示しません。',
    valid: '生成できます',
    invalid: '現在の組合せでは生成できません',
    generate: '完成棚を生成して3Dデザイナーへ',
    generateHint: '形材、板、軸、登録済み支持具、引出しレール、干渉確認済み接続加工を生成します。',
  },
} as const;

const clampToStep = (value: number, min: number, max: number, step: number) => {
  const clamped = Math.min(max, Math.max(min, value));
  return Number((min + Math.round((clamped - min) / step) * step).toFixed(3));
};

const RangeNumberControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step = 1, unit = 'mm', onChange }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (next: number) => onChange(clampToStep(next, min, max, step));
  const updateDraft = (raw: string) => {
    setDraft(raw);
    const parsed = Number(raw);
    if (raw.trim() && Number.isFinite(parsed) && parsed >= min && parsed <= max) commit(parsed);
  };
  const commitDraft = () => {
    const parsed = Number(draft);
    commit(Number.isFinite(parsed) ? parsed : value);
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-[11px] font-black text-slate-700">{label}</label>
        <span className="text-[9px] font-bold text-slate-400">{min}–{max}{unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`${label} -`} onClick={() => commit(value - step)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-300 hover:text-blue-600"><Minus className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            min={min}
            max={max}
            step={step}
            onChange={(event) => updateDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 text-center text-sm font-black text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button type="button" aria-label={`${label} +`} onClick={() => commit(value + step)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-blue-300 hover:text-blue-600"><Plus className="h-4 w-4" /></button>
      </div>
      <input
        aria-label={`${label} slider`}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => commit(Number(event.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer accent-blue-600"
      />
    </div>
  );
};

const DisplayRackLivePreview: React.FC<{
  parameters: DisplayRack3Parameters;
  layout?: DisplayRack3Layout;
}> = ({ parameters, layout }) => {
  const { widthMm, heightMm, depthMm, baseCabinetHeightMm, upperLevels, lowerLevels } = parameters;
  const scale = Math.min(300 / widthMm, 385 / heightMm);
  const drawWidth = widthMm * scale;
  const drawHeight = heightMm * scale;
  const depthOffset = Math.min(78, Math.max(28, depthMm * scale * 0.34));
  const depthRise = depthOffset * 0.38;
  const left = (520 - drawWidth) / 2 + depthOffset * 0.35;
  const right = left + drawWidth;
  const bottom = 454;
  const top = bottom - drawHeight;
  const rearLeft = left - depthOffset;
  const rearRight = right - depthOffset;
  const rearBottom = bottom - depthRise;
  const rearTop = top - depthRise;
  const baseY = bottom - baseCabinetHeightMm * scale;
  const rearBaseY = baseY - depthRise;
  const autoTierHeights = Array.from({ length: upperLevels }, (_, index) => (
    baseCabinetHeightMm + ((index + 1) * (heightMm - baseCabinetHeightMm - 220)) / (upperLevels + 1)
  ));
  const tierHeights = layout?.upperTierHeightsMm || autoTierHeights;
  const drawerCenters = layout?.drawerCenterHeightsMm
    || Array.from({ length: lowerLevels }, (_, index) => ((index + 0.75) * baseCabinetHeightMm) / lowerLevels);
  const drawerHeight = layout?.drawerHeightMm || Math.max(50, baseCabinetHeightMm / lowerLevels - 25);
  const profileStroke = Math.max(3, Math.min(7, 30 * scale));
  return (
    <svg viewBox="0 0 520 500" role="img" aria-label={`${widthMm} × ${heightMm} × ${depthMm} mm display rack preview`} className="h-full min-h-[360px] w-full">
      <defs>
        <linearGradient id="rack-board" x1="0" x2="1">
          <stop offset="0" stopColor="#d49a62" />
          <stop offset="1" stopColor="#a9683f" />
        </linearGradient>
        <linearGradient id="rack-profile" x1="0" x2="1">
          <stop offset="0" stopColor="#536170" />
          <stop offset="0.5" stopColor="#aeb8c3" />
          <stop offset="1" stopColor="#475569" />
        </linearGradient>
        <marker id="dimension-arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M0,0 L7,3.5 L0,7 Z" fill="#2563eb" /></marker>
      </defs>
      <g fill="none" stroke="url(#rack-profile)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={profileStroke}>
        <path d={`M${rearLeft} ${rearBottom}V${rearTop}M${rearRight} ${rearBottom}V${rearTop}`} />
        <path d={`M${left} ${bottom}V${baseY}M${right} ${bottom}V${baseY}`} />
        <path d={`M${rearLeft} ${rearBottom}L${left} ${bottom}M${rearRight} ${rearBottom}L${right} ${bottom}`} />
        <path d={`M${rearLeft} ${rearTop}L${rearRight} ${rearTop}`} />
        <path d={`M${rearLeft} ${rearBaseY}L${rearRight} ${rearBaseY}M${rearLeft} ${rearBaseY}L${left} ${baseY}M${rearRight} ${rearBaseY}L${right} ${baseY}`} />
        <path d={`M${left} ${bottom}L${right} ${bottom}M${left} ${baseY}L${right} ${baseY}`} />
      </g>
      {drawerCenters.map((centerHeight, index) => {
        const y = bottom - centerHeight * scale;
        const height = Math.max(8, drawerHeight * scale);
        return <g key={`drawer-${index}`}>
          <rect x={left + profileStroke} y={y - height / 2} width={Math.max(10, drawWidth - profileStroke * 2)} height={height} rx="2" fill="url(#rack-board)" stroke="#71442f" strokeWidth="1.5" />
          <line x1={left + 10} y1={y} x2={right - 10} y2={y} stroke="#8b5a3c" strokeWidth="1" opacity="0.55" />
        </g>;
      })}
      {tierHeights.map((tierHeight, index) => {
        const y = bottom - tierHeight * scale;
        const shaftY = bottom - (tierHeight + 257.31) * scale;
        const shelfDrop = Math.max(7, depthOffset * 0.12);
        return <g key={`tier-${index}`}>
          <path d={`M${rearLeft + 7} ${y - depthRise}L${rearRight - 7} ${y - depthRise}`} fill="none" stroke="url(#rack-profile)" strokeWidth={profileStroke} strokeLinecap="round" />
          <polygon points={`${rearLeft + 12},${y - depthRise - 2} ${rearRight - 12},${y - depthRise - 2} ${right - 18},${y + shelfDrop} ${left + 18},${y + shelfDrop}`} fill="url(#rack-board)" stroke="#71442f" strokeWidth="1.5" opacity="0.95" />
          <polygon points={`${rearLeft + 15},${y - depthRise - 2} ${rearRight - 15},${y - depthRise - 2} ${rearRight - 20},${y - depthRise - 45} ${rearLeft + 20},${y - depthRise - 45}`} fill="url(#rack-board)" stroke="#71442f" strokeWidth="1.5" />
          <line x1={rearLeft + 5} y1={shaftY - depthRise} x2={rearRight - 5} y2={shaftY - depthRise} stroke="#e5e7eb" strokeWidth="4" />
          {[rearLeft + 12, (rearLeft + rearRight) / 2, rearRight - 12].map((x, support) => <circle key={support} cx={x} cy={shaftY - depthRise} r="3.6" fill="#475569" stroke="#dbe3eb" strokeWidth="1.5" />)}
        </g>;
      })}
      <g fill="none" stroke="#2563eb" strokeWidth="1.2" markerStart="url(#dimension-arrow)" markerEnd="url(#dimension-arrow)">
        <line x1={left} y1={480} x2={right} y2={480} />
        <line x1={35} y1={top} x2={35} y2={bottom} />
        <line x1={rearRight + 5} y1={rearTop - 14} x2={right + 5} y2={top - 14} />
      </g>
      <g fill="#1d4ed8" fontSize="11" fontWeight="800">
        <text x={(left + right) / 2} y="496" textAnchor="middle">W {widthMm}mm</text>
        <text x="19" y={(top + bottom) / 2} textAnchor="middle" transform={`rotate(-90 19 ${(top + bottom) / 2})`}>H {heightMm}mm</text>
        <text x={(rearRight + right) / 2 + 10} y={Math.min(rearTop, top) - 21} textAnchor="middle">D {depthMm}mm</text>
      </g>
      <line x1={left - 8} y1={baseY} x2={right + 8} y2={baseY} stroke="#0f766e" strokeWidth="1.2" strokeDasharray="5 4" />
      <text x={right + 12} y={baseY + 4} fill="#0f766e" fontSize="10" fontWeight="800">地柜 {baseCabinetHeightMm}mm</text>
    </svg>
  );
};

const openTemplateInDesigner = (payload: ReturnType<typeof buildDisplayRack3Template>) => {
  const token = `${payload.source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(`${DIY_TEMPLATE_STORAGE_PREFIX}${token}`, JSON.stringify(payload));
  const base = `${window.location.origin}${window.location.pathname}`;
  window.open(`${base}#/diy-designer?template=${encodeURIComponent(token)}`, '_blank', 'noopener,noreferrer');
};

const DisplayRackConfigurator: React.FC<DisplayRackConfiguratorProps> = ({ language }) => {
  const copy = COPY[language];
  const [widthMm, setWidthMm] = useState<number>(DISPLAY_RACK_3_BASELINE.widthMm);
  const [heightMm, setHeightMm] = useState<number>(DISPLAY_RACK_3_BASELINE.heightMm);
  const [depthMm, setDepthMm] = useState<number>(DISPLAY_RACK_3_BASELINE.depthMm);
  const [baseCabinetHeightMm, setBaseCabinetHeightMm] = useState<number>(DISPLAY_RACK_3_BASELINE.baseCabinetHeightMm);
  const [upperLevels, setUpperLevels] = useState<number>(DISPLAY_RACK_3_BASELINE.upperLevels);
  const [lowerLevels, setLowerLevels] = useState<number>(DISPLAY_RACK_3_BASELINE.lowerLevels);
  const [profileColorId, setProfileColorId] = useState('natural');
  const [marineBoardColorId, setMarineBoardColorId] = useState('wood_natural');
  const [trackLayoutMode, setTrackLayoutMode] = useState<'auto' | 'custom'>('auto');
  const [trackHeightsMm, setTrackHeightsMm] = useState<number[]>(() => (
    calculateDisplayRack3Layout({ ...DISPLAY_RACK_3_BASELINE, trackLayoutMode: 'auto' }).upperTierHeightsMm
  ));

  const parameters = useMemo<DisplayRack3Parameters>(() => ({
    widthMm,
    heightMm,
    depthMm,
    baseCabinetHeightMm,
    upperLevels,
    lowerLevels,
    profileColorId,
    marineBoardColorId,
    trackLayoutMode,
    trackHeightsMm: trackLayoutMode === 'custom' ? trackHeightsMm : undefined,
  }), [baseCabinetHeightMm, depthMm, heightMm, lowerLevels, marineBoardColorId, profileColorId, trackHeightsMm, trackLayoutMode, upperLevels, widthMm]);
  const validation = useMemo(() => validateDisplayRack3Parameters(parameters), [parameters]);
  const price = useMemo(() => calculateDisplayRack3Price(parameters), [parameters]);

  const automaticLayoutFor = (overrides: Partial<DisplayRack3Parameters> = {}) => {
    const candidate = validateDisplayRack3Parameters({ ...parameters, ...overrides, trackLayoutMode: 'auto', trackHeightsMm: undefined });
    return candidate.layout;
  };
  const changeUpperLevels = (next: number) => {
    setUpperLevels(next);
    if (trackLayoutMode === 'custom') {
      const nextLayout = automaticLayoutFor({ upperLevels: next });
      if (nextLayout) setTrackHeightsMm(nextLayout.upperTierHeightsMm);
    }
  };
  const setCustomTrackMode = () => {
    const autoLayout = automaticLayoutFor();
    if (autoLayout) setTrackHeightsMm(autoLayout.upperTierHeightsMm);
    setTrackLayoutMode('custom');
  };
  const reset = () => {
    setWidthMm(DISPLAY_RACK_3_BASELINE.widthMm);
    setHeightMm(DISPLAY_RACK_3_BASELINE.heightMm);
    setDepthMm(DISPLAY_RACK_3_BASELINE.depthMm);
    setBaseCabinetHeightMm(DISPLAY_RACK_3_BASELINE.baseCabinetHeightMm);
    setUpperLevels(DISPLAY_RACK_3_BASELINE.upperLevels);
    setLowerLevels(DISPLAY_RACK_3_BASELINE.lowerLevels);
    setProfileColorId('natural');
    setMarineBoardColorId('wood_natural');
    setTrackLayoutMode('auto');
    setTrackHeightsMm(calculateDisplayRack3Layout({ ...DISPLAY_RACK_3_BASELINE, trackLayoutMode: 'auto' }).upperTierHeightsMm);
  };

  const counts = validation.layout?.counts || {
    profiles: 14 + lowerLevels * 2 + upperLevels * 4,
    panels: 1 + lowerLevels * 5 + upperLevels * 2,
    shafts: upperLevels,
    supports: upperLevels * 5,
    drawerSlides: lowerLevels,
    total: 15 + lowerLevels * 8 + upperLevels * 12,
  };

  return (
    <div data-testid="furniture-configurator-display-rack-3-0" className="overflow-hidden rounded-[2.5rem] border border-slate-100 bg-white shadow-xl">
      <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-5 py-6 text-white sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-300 ring-1 ring-white/15"><SlidersHorizontal className="h-6 w-6" /></span>
            <div>
              <div className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Verified product template</div>
              <h3 className="text-2xl font-black">{copy.title}</h3>
              <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">{copy.hint}</p>
            </div>
          </div>
          <button type="button" onClick={reset} className="flex whitespace-nowrap items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-[11px] font-black text-white transition hover:bg-white/15"><RotateCcw className="h-4 w-4" />{copy.reset}</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div className="space-y-5 p-5 sm:p-8">
          <section>
            <h4 className="mb-3 text-sm font-black text-slate-900">{copy.dimensions}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RangeNumberControl label={copy.width} value={widthMm} {...DISPLAY_RACK_3_LIMITS.widthMm} onChange={setWidthMm} />
              <RangeNumberControl label={copy.height} value={heightMm} {...DISPLAY_RACK_3_LIMITS.heightMm} onChange={setHeightMm} />
              <RangeNumberControl label={copy.depth} value={depthMm} {...DISPLAY_RACK_3_LIMITS.depthMm} onChange={setDepthMm} />
              <RangeNumberControl label={copy.baseHeight} value={baseCabinetHeightMm} {...DISPLAY_RACK_3_LIMITS.baseCabinetHeightMm} onChange={setBaseCabinetHeightMm} />
            </div>
          </section>

          <section>
            <h4 className="mb-3 text-sm font-black text-slate-900">{copy.levels}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <RangeNumberControl label={copy.upperLevels} value={upperLevels} {...DISPLAY_RACK_3_LIMITS.upperLevels} unit="" onChange={changeUpperLevels} />
              <RangeNumberControl label={copy.lowerLevels} value={lowerLevels} {...DISPLAY_RACK_3_LIMITS.lowerLevels} unit="" onChange={setLowerLevels} />
            </div>
          </section>

          <section>
            <h4 className="mb-3 text-sm font-black text-slate-900">{copy.colors}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 bg-white p-3 text-[11px] font-black text-slate-700 shadow-sm">
                <span className="mb-2 block">{copy.profileColor}</span>
                <select value={profileColorId} onChange={(event) => setProfileColorId(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500">
                  {PROFILE_COLORS.map((color) => <option key={color.id} value={color.id}>{color.name[language]}</option>)}
                </select>
              </label>
              <label className="rounded-2xl border border-slate-200 bg-white p-3 text-[11px] font-black text-slate-700 shadow-sm">
                <span className="mb-2 block">{copy.marineBoardColor}</span>
                <select value={marineBoardColorId} onChange={(event) => setMarineBoardColorId(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-blue-500">
                  {MARINE_BOARD_COLORS.map((color) => (
                    <option key={color.id} value={color.id}>
                      {color.id === 'wood_natural' ? MARINE_BOARD_ORIGINAL_ORDER_NAME[language] : color.name[language]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h4 className="text-sm font-black text-slate-900">{copy.trackLayout}</h4>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
                <button type="button" onClick={() => setTrackLayoutMode('auto')} className={`rounded-lg px-3 py-2 text-[10px] font-black transition ${trackLayoutMode === 'auto' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>{copy.auto}</button>
                <button type="button" onClick={setCustomTrackMode} className={`rounded-lg px-3 py-2 text-[10px] font-black transition ${trackLayoutMode === 'custom' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>{copy.custom}</button>
              </div>
            </div>
            {trackLayoutMode === 'custom' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Array.from({ length: upperLevels }, (_, index) => (
                  <RangeNumberControl
                    key={`track-${index}`}
                    label={copy.trackHeight.replace('{index}', String(index + 1))}
                    value={trackHeightsMm[index] || Math.round(baseCabinetHeightMm + 30 + index * 325)}
                    min={Math.min(heightMm - 320, Math.ceil(baseCabinetHeightMm + 29.05))}
                    max={Math.max(Math.ceil(baseCabinetHeightMm + 29.05), heightMm - 320)}
                    step={1}
                    onChange={(value) => setTrackHeightsMm((current) => Array.from(
                      { length: upperLevels },
                      (_, itemIndex) => itemIndex === index ? value : current[itemIndex] || value,
                    ))}
                  />
                ))}
              </div>
            )}
            <p className="mt-3 text-[10px] font-bold leading-relaxed text-slate-500">{copy.trackHint}</p>
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-900"><LockKeyhole className="h-4 w-4 text-emerald-700" />{copy.fixedTitle}</div>
            <p className="mt-2 text-[11px] font-bold leading-relaxed text-emerald-800">{copy.fixedRules}</p>
          </section>

          <div className={`rounded-2xl border px-4 py-3 ${validation.valid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            <div className="flex items-start gap-2">
              {validation.valid ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
              <div><div className="text-xs font-black">{validation.valid ? copy.valid : copy.invalid}</div><p className="mt-1 text-[10px] font-bold leading-relaxed">{validation.message}</p></div>
            </div>
          </div>

          <button
            data-testid="display-rack-generate"
            type="button"
            disabled={!validation.valid}
            onClick={() => validation.valid && openTemplateInDesigner(buildDisplayRack3Template(parameters))}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            <Sparkles className="h-5 w-5" />{copy.generate}
          </button>
          <p className="text-center text-[10px] font-bold leading-relaxed text-slate-400">{copy.generateHint}</p>
        </div>

        <aside className="border-t border-slate-100 bg-slate-50/80 p-5 sm:p-8 xl:border-l xl:border-t-0">
          <div className="sticky top-24">
            <div className="flex items-start justify-between gap-3">
              <div><h4 className="text-sm font-black text-slate-900">{copy.preview}</h4><p className="mt-1 text-[10px] font-bold text-slate-400">{copy.previewHint}</p></div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-black text-emerald-800">3.0</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <DisplayRackLivePreview parameters={parameters} layout={validation.layout} />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {([
                [copy.profiles, counts.profiles],
                [copy.panels, counts.panels],
                [copy.shafts, counts.shafts],
                [copy.supports, counts.supports],
                [copy.drawerSlides, counts.drawerSlides],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white px-3 py-3"><div className="text-[9px] font-black text-slate-400">{label}</div><div className="mt-1 text-xl font-black text-slate-900">{value}</div></div>
              ))}
            </div>
            <div className="mt-2 rounded-xl bg-slate-950 px-4 py-3 text-white"><div className="text-[9px] font-black uppercase tracking-widest text-slate-400">{copy.total}</div><div className="mt-1 flex items-end justify-between gap-3"><strong className="text-2xl">{counts.total}</strong><span className="text-[10px] font-bold text-slate-300">{widthMm} × {heightMm} × {depthMm}mm</span></div></div>
            <div className="mt-3 rounded-2xl bg-blue-600 p-4 text-white shadow-lg shadow-blue-600/20">
              <div className="text-[9px] font-black uppercase tracking-widest text-blue-100">{copy.quote}</div>
              <div className="mt-1 text-3xl font-black">¥{price.totalPriceCny.toFixed(0)}</div>
              <div className="mt-3 space-y-1.5 border-t border-white/20 pt-3 text-[10px] font-bold text-blue-50">
                <div className="flex justify-between gap-3"><span>{copy.basePrice}</span><span>¥{price.baselinePriceCny}</span></div>
                {price.dimensionCustomizationFeeCny !== 0 && <div className="flex justify-between gap-3"><span>{copy.sizeFee}</span><span>+¥{price.dimensionCustomizationFeeCny}</span></div>}
                {price.upperLevelAdjustmentCny !== 0 && <div className="flex justify-between gap-3"><span>{copy.upperAdjustment}</span><span>{price.upperLevelAdjustmentCny > 0 ? '+' : '-'}¥{Math.abs(price.upperLevelAdjustmentCny)}</span></div>}
                {price.lowerLevelAdjustmentCny !== 0 && <div className="flex justify-between gap-3"><span>{copy.lowerAdjustment}</span><span>{price.lowerLevelAdjustmentCny > 0 ? '+' : '-'}¥{Math.abs(price.lowerLevelAdjustmentCny)}</span></div>}
                {price.profileColorSurchargeCny !== 0 && <div className="flex justify-between gap-3"><span>{copy.profileColorFee}</span><span>+¥{price.profileColorSurchargeCny}</span></div>}
                {price.marineBoardColorSurchargeCny !== 0 && <div className="flex justify-between gap-3"><span>{copy.boardColorFee}</span><span>+¥{price.marineBoardColorSurchargeCny}</span></div>}
              </div>
              <p className="mt-3 text-[9px] font-bold leading-relaxed text-blue-100">{copy.pricingHint}</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default DisplayRackConfigurator;
