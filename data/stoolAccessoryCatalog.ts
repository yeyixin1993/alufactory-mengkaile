/** Independently placeable source geometry. Catalog identity never implies a commercial SKU. */
export type StoolAccessoryId = 'decorative_8080_30' | 'stainless_handle_126' | 'brake_caster_source';
export type StoolAccessoryText = Readonly<{ cn: string; en: string; jp: string }>;
export const STOOL_ACCESSORY_SOURCE_SHA256 = 'c8dcb2a4f1c9f452b87225a1e98c34323cb75a6b14bd92db7e97f52b27ab0166';
export const STOOL_ACCESSORY_CATALOG_REVISION = 'aluformula-unified-parts-2026-09-29' as const;

export interface StoolAccessoryCatalogEntry {
  readonly id: StoolAccessoryId;
  readonly type: 'decorative' | 'handle' | 'caster';
  readonly name: StoolAccessoryText;
  readonly description: StoolAccessoryText;
  readonly specification: StoolAccessoryText;
  /** Actual centred mesh local XYZ envelope; not a supplier's nominal dimensions. */
  readonly dimensionsMm: readonly [number, number, number];
  readonly categoryId: 'foot_caster' | 'other_accessory';
  readonly catalogItemId: string;
  readonly thumbnailUrl: string;
  readonly previewUrl: string;
  readonly sourceJsonUrl: string;
  readonly meshJsonUrl: string;
  readonly sourcePath: string;
  readonly sourceSha256: string;
  readonly semanticType: string;
  readonly material: Readonly<{ label: StoolAccessoryText; status: 'user_confirmed_family' | 'source_reference_only'; grade: null }>;
  readonly price: Readonly<{ status: 'pending'; value: null; currency: null }>;
  readonly sku: null;
  readonly scalePolicy: 'fixed_source_dimensions';
  readonly reviewStatus: 'source_geometry_only';
  readonly productionEligible: false;
  readonly canAddToScene: true;
  readonly sourceMeshSha256: string;
  /** Exact geometry identity, not a security, stock or manufacturing credential. */
  readonly geometrySignature: string;
  readonly bom: Readonly<{ unit: 'piece'; specification: string; quantityPerItem: 1; cutLengthMm?: number }>;
  readonly pendingEvidence: readonly string[];
}

const text = (cn: string, en: string, jp: string): StoolAccessoryText => ({ cn, en, jp });
const paths = (id: StoolAccessoryId) => ({
  thumbnailUrl: `/models/stool-accessories/${id}/thumbnail-source-v1.png`,
  previewUrl: `/models/stool-accessories/${id}/source-v1.glb`,
  sourceJsonUrl: `/models/stool-accessories/${id}/design-v1.json`,
  meshJsonUrl: `/models/stool-accessories/${id}/source-mesh-v1.json`,
});
const shared = {
  sourceSha256: STOOL_ACCESSORY_SOURCE_SHA256,
  price: { status: 'pending', value: null, currency: null }, sku: null,
  scalePolicy: 'fixed_source_dimensions', reviewStatus: 'source_geometry_only', productionEligible: false, canAddToScene: true,
} as const;

