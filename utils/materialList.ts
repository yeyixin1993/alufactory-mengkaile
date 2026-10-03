import type { buildProductionData } from '../components/DIYDesigner';
import { getReferenceHardwareBySceneType } from '../data/referenceHardwareCatalog';
import { getStoolAccessory } from '../data/stoolAccessoryCatalog';

/**
 * A price-free, read-only projection of the current design. It must never be
 * interpreted as a released cutting, drilling, purchasing or installation list.
 * In particular, one source BOM-only row contributes its recorded quantity but
 * does not become a positioned scene component.
 */
type BaseInput = ReturnType<typeof buildProductionData>;
export type MaterialListInput = Omit<BaseInput, 'parts' | 'holes'> & {
  holes: Array<BaseInput['holes'][number] & { fastenerSeat?: 'surface' | 'internal_slot' }>;
  parts: Array<BaseInput['parts'][number] & {
    catalogItemId?: string; fastenerCatalogId?: string; importedBomOnly?: boolean;
    boardCutouts?: import('./boardCutouts').BoardCutoutMm[];
    boardAreaBasis?: string; boardGrossAreaMm2?: number; boardNetAreaMm2?: number;
    doorHingeCount?: number; doorHingePositionStatus?: string;
    profileMachiningKey?: string; screwOrderThreadSize?: string; screwOrderLengthMm?: number;
    screwIncludesElasticFastener?: boolean; catalogEvidenceStatus?: string; alubuildImport?: unknown;
  }>;
};
type ProductionPart = MaterialListInput['parts'][number];
type ProductionHole = MaterialListInput['holes'][number];
export type MaterialListRowState = 'recorded' | 'review_required' | 'design_only';

export interface MaterialListRow {
  id: string;
  category: string;
  specification: string;
  finish: string;
  quantity: number;
  unit: string;
  machiningNotes: string[];
  reviewNotes: string[];
  partIds: string[];
  state: MaterialListRowState;
  modelId?: string;
  catalogItemId?: string;
  bomOnly?: boolean;
}

export interface MaterialListSection {
  id: string;
  title: string;
  rows: MaterialListRow[];
}

export interface MaterialList {
  sections: MaterialListSection[];
  totalQuantity: number;
  sourcePartCount: number;
  hasReviewRequired: boolean;
}

export interface MaterialListOptions {
  language?: 'cn' | 'en' | 'jp';
}

type CategoryId = 'profiles' | 'panels' | 'connectors' | 'fasteners' | 'other';
const CATEGORY_ORDER: CategoryId[] = ['profiles', 'panels', 'connectors', 'fasteners', 'other'];

