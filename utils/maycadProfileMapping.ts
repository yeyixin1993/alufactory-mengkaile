export interface MaycadProfileMapping {
  maycadCode: string;
  mengkaileVariantId: string;
  confidence: number;
  note: string;
}

const mappingsFor = (
  maycadCodes: readonly string[],
  mengkaileVariantId: string,
  confidence: number,
  note: string,
): MaycadProfileMapping[] => maycadCodes.map((maycadCode) => ({
  maycadCode,
  mengkaileVariantId,
  confidence,
  note,
}));

// Only add exact mappings after checking a real MayCAD source file or catalog
// section against Mengkaile's physical cross-section. A customer's later manual
// replacement in the designer does not change the source profile's default map.
export const MAYCAD_PROFILE_MAPPINGS: readonly MaycadProfileMapping[] = [
  ...mappingsFor(
    ['PROF20-2020', 'PROF20-2020-43SP'],
    '2020',
    0.99,
    '普通 20×20 四面槽型材',
  ),
  ...mappingsFor(
    ['PROF20-2020-21SP'],
    '2020R',
    0.99,
    '20×20 圆弧外形型材',
  ),
  ...mappingsFor(
    ['PROF20-2020-22SP'],
    '2020-N2',
    0.99,
    '20×20 两个相邻封闭面型材',
  ),
  ...mappingsFor(
    ['PROF20-2020-23LP'],
    '2020-N2-OPP',
    0.99,
    '20×20 两个相对封闭面型材',
  ),
  ...mappingsFor(
    ['PROF20-2020-33SP'],
    '2020-N1',
    0.99,
    '20×20 单封闭面型材',
  ),
  ...mappingsFor(
    ['PROF20-2040', 'PROF20-2040-44SP', 'PROF20-2040-64SP'],
    '2040',
    0.99,
    'MayCAD 20×40 变体统一对应萌开了普通 2040',
  ),
  ...mappingsFor(
    [
      'PROF30-3002L',
      'PROF30-3002L-GR',
      'PROF30-3002SP',
      'PROF30-3002SP-GR',
      'PROF30-3030S.22',
      'PROF30-3030SP.22',
    ],
    '3030-N2',
    0.99,
    'MayCAD 30×30 2H 变体统一对应萌开了 3030-N2',
  ),
  ...mappingsFor(
    [
      'PROF30-3003L',
      'PROF30-3003L-GR',
      'PROF30-3003SP',
      'PROF30-3003SP-GR',
    ],
    '3030-N1',
    0.99,
    'MayCAD 30×30 3H 变体统一对应萌开了 3030-N1',
  ),
  ...mappingsFor(
    [
      'PROF30-3030L',
      'PROF30-3030L-GR',
      'PROF30-3030SP',
      'PROF30-3030SP-GR',
    ],
    '3030',
    0.99,
    'MayCAD 30×30 4H 变体统一对应萌开了普通 3030',
  ),
  ...mappingsFor(
    ['PROF30-3030Q', 'PROF30-3030Q-GR'],
    '3030R',
    0.99,
    'MayCAD 30×30 Soft/圆弧外形型材对应萌开了 3030R',
  ),
  ...mappingsFor(
    ['PROF30-3060L', 'PROF30-3060L-GR', 'PROF30-3060S', 'PROF30-3060SP'],
    '3060',
    0.99,
    'MayCAD 30×60 变体统一对应萌开了普通 3060',
  ),
  ...mappingsFor(
    ['PROF40-4040', 'PROF40-4040L', 'PROF40-4040LG', 'PROF40-4040S'],
    '4040',
    0.99,
    'MayCAD 40×40 变体统一对应萌开了普通 4040',
  ),
  ...mappingsFor(
    ['PROF40-4080', 'PROF40-4080L', 'PROF40-4080LG', 'PROF40-4080S'],
    '4080',
    0.99,
    'MayCAD 40×80 变体统一对应萌开了普通 4080',
  ),
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
  if (dimensions === '30x30') return { variantId: '3030', confidence: 0.65, exact: false };
  if (dimensions === '30x60') return { variantId: '3060', confidence: 0.65, exact: false };
  if (dimensions === '40x40') return { variantId: '4040', confidence: 0.65, exact: false };
  if (dimensions === '40x80') return { variantId: '4080', confidence: 0.65, exact: false };
  return { variantId: '2020', confidence: 0.35, exact: false };
};