export const STOOL_ACCESSORY_CATALOG: readonly StoolAccessoryCatalogEntry[] = [
  {
    ...shared, ...paths('decorative_8080_30'), id: 'decorative_8080_30', type: 'decorative', categoryId: 'other_accessory',
    catalogItemId: 'aluformula.stool_accessory.decorative_8080_30', semanticType: 'stool_accessory:decorative_8080_30',
    name: text('8080装饰短料', '8080 decorative insert', '8080装飾インサート'),
    description: text('保留原模型镂空截面；固定80×80截面、30mm切长，仅作装饰件。', 'Original open section, 80×80 mm with a fixed 30 mm cut length; decorative use only.', '原モデルの中空断面を保持。80×80 mm断面・切断長30 mmの装飾部品。'),
    specification: text('截面80×80 · 切长30 mm', '80×80 section · 30 mm cut length', '断面80×80・切断長30 mm'),
    dimensionsMm: [30, 80, 80], sourcePath: 'root/groups-31',
    material: { label: text('铝型材外观，牌号待核', 'Aluminum profile reference; alloy pending', 'アルミ形材の参考外観・材質等級未確認'), status: 'source_reference_only', grade: null },
    sourceMeshSha256: 'f594230e0f4ea4f2dcbc068ad7a6a4cb34fd16b2cc5aa5c898bc508d94a98994', geometrySignature: 'fnv1a32:c07f96fe',
    bom: { unit: 'piece', specification: '8080装饰短料 80×80×30 mm', quantityPerItem: 1, cutLengthMm: 30 },
    pendingEvidence: ['装饰用途；不作为承重框架型材', '实际壁厚、铝合金牌号、表面处理与采购型号待核', '固定方式、加工与安装仍待核'],
  },
  {
    ...shared, ...paths('stainless_handle_126'), id: 'stainless_handle_126', type: 'handle', categoryId: 'other_accessory',
    catalogItemId: 'aluformula.stool_accessory.stainless_handle_126', semanticType: 'stool_accessory:stainless_handle_126',
    name: text('不锈钢拉手', 'Stainless steel handle', 'ステンレス取っ手'),
    description: text('独立拉手原网格；不锈钢类别已由用户确认，CAD量取孔距112 mm、孔Ø5.4 mm；实物与采购规格待核。', 'Original handle mesh; stainless steel confirmed by the user. CAD-measured hole pitch 112 mm and bore Ø5.4 mm; physical and purchase specifications pending.', '原取っ手メッシュ。ステンレス材質はユーザー確認済み。CAD測定の穴間隔112 mm・穴径Ø5.4 mm。実物と購入仕様は未確認。'),
    specification: text('原模型外廓126×52×43 mm', 'Source envelope 126×52×43 mm', '原モデル外形126×52×43 mm'),
    dimensionsMm: [126, 52, 43], sourcePath: 'root/instances-41',
    material: { label: text('不锈钢，牌号待核', 'Stainless steel; grade pending', 'ステンレス・材質等級未確認'), status: 'user_confirmed_family', grade: null },
    sourceMeshSha256: 'b8a0404bce85557f2efe88e014511687d987612f0fe3bddbc1e98fab0b0ad4c5', geometrySignature: 'fnv1a32:115fc42e',
    bom: { unit: 'piece', specification: '不锈钢拉手 原模型外廓126×52×43 mm', quantityPerItem: 1 },
    pendingEvidence: ['用户确认不锈钢类别；源名称中的304不视为采购牌号确认', '采购SKU、螺纹和螺丝长度待核；源CAD孔距112 mm、孔Ø5.4 mm已量取', 'CAD量取不等于实物确认；采购件须复测安装尺寸'],
  },
  {
    ...shared, ...paths('brake_caster_source'), id: 'brake_caster_source', type: 'caster', categoryId: 'foot_caster',
    catalogItemId: 'aluformula.stool_accessory.brake_caster_source', semanticType: 'stool_accessory:brake_caster_source',
    name: text('带刹车脚轮（原模型）', 'Brake caster (source model)', 'ブレーキ付きキャスター（原モデル）'),
    description: text('保留原脚轮轮廓、材质与刹车结构；未套用商品照片的尺寸或承重。', 'Original wheel, material and brake geometry; product-photo dimensions and load ratings are not substituted.', '原キャスターの形状・材質・ブレーキ構造を保持。商品写真の寸法や耐荷重は流用しません。'),
    specification: text('原模型外廓69.652×82.586×16.343 mm', 'Source envelope 69.652×82.586×16.343 mm', '原モデル外形69.652×82.586×16.343 mm'),
    dimensionsMm: [69.652046, 82.585972, 16.34304], sourcePath: 'root/instances-37',
    material: { label: text('金属支架／轮面材质待核', 'Metal bracket; wheel material pending', '金属ブラケット・車輪材質未確認'), status: 'source_reference_only', grade: null },
    sourceMeshSha256: 'bc31d9162a8794413d3e41385dd6c4aa45a4d5ae8e1e3cbe7d41e2b837c900b0', geometrySignature: 'fnv1a32:6354c753',
    bom: { unit: 'piece', specification: '带刹车脚轮 原模型外廓69.652×82.586×16.343 mm', quantityPerItem: 1 },
    pendingEvidence: ['采购型号、轮径、螺纹和安装座尺寸待核', '轮面材质、单轮承重和制动性能待核', '源模型包络与商品照片标称规格分别保留'],
  },
];

export const getStoolAccessory = (id: string): StoolAccessoryCatalogEntry | undefined => STOOL_ACCESSORY_CATALOG.find(entry => entry.id === id);
export const getStoolAccessoryBySemanticType = (semanticType: string | undefined) => STOOL_ACCESSORY_CATALOG.find(entry => entry.semanticType === semanticType);