const COPY = {
  cn: {
    sections: { profiles: '铝型材', panels: '板件 / 托板', connectors: '连接件', fasteners: '螺丝螺母', other: '其他配件' },
    names: {
      profile: '铝型材', plate: '铝板', pegboard: '洞洞板', marine_board: '海洋板', cabinet_door: '柜门',
      connector: '直角连接件', extruded_connector: '挤压角件', hidden_connector: '内置连接件',
      l_connector: 'L 形连接件', t_connector: 'T 形连接件', tee_connector: '三维角连接件',
      screw: '螺钉', shelf_support: '层板托 / 光轴件', foot: '地脚', caster: '脚轮', end_cap: '端盖',
    },
    unrecorded: '未记录', dimensionPending: '尺寸待补', modelPending: '具体型号待补',
    length: '长度', section: '适配', diameter: '直径', thickness: '厚',
    leftTap: '左端攻丝', rightTap: '右端攻丝', hole: '孔', face: '面', groove: '槽',
    fromLeft: '距左端', through: '通孔', countersunk: '沉头孔', threaded: '螺纹孔',
    count: '处', includedNut: '该螺钉记录含配套弹性紧固件；未另计螺母数量',
    bomOnly: '来自无安装坐标的原始材料行；仅计数量，不代表已在 3D 模型定位',
    catalogPending: '材料 / 型号的生产资料尚待供应商及实物核对',
    importedPending: '导入来源待工程核对',
    draftPending: '设计草稿来源待工程核对',
    cutoutPending: '异形切口及余料仅为设计几何，不能按矩形净板直接下料',
    cutoutInvalid: '切口来源失效；原净面积不得作为加工依据',
    blank: '毛坯', net: '扣切口后模型实体面积',
    hingePending: '铰链仅为概念数量；未确定 SKU 和孔位，未另列采购数量',
    screwSpecPending: '螺钉规格未完整记录',
    qtyPending: '来源数量无效，需核对',
  },
  en: {
    sections: { profiles: 'Aluminum profiles', panels: 'Panels / shelves', connectors: 'Connectors', fasteners: 'Screws and nuts', other: 'Other parts' },
    names: {
      profile: 'Aluminum profile', plate: 'Aluminum plate', pegboard: 'Pegboard', marine_board: 'Marine board', cabinet_door: 'Cabinet door',
      connector: 'Angle connector', extruded_connector: 'Extruded bracket', hidden_connector: 'Hidden connector',
      l_connector: 'L connector', t_connector: 'T connector', tee_connector: 'Three-way connector',
      screw: 'Screw', shelf_support: 'Shelf / shaft part', foot: 'Foot', caster: 'Caster', end_cap: 'End cap',
    },
    unrecorded: 'not recorded', dimensionPending: 'dimensions pending', modelPending: 'exact model pending',
    length: 'length', section: 'fit', diameter: 'diameter', thickness: 'thickness',
    leftTap: 'left-end taps', rightTap: 'right-end taps', hole: 'hole', face: 'face', groove: 'groove',
    fromLeft: 'from left end', through: 'through', countersunk: 'countersunk', threaded: 'threaded',
    count: 'locations', includedNut: 'Elastic fastener included with this screw line; no separate nut quantity inferred',
    bomOnly: 'Source BOM row has no placement coordinates; quantity is counted without inventing 3D placement',
    catalogPending: 'Supplier / physical validation of material or model is pending',
    importedPending: 'Imported source needs engineering review',
    draftPending: 'Design-draft source needs engineering review',
    cutoutPending: 'Cutouts and remaining material are design geometry, not released cutting data',
    cutoutInvalid: 'Cutout source is invalid; net area cannot guide fabrication',
    blank: 'gross blank', net: 'modeled solid area after cutouts',
    hingePending: 'Hinge count is conceptual; no SKU, drilling position or separate purchase quantity established',
    screwSpecPending: 'Screw specification is incomplete',
    qtyPending: 'Source quantity is invalid and needs review',
  },
  jp: {
    sections: { profiles: 'アルミフレーム', panels: '板材 / 棚板', connectors: '接続部品', fasteners: 'ねじ・ナット', other: 'その他の部品' },
    names: {
      profile: 'アルミフレーム', plate: 'アルミ板', pegboard: '有孔板', marine_board: 'マリンボード', cabinet_door: '扉',
      connector: '直角接続部品', extruded_connector: '押出ブラケット', hidden_connector: '内蔵接続部品',
      l_connector: 'L形接続部品', t_connector: 'T形接続部品', tee_connector: '三方向接続部品',
      screw: 'ねじ', shelf_support: '棚受け / シャフト部品', foot: '脚', caster: 'キャスター', end_cap: 'エンドキャップ',
    },
    unrecorded: '未記録', dimensionPending: '寸法未記録', modelPending: '型番未記録',
    length: '長さ', section: '対応', diameter: '直径', thickness: '厚さ',
    leftTap: '左端タップ', rightTap: '右端タップ', hole: '穴', face: '面', groove: '溝',
    fromLeft: '左端から', through: '貫通穴', countersunk: '皿穴', threaded: 'ねじ穴',
    count: '箇所', includedNut: '弾性固定具はこのねじ行に含まれ、ナットを別途加算しません',
    bomOnly: '配置座標のない元BOM行です。数量のみ計上し、3D配置は作成しません',
    catalogPending: '材料 / 型番の供給元・実物確認が必要です',
    importedPending: '取込元の設計確認が必要です',
    draftPending: '設計草案の確認が必要です',
    cutoutPending: '切欠きと残材は設計形状であり、加工データではありません',
    cutoutInvalid: '切欠き元が無効で、正味面積を加工に使用できません',
    blank: '素材', net: '切欠き後のモデル面積',
    hingePending: 'ヒンジ数は概念値です。SKU・穴位置・別発注数量は未確定です',
    screwSpecPending: 'ねじ仕様が不足しています',
    qtyPending: '元データの数量が無効です',
  },
} as const;

