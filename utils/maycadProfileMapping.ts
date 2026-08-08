export interface MaycadProfileMapping {
  maycadCode: string;
  mengkaileVariantId: string;
  confidence: number;
  note: string;
}

// Only add exact mappings after checking a real MayCAD source file or catalog
// section against Mengkaile's physical cross-section. A customer's later manual
// replacement in the designer does not change the source profile's default map.
export const MAYCAD_PROFILE_MAPPINGS: readonly MaycadProfileMapping[] = [
  {
    maycadCode: 'PROF20-2020',
    mengkaileVariantId: '2020',
    confidence: 0.98,
    note: '普通 20×20 四面槽型材',
  },
  {
    maycadCode: 'PROF20-2020-21SP',
    mengkaileVariantId: '2020-N1',
    confidence: 0.96,
    note: '20×20 单封闭面型材',
  },
  {
    maycadCode: 'PROF20-2020-22SP',
    mengkaileVariantId: '2020-N2',
    confidence: 0.96,
    note: '20×20 两个相邻封闭面型材',
  },
  {
    maycadCode: 'PROF20-2040',
    mengkaileVariantId: '2040',
    confidence: 0.98,
    note: '普通 20×40 型材；2040-N1-40 是用户导入后手动替换的本站型号',
  },
] as const;

const mappingByCode = new Map(
  MAYCAD_PROFILE_MAPPINGS.map((mapping) => [mapping.maycadCode, mapping]),
);

export interface ResolvedMaycadProfile {
  variantId: string;
  confidence: number;
  exact: boolean;
}

export const resolveMaycadProfileVariant = (
  profileCode: string,
  widthCm: number,
  depthCm: number,
): ResolvedMaycadProfile => {
  const normalizedCode = profileCode.trim().toUpperCase();
  const exact = mappingByCode.get(normalizedCode);
  if (exact) {
    return {
      variantId: exact.mengkaileVariantId,
      confidence: exact.confidence,
      exact: true,
    };
  }

  // Dimension-only fallback keeps an unknown scene editable but is never
  // presented as an authoritative SKU match.
  const dimensions = [Math.round(widthCm * 10), Math.round(depthCm * 10)]
    .sort((a, b) => a - b)
    .join('x');
  if (dimensions === '20x40') return { variantId: '2040', confidence: 0.65, exact: false };
  if (dimensions === '20x20') return { variantId: '2020', confidence: 0.65, exact: false };
  return { variantId: '2020', confidence: 0.35, exact: false };
};
