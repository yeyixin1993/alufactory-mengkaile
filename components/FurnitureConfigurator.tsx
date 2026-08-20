import React, { useMemo, useState } from 'react';
import { Box, Grid3X3, Ruler, Sparkles } from 'lucide-react';
import { Language, ProductType } from '../types';
import {
  buildCalligraphyCabinetTemplate,
  buildWardrobeTemplate,
  CALLIGRAPHY_MAX_HEIGHT_MM,
  CALLIGRAPHY_MAX_LENGTH_MM,
  CALLIGRAPHY_OUTER_DEPTH_MM,
  DIY_TEMPLATE_STORAGE_PREFIX,
  getCalligraphyCabinetDimensions,
  getCalligraphyGridForBounds,
  getWardrobeColumnLimit,
  getWardrobeProfileCount,
  getWardrobeStorageLayerLimit,
  MAX_FURNITURE_PROFILE_MM,
  ParametricTemplatePayload,
} from '../utils/parametricFurniture';

interface FurnitureConfiguratorProps {
  language: Language;
  type: ProductType.CALLIGRAPHY_CABINET | ProductType.WARDROBE;
}

const COPY = {
  cn: {
    gridMode: '按层数和列数', sizeMode: '按空间上限', columns: '列数', layers: '层数',
    totalLength: '最长不能超过 (mm)', totalWidth: '整体宽/深 (mm)', totalHeight: '最高不能超过 (mm)',
    generatedSize: '实际生成尺寸', requestedLimit: '这里填写柜体允许占用的最大长度和最大高度。系统会在不超过这两个上限的前提下，生成可容纳最多列、最多层篓子的完整柜体；实际尺寸通常小于输入值，并非按输入尺寸严丝合缝定做。舒法特柜最长不超过3000mm、最高不超过1600mm。',
    calligraphyTitle: '舒法特篓子柜参数化生成', calligraphyHint: '每格按300×420×100mm篓子预留；中间承托层距130mm，柜体固定深度460mm。',
    wardrobeTitle: '参数化衣柜框架', wardrobeHint: '可选择N列，系统沿正面总长平均分配每列宽度；每列每个收纳层生成完整四边层框和一块内嵌12mm UV层板，相邻列共享中间深度横杆。任一型材最长不超过3000mm，进入设计器后会自动启用柜门。',
    length: '长 (mm)', width: '宽/深 (mm)', height: '高 (mm)',
    wardrobeLayers: '收纳层数', wardrobeColumnWidth: '平均列宽', wardrobeGenerated: '实际型材数量',
    profileSummary: '型材配置', machiningSummary: '加工配置',
    calligraphyProfiles: '全部2020；最底和最顶各有一层与横梁同高的框架深度梁且不装层板托；中间每层每道分隔线共用一根420mm承托梁并安装层板托；顶部为12mm海洋板，超过2440mm时在型材分隔线上自动分成两片。',
    calligraphyMachining: '5层柜共有底框+5层篮筐承托+顶框共7层深度梁；孔位从底端130mm起按130mm递增，最后一孔距立柱顶端65mm；全部型材两端攻丝并默认配螺丝。',
    wardrobeProfiles: 'N列沿正面总长等分并生成N+1道前后2040立柱边界。上下框使用贯通前后横梁和每道边界的深度梁；每个中间收纳层的前后横杆按列分段，避免穿过中间立柱，相邻列共享边界深度横杆，因此每列都形成完整四边框。每个四边框内嵌一块12mm UV层板，板长和板宽分别比框内净空小2mm。',
    wardrobeMachining: '收纳层在上下框之间均匀分布；前后2020横杆均接在2040宽面靠柜体内部的槽位。每根分段横杆和共享深度横杆都在各自立柱接点使用1号角码，角码两条90°贴边分别紧贴横杆和立柱。层框不做打孔攻丝连接，2040立柱也不增加对应层孔。每块12mm UV层板四周各留1mm，并自动配8个“12mm板专用层板托”，单价0.7元。设计器会识别各列正面框架，可继续添加四周留2mm的柜门。',
    generate: '生成并进入3D设计器', editable: '3D设计器将在新标签页打开；生成后可继续移动、改尺寸、改孔位并人工审核。',
    supportPricing: '层板托按实际长度计价：氧化本色8元/米，彩色截面本色10元/米，彩色截面彩色12元/米。',
  },
  en: {
    gridMode: 'Rows & columns', sizeMode: 'Space limits', columns: 'Columns', layers: 'Layers',
    totalLength: 'Maximum allowed length (mm)', totalWidth: 'Fixed depth (mm)', totalHeight: 'Maximum allowed height (mm)',
    generatedSize: 'Generated size', requestedLimit: 'Enter the maximum length and height the cabinet may occupy. The system generates the complete cabinet with the most basket columns and layers that fit within both limits. The actual size will usually be smaller than the entered limits; it is not built to match them exactly. The cabinet is capped at 3000 mm long and 1600 mm high.',
    calligraphyTitle: 'Parametric calligraphy basket cabinet', calligraphyHint: 'Each bay fits a 300×420×100 mm basket; intermediate support pitch is 130 mm and cabinet depth is fixed at 460 mm.',
    wardrobeTitle: 'Parametric wardrobe frame', wardrobeHint: 'Choose N columns and the system divides the front length evenly. Every storage level in every column receives a complete four-sided frame and an inset 12mm UV shelf board, with adjacent columns sharing the middle depth rail. No profile may exceed 3000 mm. Cabinet doors are enabled automatically in the designer.',
    length: 'Length (mm)', width: 'Width/depth (mm)', height: 'Height (mm)',
    wardrobeLayers: 'Storage levels', wardrobeColumnWidth: 'Average column width', wardrobeGenerated: 'Total profiles',
    profileSummary: 'Profile configuration', machiningSummary: 'Machining',
    calligraphyProfiles: 'All 2020. Frame-only depth rails sit level with the bottom and top cross rails and receive no shelf supports. Every intermediate basket level has one shared 420 mm support rail per divider. The 12 mm marine-board top is split on a supported profile divider when the cabinet exceeds 2440 mm.',
    calligraphyMachining: 'A five-layer cabinet has seven depth levels. Upright holes start 130 mm from the bottom, repeat every 130 mm, and the final hole is 65 mm from the upright top. All profiles are tapped at both ends with screws prefilled.',
    wardrobeProfiles: 'N columns are divided evenly along the front length and use N+1 front/rear 2040 post boundaries. Top and bottom frames keep continuous front/rear rails plus one depth rail at every boundary. At each internal level, front/rear rails are split by column so they cannot pass through divider posts, while neighboring columns share their boundary depth rail; every column is therefore a closed four-sided frame. Each frame receives one inset 12mm UV board, 2mm smaller than the clear opening in both dimensions.',
    wardrobeMachining: 'Storage levels are evenly spaced between the top and bottom frames. Front and rear 2020 rails use the inward-facing groove of each 2040 wide face. Every segmented rail and shared depth rail uses a No.1 bracket at each post contact, with both perpendicular seating edges flush to the rail and post. Shelf-frame drill-and-tap machining and matching post holes are omitted. Every 12mm UV board has a 1mm gap on all four sides and eight dedicated 12mm-board shelf supports at ¥0.7 each. The designer can detect each front bay and add a door with a 2mm perimeter margin.',
    generate: 'Generate in 3D designer', editable: 'The 3D designer opens in a new tab; the generated assembly remains editable and must be reviewed before ordering.',
    supportPricing: 'Shelf supports are priced by actual length: natural anodized ¥8/m, colored with a natural section ¥10/m, and colored with a colored section ¥12/m.',
  },
  jp: {
    gridMode: '段数・列数で指定', sizeMode: '設置上限で指定', columns: '列数', layers: '段数',
    totalLength: '超えられない最大全長 (mm)', totalWidth: '固定奥行 (mm)', totalHeight: '超えられない最大高さ (mm)',
    generatedSize: '生成寸法', requestedLimit: 'キャビネットを設置できる最大全長と最大高さを入力してください。両方の上限を超えない範囲で、かごの列数・段数が最大になる完成形を生成します。実寸は通常、入力した上限より小さく、入力寸法ぴったりに製作する指定ではありません。最大長さは3000mm、最大高さは1600mmです。',
    calligraphyTitle: '書道バスケット棚のパラメトリック生成', calligraphyHint: '各区画は300×420×100mm、中間棚受けピッチ130mm、棚奥行は460mm固定です。',
    wardrobeTitle: 'パラメトリックワードローブ枠', wardrobeHint: 'N列を選ぶと正面全長を均等に分割します。各列の各収納段に完全な四辺棚枠と12mm UV棚板を内蔵し、隣接列は中央の奥行材を共有します。形材は最長3000mmで、デザイナーでは扉機能が自動で有効になります。',
    length: '長さ (mm)', width: '幅／奥行 (mm)', height: '高さ (mm)',
    wardrobeLayers: '収納段数', wardrobeColumnWidth: '平均列幅', wardrobeGenerated: '形材の合計本数',
    profileSummary: 'プロファイル構成', machiningSummary: '加工構成',
    calligraphyProfiles: '全て2020。最下部と最上部は横材と同じ高さの枠用奥行材で棚受けなし。中間の各かご段は仕切り線ごとに420mm棚受け材を1本共有。12mmマリンボード天板は2440mmを超える場合、形材仕切り上で2枚に分割します。',
    calligraphyMachining: '5段棚は下枠＋かご5段＋上枠の計7段。縦柱の穴は下端130mmから130mm間隔で、最後の穴から上端までは65mm。全形材を両端タップし、ねじを初期配置します。',
    wardrobeProfiles: '正面全長をN列に均等分割し、前後にN+1本ずつの2040境界柱を配置します。上下枠は連続した前後横材と各境界の奥行材で構成。中間段の前後横材は列ごとに分割して中間柱との干渉を防ぎ、隣接列は境界奥行材を共有するため、各列が完全な四辺枠になります。各四辺枠には、内寸より長さ・幅を各2mm小さくした12mm UV棚板を1枚内蔵します。',
    wardrobeMachining: '収納段は上下枠の間に等間隔で配置し、前後の2020横材は2040幅広面の庫内側溝へ接続します。分割横材と共有奥行材の各柱接点に1号ブラケットを置き、直角2辺を横材と柱へ密着させます。棚枠の穴あけ・タップ接続と2040柱の対応穴は追加しません。12mm UV棚板は四周各1mmの隙間を取り、1枚ごとに「12mm板専用棚受け」を8個、単価0.7元で自動配置します。各列の正面枠には四周2mm余白の扉を追加できます。',
    generate: '3Dデザイナーで生成', editable: '3Dデザイナーは新しいタブで開きます。生成後も移動・寸法・穴位置を編集し、注文前に確認できます。',
    supportPricing: '棚受けは実長で計算します：ナチュラルアルマイト8元/m、カラー・ナチュラル断面10元/m、カラー・カラー断面12元/m。',
  },
} as const;