const categoryOf = (type: string): CategoryId => {
  if (type === 'profile') return 'profiles';
  if (type === 'plate' || type === 'pegboard' || type === 'marine_board' || type === 'cabinet_door') return 'panels';
  if (type === 'connector' || type === 'extruded_connector' || type === 'hidden_connector'
    || type === 'l_connector' || type === 't_connector' || type === 'tee_connector') return 'connectors';
  if (type === 'screw') return 'fasteners';
  return 'other';
};

const validNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const mm = (value: unknown): string | null => validNumber(value) ? `${value} mm` : null;
const normalizeQuantity = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
const dedupe = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

const holeSignature = (hole: ProductionHole) => ({
  entryFace: hole.entryFace,
  entryGroove: hole.entryGroove,
  exitFace: hole.exitFace,
  exitGroove: hole.exitGroove,
  physicalGrooveId: hole.physicalGrooveId,
  leftDistanceMm: hole.leftDistanceMm,
  rightDistanceMm: hole.rightDistanceMm,
  diameterMm: hole.diameterMm,
  holeType: hole.holeType,
  threadSize: hole.threadSize,
  suppressAutoFastener: hole.suppressAutoFastener,
  fastenerHead: hole.fastenerHead,
  fastenerLengthMm: hole.fastenerLengthMm,
  fastenerDirection: hole.fastenerDirection,
  fastenerSeat: hole.fastenerSeat,
  verification: hole.verification,
});

