import type { Language, ProfileSide } from '../types';

export type APillarMillingId = 'narrow_single' | 'narrow_double' | 'wide_single';
export type APillarMillingOption = APillarMillingId | 'none';

/** Repeated A-pillar slots are separate from drilled fastener holes. */
export interface APillarMillingConfig {
  specId: APillarMillingId;
  face: ProfileSide;
}

export interface APillarMillingSpec {
  id: APillarMillingId;
  name: Record<Language, string>;
  dimensions: Record<Language, string>;
  /** Additional machining charge in RMB per metre; profile material is separate. */
  feePerMeter: number;
  /** Set after the product photograph is supplied. */
  imageUrl?: string;
}

export const A_PILLAR_MILLING_SPECS: readonly APillarMillingSpec[] = [
  {
    id: 'narrow_single',
    name: { cn: '窄面单排', en: 'Narrow single row', jp: '細幅・単列' },
    dimensions: { cn: '3 × 14 mm', en: '3 × 14 mm', jp: '3 × 14 mm' },
    feePerMeter: 13,
  },
  {
    id: 'narrow_double',
    name: { cn: '窄面双排', en: 'Narrow double row', jp: '細幅・複列' },
    dimensions: { cn: '3 × 14 mm，间隔 5 mm', en: '3 × 14 mm, 5 mm gap', jp: '3 × 14 mm、間隔 5 mm' },
    feePerMeter: 16,
  },
  {
    id: 'wide_single',
    name: { cn: '加宽单排', en: 'Wide single row', jp: '広幅・単列' },
    dimensions: { cn: '8 × 14 mm', en: '8 × 14 mm', jp: '8 × 14 mm' },
    feePerMeter: 23,
  },
];

const SUPPORTED_MILLING: Readonly<Record<string, readonly APillarMillingId[]>> = {
  '2040': ['narrow_single', 'wide_single'],
  '2040-N1-20': ['narrow_single', 'wide_single'],
  '2040-N1-40': ['narrow_single', 'wide_single'],
  '3030-N1': ['narrow_single', 'narrow_double', 'wide_single'],
  '3030-N2': ['narrow_single', 'narrow_double', 'wide_single'],
  '2047': ['narrow_single', 'narrow_double'],
};

export function getAPillarMillingSpecs(model: string): readonly APillarMillingSpec[] {
  const supported = Object.hasOwn(SUPPORTED_MILLING, model) ? SUPPORTED_MILLING[model] : [];
  return A_PILLAR_MILLING_SPECS.filter(spec => supported.includes(spec.id));
}

export function getAPillarMillingSpec(model: string, selection?: string | null): APillarMillingSpec | undefined {
  return getAPillarMillingSpecs(model).find(spec => spec.id === selection);
}

export function normalizeAPillarMilling(model: string, selection?: string | null): APillarMillingOption {
  return getAPillarMillingSpec(model, selection)?.id || 'none';
}

// Closed faces or the central land between the two grooves on a wide face.
// A/C are the narrow faces of rectangular profiles; B/D are the wide faces.
const MILLING_FACES: Readonly<Record<string, readonly ProfileSide[]>> = {
  '2040': ['B', 'D'],
  '2040-N1-20': ['A', 'B', 'D'],
  '2040-N1-40': ['D', 'B'],
  '2047': ['B', 'D', 'A'],
  '3030-N1': ['A'],
  '3030-N2': ['A', 'B'],
};

export const A_PILLAR_PITCH_MM = 25;
export const A_PILLAR_SLOT_HEIGHT_MM = 14;

export function getAPillarMillingFaces(model: string): readonly ProfileSide[] {
  return Object.hasOwn(MILLING_FACES, model) ? MILLING_FACES[model] : [];
}

export function normalizeAPillarMillingConfig(model: string, input: unknown): APillarMillingConfig | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = input as Partial<APillarMillingConfig>;
  const spec = getAPillarMillingSpec(model, value.specId);
  const faces = getAPillarMillingFaces(model);
  if (!spec || !faces.length) return undefined;
  return { specId: spec.id, face: faces.includes(value.face as ProfileSide) ? value.face! : faces[0] };
}

/** Imports must not silently discard machining or substitute a different face. */
export function readAPillarMillingConfig(model: string, input: unknown): APillarMillingConfig | undefined {
  if (input === undefined) return undefined;
  const config = normalizeAPillarMillingConfig(model, input);
  if (!config || config.face !== (input as APillarMillingConfig).face) {
    throw new Error(`A柱铣型规格或加工面不适用于 ${model}，请核对原始加工配置。`);
  }
  return config;
}

export function getAPillarMillingLayout(model: string, length: number, input?: APillarMillingConfig) {
  const config = normalizeAPillarMillingConfig(model, input);
  const spec = config && getAPillarMillingSpec(model, config.specId);
  if (!config || !spec) return undefined;
  const lengthMm = Number.isFinite(length) ? Math.max(0, Math.round(length)) : 0;
  const count = lengthMm < A_PILLAR_SLOT_HEIGHT_MM ? 0 : Math.floor((lengthMm - A_PILLAR_SLOT_HEIGHT_MM) / A_PILLAR_PITCH_MM) + 1;
  // Keep complete slots, with the remaining length shared between both ends.
  // Whole-mm centres make the two end margins differ by at most 1 mm.
  const firstCenterMm = Math.ceil((lengthMm - (count - 1) * A_PILLAR_PITCH_MM) / 2);
  return {
    spec, face: config.face, pitchMm: A_PILLAR_PITCH_MM,
    widthMm: spec.id === 'wide_single' ? 8 : 3,
    heightMm: A_PILLAR_SLOT_HEIGHT_MM,
    centersMm: Array.from({ length: count }, (_, index) => firstCenterMm + index * A_PILLAR_PITCH_MM),
    columnOffsetsMm: spec.id === 'narrow_double' ? [-4, 4] : [0],
  };
}

export function describeAPillarMilling(model: string, length: number, input: APillarMillingConfig | undefined, language: Language = 'cn'): string {
  const layout = getAPillarMillingLayout(model, length, input);
  if (!layout) return '';
  const { spec, face, centersMm, columnOffsetsMm } = layout;
  const count = centersMm.length * columnOffsetsMm.length;
  const first = centersMm[0] ?? 0;
  const last = centersMm.at(-1) ?? 0;
  if (language === 'en') return `A-pillar ${spec.name.en} (${spec.dimensions.en}), face ${face}, pitch 25 mm, ${count} slots; centres from start ${first}–${last} mm; +${spec.feePerMeter}/m`;
  if (language === 'jp') return `A柱 ${spec.name.jp}（${spec.dimensions.jp}）、${face}面、ピッチ25mm、${count}穴；始点から穴中心${first}〜${last}mm；+${spec.feePerMeter}/m`;
  return `A柱${spec.name.cn}（${spec.dimensions.cn}），${face}面，孔距25mm，共${count}孔；首/末孔中心距起点${first}/${last}mm；+${spec.feePerMeter}元/米`;
}
