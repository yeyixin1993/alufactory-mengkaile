import type { ScrewHeadType, ThreadSize } from '../types';

export type FastenerEvidenceStatus = 'design_rule_confirmed' | 'standard_reference' | 'pending_measurement';

export interface DesignerFastenerCatalogEntry {
  readonly id: string;
  readonly profileId: '2020' | '3030';
  readonly names: Readonly<Record<'zh-CN' | 'en' | 'ja', string>>;
  readonly headType: ScrewHeadType;
  readonly threadSize: ThreadSize;
  readonly lengthMm: number;
  readonly includesElasticFastener: boolean;
  readonly standard: 'ISO 4762' | 'ISO 7380-1' | 'ISO 10642';
  readonly supplierSku: null;
  readonly specificationEvidence: FastenerEvidenceStatus;
  readonly tool: Readonly<{
    family: 'hex_key';
    driveSizeMm: number;
    driveSizeEvidence: 'standard_reference';
    /** Conservative detection envelope; never treated as a measured tool dimension. */
    screeningStraightReachMm: 80;
    screeningEnvelopeRadiusMm: 12;
    measuredStraightReachMm: null;
    measuredEnvelopeRadiusMm: null;
    clearanceEvidence: 'pending_measurement';
  }>;
  readonly evidence: Readonly<{
    designRule: string;
    driveReferenceUrl: string;
  }>;
}

const DRIVE_REFERENCE_URL = 'https://media.bossard.com/za-en/-/media/bossard-group/website/documents/technical-resources/en/f-077-en.pdf';

const makeEntry = (
  entry: Omit<DesignerFastenerCatalogEntry, 'supplierSku' | 'specificationEvidence' | 'tool' | 'evidence'> & {
    driveSizeMm: number;
    designRule: string;
  },
): DesignerFastenerCatalogEntry => {
  const { driveSizeMm, designRule, ...identity } = entry;
  return Object.freeze({
    ...identity,
    names: Object.freeze(identity.names),
    supplierSku: null,
    specificationEvidence: 'design_rule_confirmed',
    tool: Object.freeze({
      family: 'hex_key',
      driveSizeMm,
      driveSizeEvidence: 'standard_reference',
      screeningStraightReachMm: 80,
      screeningEnvelopeRadiusMm: 12,
      measuredStraightReachMm: null,
      measuredEnvelopeRadiusMm: null,
      clearanceEvidence: 'pending_measurement',
    }),
    evidence: Object.freeze({
      designRule,
      driveReferenceUrl: DRIVE_REFERENCE_URL,
    }),
  });
};

/**
 * Price-free, exact identities used by the current designer rules.
 *
 * These records prove profile/head/thread/length identity only. A supplier SKU,
 * material/property class, torque and measured tool envelope are intentionally
 * absent until a drawing or physical sample has been checked.
 */
export const DESIGNER_FASTENER_CATALOG: readonly DesignerFastenerCatalogEntry[] = Object.freeze([
  makeEntry({
    id: 'aluformula.fastener.2020.socket_cylinder.m6x30',
    profileId: '2020',
    names: { 'zh-CN': 'M6×30 内六角圆柱头螺钉', en: 'M6×30 hex socket head cap screw', ja: 'M6×30 六角穴付きボルト' },
    headType: 'socket_cylinder',
    threadSize: 'M6',
    lengthMm: 30,
    includesElasticFastener: false,
    standard: 'ISO 4762',
    driveSizeMm: 5,
    designRule: '2020直锁连接：M6×30圆柱头',
  }),
  makeEntry({
    id: 'aluformula.fastener.2020.button_socket.m6x20',
    profileId: '2020',
    names: { 'zh-CN': 'M6×20 内六角按钮头螺钉', en: 'M6×20 hex socket button head screw', ja: 'M6×20 六角穴付きボタンボルト' },
    headType: 'button_socket',
    threadSize: 'M6',
    lengthMm: 20,
    includesElasticFastener: false,
    standard: 'ISO 7380-1',
    driveSizeMm: 4,
    designRule: '2020槽内按钮头连接：M6×20',
  }),
  makeEntry({
    id: 'aluformula.fastener.2020.flat_socket.m6x8',
    profileId: '2020',
    names: { 'zh-CN': 'M6×8 内六角沉头螺钉', en: 'M6×8 hex socket countersunk screw', ja: 'M6×8 六角穴付き皿ボルト' },
    headType: 'flat_socket',
    threadSize: 'M6',
    lengthMm: 8,
    includesElasticFastener: false,
    standard: 'ISO 10642',
    driveSizeMm: 4,
    designRule: '2020柜体沉头连接：M6×8',
  }),
  makeEntry({
    id: 'aluformula.fastener.3030.socket_cylinder.m8x45',
    profileId: '3030',
    names: { 'zh-CN': 'M8×45 内六角圆柱头螺钉', en: 'M8×45 hex socket head cap screw', ja: 'M8×45 六角穴付きボルト' },
    headType: 'socket_cylinder',
    threadSize: 'M8',
    lengthMm: 45,
    includesElasticFastener: false,
    standard: 'ISO 4762',
    driveSizeMm: 6,
    designRule: '3030直锁连接：M8×45圆柱头',
  }),
  makeEntry({
    id: 'aluformula.fastener.3030.button_socket.m8x20-spring-kit',
    profileId: '3030',
    names: { 'zh-CN': 'M8×20 内六角按钮头螺钉＋弹性紧固件', en: 'M8×20 hex socket button head screw + elastic fastener', ja: 'M8×20 六角穴付きボタンボルト＋弾性ナット' },
    headType: 'button_socket',
    threadSize: 'M8',
    lengthMm: 20,
    includesElasticFastener: true,
    standard: 'ISO 7380-1',
    driveSizeMm: 5,
    designRule: '3030槽内按钮头连接：M8×20＋弹性紧固件',
  }),
]);

export const findDesignerFastenerByRule = (
  profileId: string | undefined,
  headType: ScrewHeadType | undefined,
) => DESIGNER_FASTENER_CATALOG.find((entry) => (
  entry.profileId === profileId && entry.headType === headType
)) || null;

export const findDesignerFastenerExact = (input: {
  profileId?: string;
  headType?: ScrewHeadType;
  threadSize?: string;
  lengthMm?: number;
}) => DESIGNER_FASTENER_CATALOG.find((entry) => (
  entry.profileId === input.profileId
  && entry.headType === input.headType
  && entry.threadSize === String(input.threadSize || '').toUpperCase()
  && Number.isFinite(input.lengthMm)
  && Math.abs(entry.lengthMm - Number(input.lengthMm)) <= 0.5
)) || null;

export const getDesignerFastenersForProfile = (profileId: string) => (
  DESIGNER_FASTENER_CATALOG.filter((entry) => entry.profileId === profileId)
);