const boardCutoutSignature = (part: ProductionPart) => {
  if (!Array.isArray(part.boardCutouts)) return part.boardCutouts === undefined ? null : 'invalid';
  return part.boardCutouts.map((cut) => (cut && typeof cut === 'object'
    ? { xMm: cut.xMm, yMm: cut.yMm, widthMm: cut.widthMm, heightMm: cut.heightMm }
    : { invalid: cut })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
};

/** Exact observable purchasing / machining identity; source positions and IDs are provenance, not group keys. */
const groupingKey = (part: ProductionPart, holes: ProductionHole[]): string => JSON.stringify({
  type: part.type,
  model: part.model,
  catalogItemId: part.catalogItemId || part.partCatalogRef?.catalogItemId || '',
  lengthMm: part.lengthMm,
  widthMm: part.widthMm,
  heightMm: part.heightMm,
  thicknessMm: part.thicknessMm,
  finish: part.finish,
  colorId: part.colorId,
  shelfSupportType: part.shelfSupportType,
  fixedReferenceId: part.fixedReferenceId,
  shaftDiameterMm: part.shaftDiameterMm,
  accessoryProfileSize: part.accessoryProfileSize,
  accessoryThreadSize: part.accessoryThreadSize,
  hasBrake: part.hasBrake,
  doorMaterial: part.doorMaterial,
  doorOverlay: part.doorOverlay,
  openingSide: part.openingSide,
  doorHingeCount: part.doorHingeCount,
  pegHolePattern: part.pegHolePattern,
  boardAreaBasis: part.boardAreaBasis,
  boardCutouts: boardCutoutSignature(part),
  leftTappingPorts: part.leftTappingPorts,
  rightTappingPorts: part.rightTappingPorts,
  // The editor's profile key permits only explicitly approved square-profile
  // self-rotation equivalence. In older projections fall back to the complete
  // recorded hole signature, never to a hole count.
  profileMachiningKey: part.type === 'profile' ? part.profileMachiningKey || null : null,
  holes: part.type === 'profile' && part.profileMachiningKey
    ? holes.map((hole) => ({
      fastenerDirection: hole.fastenerDirection,
      fastenerSeat: hole.fastenerSeat,
    })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    : holes.map(holeSignature).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  screwHead: part.screwHead,
  screwOrderThreadSize: part.screwOrderThreadSize,
  screwOrderLengthMm: part.screwOrderLengthMm,
  screwIncludesElasticFastener: part.screwIncludesElasticFastener,
  fastenerCatalogId: part.fastenerCatalogId,
  importedBomOnly: Boolean(part.importedBomOnly),
  // Do not merge a reviewed source row into a draft of the same visible size.
  catalogEvidenceStatus: part.catalogEvidenceStatus,
  doorHingePositionStatus: part.doorHingePositionStatus,
  designDraftMarkers: [...(part.designDraftMarkers || [])].sort(),
  // Marker payloads are not part of the production projection. Without them,
  // equivalence of two individually unresolved drafts cannot be proven.
  unresolvedDraftPartId: part.designDraftMarkers?.length || part.alubuildImport
    || part.boardAreaBasis === 'invalid_source_geometry' ? part.id : null,
});

const holeNote = (hole: ProductionHole, language: keyof typeof COPY): string => {
  const t = COPY[language];
  const kind = hole.holeType === 'through' ? t.through : hole.holeType === 'countersunk' ? t.countersunk : t.threaded;
  const face = `${hole.entryFace}${t.face}${hole.entryGroove !== '-' ? ` ${hole.entryGroove}${t.groove}` : ''}`;
  const position = Number.isFinite(hole.leftDistanceMm) ? `${t.fromLeft} ${hole.leftDistanceMm} mm` : t.dimensionPending;
  const diameter = validNumber(hole.diameterMm) ? `Ø${hole.diameterMm} mm` : '';
  const direction = hole.fastenerDirection === 'outward'
    ? (language === 'cn' ? '紧固方向：向外' : language === 'jp' ? '締結方向：外向き' : 'fastener direction: outward')
    : '';
  const seat = hole.fastenerSeat === 'internal_slot'
    ? (language === 'cn' ? '螺钉座：槽内' : language === 'jp' ? 'ねじ座：溝内' : 'screw seat: inside slot')
    : '';
  const withoutAutoFastener = hole.suppressAutoFastener
    ? (language === 'cn' ? '不自动配螺丝' : language === 'jp' ? 'ねじ自動追加なし' : 'no automatic screw')
    : '';
  return [face, position, kind, diameter, hole.threadSize || '', direction, seat, withoutAutoFastener].filter(Boolean).join(' · ');
};

const finishOf = (part: ProductionPart, language: keyof typeof COPY): string => {
  const accessory = getStoolAccessory(part.partCatalogRef?.sourceRecordId || '');
  if (accessory && accessory.catalogItemId === part.partCatalogRef?.catalogItemId) return accessory.material.label[language];
  const finishName = part.finish === 'oxidized'
    ? (language === 'cn' ? '氧化' : language === 'jp' ? 'アルマイト' : 'anodized')
    : part.finish === 'electrophoretic'
      ? (language === 'cn' ? '电泳' : language === 'jp' ? '電着塗装' : 'electrophoretic')
      : part.finish === 'powder'
        ? (language === 'cn' ? '喷粉' : language === 'jp' ? '粉体塗装' : 'powder-coated')
        : '';
  return [part.color || part.colorId || COPY[language].unrecorded, finishName].filter(Boolean).join(' · ');
};

const nameOf = (part: ProductionPart, language: keyof typeof COPY): string => {
  const accessory = getStoolAccessory(part.partCatalogRef?.sourceRecordId || '');
  if (accessory && accessory.catalogItemId === part.partCatalogRef?.catalogItemId) return accessory.name[language];
  const reference = part.type === 'shelf_support' ? getReferenceHardwareBySceneType(part.shelfSupportType) : null;
  if (reference) {
    if (reference.categoryId === 'end_cap') return language === 'cn' ? '金属端盖' : 'Metal end cap';
    return reference.sceneType === 'end_mount_6060_m16'
      ? (language === 'cn' ? '端面安装块' : 'End mounting plate')
      : (language === 'cn' ? '调节地脚' : 'Leveling foot');
  }
  const names = COPY[language].names;
  return names[part.type as keyof typeof names] || part.type || COPY[language].unrecorded;
};

const specificationOf = (part: ProductionPart, language: keyof typeof COPY): string => {
  const accessory = getStoolAccessory(part.partCatalogRef?.sourceRecordId || '');
  if (accessory && accessory.catalogItemId === part.partCatalogRef?.catalogItemId) return accessory.specification[language];
  const t = COPY[language];
  const model = (typeof part.model === 'string' && part.model.trim()) ? part.model.trim() : t.modelPending;
  const pieces: string[] = [model];
  if (part.type === 'profile') {
    pieces.push(`${t.length} ${mm(part.lengthMm) || t.dimensionPending}`);
  } else if (categoryOf(part.type) === 'panels') {
    const dimensions = [part.widthMm, part.heightMm, part.thicknessMm].map((value) => validNumber(value) ? String(value) : '?').join(' × ');
    pieces.push(`${dimensions} mm`);
    if (part.type === 'cabinet_door') {
      pieces.push([part.doorMaterial, part.doorOverlay, part.openingSide].filter(Boolean).join(' / '));
    }
    if (part.pegHolePatternName) pieces.push(part.pegHolePatternName);
  } else if (part.type === 'screw') {
    if (part.screwOrderThreadSize && validNumber(part.screwOrderLengthMm)) {
      pieces.push(`${part.screwOrderThreadSize} × ${part.screwOrderLengthMm} mm`);
    } else if (part.accessoryThreadSize && validNumber(part.heightMm)) {
      pieces.push(`${part.accessoryThreadSize} × ${part.heightMm} mm`);
    } else {
      pieces.push(t.screwSpecPending);
    }
    if (part.screwHead) pieces.push(String(part.screwHead));
  } else {
    if (part.accessoryProfileSize) pieces.push(`${t.section} ${part.accessoryProfileSize}`);
    if (validNumber(part.shaftDiameterMm)) pieces.push(`Ø${part.shaftDiameterMm} mm`);
    if (part.accessoryThreadSize) pieces.push(part.accessoryThreadSize);
    const dims = [part.lengthMm, part.widthMm, part.heightMm, part.thicknessMm].filter(validNumber);
    if (dims.length) pieces.push(`${dims.join(' × ')} mm`);
    if (part.hasBrake === true) pieces.push(language === 'cn' ? '带刹车' : language === 'jp' ? 'ブレーキ付き' : 'with brake');
  }
  return pieces.filter(Boolean).join(' · ');
};

const machiningNotesOf = (part: ProductionPart, holes: ProductionHole[], language: keyof typeof COPY): string[] => {
  const t = COPY[language];
  const notes: string[] = [];
  if (part.type === 'profile') {
    if (part.leftTappingPorts > 0) notes.push(`${t.leftTap} ×${part.leftTappingPorts}`);
    if (part.rightTappingPorts > 0) notes.push(`${t.rightTap} ×${part.rightTappingPorts}`);
    notes.push(...holes.map((hole) => holeNote(hole, language)));
  }
  if (part.boardAreaBasis) {
    if (validNumber(part.boardGrossAreaMm2)) notes.push(`${t.blank} ${part.widthMm} × ${part.heightMm} mm / ${part.boardGrossAreaMm2} mm²`);
    if (part.boardAreaBasis === 'gross_blank_with_unreleased_cutouts' && validNumber(part.boardNetAreaMm2)) {
      notes.push(`${t.net} ${part.boardNetAreaMm2} mm²`);
    }
    if (Array.isArray(part.boardCutouts)) {
      part.boardCutouts.forEach((cutout) => {
        if (cutout && typeof cutout === 'object'
          && [cutout.xMm, cutout.yMm, cutout.widthMm, cutout.heightMm].every((value) => typeof value === 'number' && Number.isFinite(value))) {
          notes.push(`${language === 'cn' ? '切口' : language === 'jp' ? '切欠き' : 'cutout'} ${cutout.xMm}, ${cutout.yMm} / ${cutout.widthMm} × ${cutout.heightMm} mm`);
        }
      });
    }
  }
  return dedupe(notes);
};

const reviewNotesOf = (part: ProductionPart, language: keyof typeof COPY): string[] => {
  const t = COPY[language];
  const notes: string[] = [];
  if (part.importedBomOnly) notes.push(t.bomOnly);
  if (part.catalogEvidenceStatus) notes.push(t.catalogPending);
  if (part.alubuildImport) notes.push(t.importedPending);
  if (part.designDraftMarkers?.length) notes.push(`${t.draftPending}：${part.designDraftMarkers.join(', ')}`);
  if (part.boardAreaBasis === 'gross_blank_with_unreleased_cutouts') notes.push(t.cutoutPending);
  if (part.boardAreaBasis === 'invalid_source_geometry') notes.push(t.cutoutInvalid);
  if (part.doorHingePositionStatus) notes.push(t.hingePending);
  if (part.screwIncludesElasticFastener) notes.push(t.includedNut);
  if (normalizeQuantity(part.quantity) === 0) notes.push(t.qtyPending);
  if (part.remark) notes.push(part.remark);
  return dedupe(notes);
};

const stateOf = (part: ProductionPart): MaterialListRowState => {
  if (part.importedBomOnly || part.catalogEvidenceStatus || part.alubuildImport || part.boardAreaBasis
    || part.doorHingePositionStatus || part.designDraftMarkers?.length) return 'design_only';
  if (!part.model || normalizeQuantity(part.quantity) === 0) return 'review_required';
  if (part.type === 'profile' && !validNumber(part.lengthMm)) return 'review_required';
  if (categoryOf(part.type) === 'panels' && (![part.widthMm, part.heightMm, part.thicknessMm].every(validNumber))) return 'review_required';
  if (part.type === 'screw' && (!part.screwOrderThreadSize || !validNumber(part.screwOrderLengthMm))) return 'review_required';
  return 'recorded';
};

const stateRank: Record<MaterialListRowState, number> = { recorded: 0, review_required: 1, design_only: 2 };

/** Build the grouped, price-free list from the same production projection used by the editor. */
export const buildMaterialList = (data: MaterialListInput, options: MaterialListOptions = {}): MaterialList => {
  const language = options.language || 'cn';
  const t = COPY[language];
  const holesByPartId = new Map<string, ProductionHole[]>();
  data.holes.forEach((hole) => {
    const current = holesByPartId.get(hole.partId) || [];
    current.push(hole);
    holesByPartId.set(hole.partId, current);
  });

  const sectionMaps = new Map<CategoryId, Map<string, MaterialListRow>>(
    CATEGORY_ORDER.map((id) => [id, new Map<string, MaterialListRow>()]),
  );
  data.parts.forEach((part) => {
    const categoryId = categoryOf(part.type);
    const holes = holesByPartId.get(part.id) || [];
    const key = groupingKey(part, holes);
    const rows = sectionMaps.get(categoryId)!;
    const existing = rows.get(key);
    const quantity = normalizeQuantity(part.quantity);
    const notes = machiningNotesOf(part, holes, language);
    const reviews = reviewNotesOf(part, language);
    if (existing) {
      existing.quantity += quantity;
      existing.partIds.push(part.id);
      existing.machiningNotes = dedupe([...existing.machiningNotes, ...notes]);
      existing.reviewNotes = dedupe([...existing.reviewNotes, ...reviews]);
      if (stateRank[stateOf(part)] > stateRank[existing.state]) existing.state = stateOf(part);
      return;
    }
    rows.set(key, {
      id: '',
      category: nameOf(part, language),
      specification: specificationOf(part, language),
      finish: finishOf(part, language),
      quantity,
      unit: language === 'cn' ? '件' : language === 'jp' ? '個' : 'pcs',
      machiningNotes: notes,
      reviewNotes: reviews,
      partIds: [part.id],
      state: stateOf(part),
      modelId: part.model || undefined,
      catalogItemId: part.catalogItemId || part.partCatalogRef?.catalogItemId,
      bomOnly: Boolean(part.importedBomOnly),
    });
  });

  const sections = CATEGORY_ORDER.map((id) => {
    const rows = [...sectionMaps.get(id)!.values()].sort((a, b) =>
      a.specification.localeCompare(b.specification, language === 'cn' ? 'zh-CN' : language === 'jp' ? 'ja' : 'en')
      || a.finish.localeCompare(b.finish)
      || a.partIds[0].localeCompare(b.partIds[0]));
    rows.forEach((row, index) => { row.id = `${id}-${index + 1}`; });
    return { id, title: t.sections[id], rows };
  });
  return {
    sections,
    totalQuantity: sections.reduce((sum, section) => sum + section.rows.reduce((subtotal, row) => subtotal + row.quantity, 0), 0),
    sourcePartCount: data.parts.length,
    hasReviewRequired: sections.some((section) => section.rows.some((row) => row.state !== 'recorded')),
  };
};