const NumericInput: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}> = ({ label, value, min, max, onChange, disabled }) => (
  <label className="block">
    <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>
    <input
      data-testid={`furniture-input-${label}`}
      type="number"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value) || min)}
      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-black text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:text-slate-400"
    />
  </label>
);

const openTemplateInDesigner = (payload: ParametricTemplatePayload) => {
  const token = `${payload.source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(`${DIY_TEMPLATE_STORAGE_PREFIX}${token}`, JSON.stringify(payload));
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = `${base}#/diy-designer?template=${encodeURIComponent(token)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

const FurnitureConfigurator: React.FC<FurnitureConfiguratorProps> = ({ language, type }) => {
  const copy = COPY[language];
  const isCalligraphy = type === ProductType.CALLIGRAPHY_CABINET;
  const [mode, setMode] = useState<'grid' | 'size'>('grid');
  const [columns, setColumns] = useState(3);
  const [layers, setLayers] = useState(5);
  const [targetLength, setTargetLength] = useState(980);
  const [targetHeight, setTargetHeight] = useState(755);
  const [wardrobeLength, setWardrobeLength] = useState(1200);
  const [wardrobeWidth, setWardrobeWidth] = useState(600);
  const [wardrobeHeight, setWardrobeHeight] = useState(2200);
  const [wardrobeLayers, setWardrobeLayers] = useState(5);
  const [wardrobeColumns, setWardrobeColumns] = useState(1);
  const wardrobeLayerLimit = getWardrobeStorageLayerLimit(wardrobeHeight);
  const effectiveWardrobeLayers = Math.min(wardrobeLayers, wardrobeLayerLimit);
  const wardrobeColumnLimit = getWardrobeColumnLimit(wardrobeLength);
  const effectiveWardrobeColumns = Math.min(wardrobeColumns, wardrobeColumnLimit);
  const wardrobeProfileCount = getWardrobeProfileCount(
    effectiveWardrobeColumns,
    effectiveWardrobeLayers,
  );
  const wardrobeColumnWidthMm = Number((wardrobeLength / effectiveWardrobeColumns).toFixed(1));

  const calligraphyDimensions = useMemo(() => (
    mode === 'grid'
      ? getCalligraphyCabinetDimensions(columns, layers)
      : getCalligraphyGridForBounds(targetLength, targetHeight)
  ), [columns, layers, mode, targetHeight, targetLength]);

  const generate = () => {
    const payload = isCalligraphy
      ? buildCalligraphyCabinetTemplate(calligraphyDimensions.columns, calligraphyDimensions.layers)
      : buildWardrobeTemplate(
        wardrobeLength,
        wardrobeWidth,
        wardrobeHeight,
        effectiveWardrobeLayers,
        effectiveWardrobeColumns,
      );
    openTemplateInDesigner(payload);
  };

  return (
    <div data-testid={`furniture-configurator-${isCalligraphy ? 'calligraphy' : 'wardrobe'}`} className="space-y-6 rounded-[2.5rem] border border-slate-100 bg-white p-5 shadow-xl sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          {isCalligraphy ? <Grid3X3 className="h-6 w-6" /> : <Box className="h-6 w-6" />}
        </span>
        <div>
          <h3 className="text-2xl font-black text-slate-900">{isCalligraphy ? copy.calligraphyTitle : copy.wardrobeTitle}</h3>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{isCalligraphy ? copy.calligraphyHint : copy.wardrobeHint}</p>
        </div>
      </div>

      {isCalligraphy ? (
        <>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
            <button type="button" onClick={() => setMode('grid')} className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${mode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>{copy.gridMode}</button>
            <button type="button" onClick={() => setMode('size')} className={`rounded-xl px-3 py-2.5 text-xs font-black transition ${mode === 'size' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>{copy.sizeMode}</button>
          </div>
          {mode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumericInput label={copy.columns} value={columns} min={1} max={9} onChange={setColumns} />
              <NumericInput label={copy.layers} value={layers} min={1} max={11} onChange={setLayers} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumericInput label={copy.totalLength} value={targetLength} min={340} max={CALLIGRAPHY_MAX_LENGTH_MM} onChange={setTargetLength} />
              <NumericInput label={copy.totalHeight} value={targetHeight} min={235} max={CALLIGRAPHY_MAX_HEIGHT_MM} onChange={setTargetHeight} />
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:grid-cols-3">
            <div><div className="text-[10px] font-black uppercase text-blue-400">{copy.generatedSize}</div><div className="mt-1 font-black text-blue-950">{calligraphyDimensions.lengthMm} × {CALLIGRAPHY_OUTER_DEPTH_MM} × {calligraphyDimensions.heightMm}mm</div></div>
            <div><div className="text-[10px] font-black uppercase text-blue-400">{copy.columns}</div><div className="mt-1 font-black text-blue-950">{calligraphyDimensions.columns}</div></div>
            <div><div className="text-[10px] font-black uppercase text-blue-400">{copy.layers}</div><div className="mt-1 font-black text-blue-950">{calligraphyDimensions.layers}</div></div>
          </div>
          {mode === 'size' && <p className="text-xs font-bold text-amber-700">{copy.requestedLimit}</p>}
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <NumericInput label={copy.length} value={wardrobeLength} min={400} max={MAX_FURNITURE_PROFILE_MM} onChange={setWardrobeLength} />
          <NumericInput label={copy.width} value={wardrobeWidth} min={300} max={MAX_FURNITURE_PROFILE_MM} onChange={setWardrobeWidth} />
          <NumericInput label={copy.height} value={wardrobeHeight} min={500} max={MAX_FURNITURE_PROFILE_MM} onChange={setWardrobeHeight} />
          <NumericInput label={copy.columns} value={effectiveWardrobeColumns} min={1} max={wardrobeColumnLimit} onChange={setWardrobeColumns} />
          <NumericInput label={copy.wardrobeLayers} value={effectiveWardrobeLayers} min={1} max={wardrobeLayerLimit} onChange={setWardrobeLayers} />
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:grid-cols-4">
            <div><div className="text-[10px] font-black uppercase text-blue-400">{copy.columns}</div><div className="mt-1 font-black text-blue-950">{effectiveWardrobeColumns}</div></div>
            <div><div className="text-[10px] font-black uppercase text-blue-400">{copy.wardrobeColumnWidth}</div><div className="mt-1 font-black text-blue-950">{wardrobeColumnWidthMm}mm</div></div>
            <div><div className="text-[10px] font-black uppercase text-blue-400">{copy.wardrobeLayers}</div><div className="mt-1 font-black text-blue-950">{effectiveWardrobeLayers}</div></div>
            <div><div className="text-[10px] font-black uppercase text-blue-400">{copy.wardrobeGenerated}</div><div className="mt-1 font-black text-blue-950">{wardrobeProfileCount}</div></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-black text-slate-800"><Ruler className="h-4 w-4 text-blue-600" />{copy.profileSummary}</div><p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{isCalligraphy ? copy.calligraphyProfiles : copy.wardrobeProfiles}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-black text-slate-800"><Sparkles className="h-4 w-4 text-amber-500" />{copy.machiningSummary}</div><p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{isCalligraphy ? copy.calligraphyMachining : copy.wardrobeMachining}</p></div>
      </div>

      {isCalligraphy && <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold leading-relaxed text-amber-800">{copy.supportPricing}</p>}

      <button data-testid="furniture-generate" type="button" onClick={generate} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500">
        <Sparkles className="h-5 w-5" />{copy.generate}
      </button>
      <p className="text-center text-xs font-bold text-slate-400">{copy.editable}</p>
    </div>
  );
};

export default FurnitureConfigurator;
