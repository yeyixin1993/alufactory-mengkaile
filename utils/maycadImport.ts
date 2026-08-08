import * as THREE from 'three';
import type { DrillHole, HoleType, ProfileSide } from '../types';
import { resolveMaycadProfileVariant } from './maycadProfileMapping';

export interface MaycadImportedItem {
  id: string;
  kind: 'profile' | 'plate' | 'pegboard' | 'marine_board' | 'connector' | 'extruded_connector' | 'l_connector' | 't_connector' | 'hidden_connector' | 'tee_connector' | 'screw' | 'foot';
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  colorId: string;
  quantity: number;
  variantId?: string;
  length?: number;
  width?: number;
  height?: number;
  thickness?: number;
  holes?: DrillHole[];
  tappingLeft?: boolean;
  tappingRight?: boolean;
  remark?: string;
}

export interface MaycadImportResult {
  items: MaycadImportedItem[];
  warnings: string[];
  profileReviews: MaycadProfileReview[];
  sourceTitle?: string;
  confidence?: number;
}

export interface MaycadProfileReview {
  itemIds: string[];
  sourceCode: string;
  suggestedVariantId: string;
  crossSectionMm?: [number, number];
  reason: 'unverified' | 'ai-inferred';
}

export interface MaycadPdfAiPayload {
  filename: string;
  extractedText: string;
  viewImages: string[];
}

const makeImportId = (prefix: string, sourceId: string | number) => (
  `maycad_${prefix}_${String(sourceId).replace(/[^a-zA-Z0-9_-]/g, '_')}_${Math.random().toString(36).slice(2, 7)}`
);

const matrixValues = (value: string | null) => {
  const values = String(value || '').split(',').map(Number);
  if (values.length !== 16 || values.some((entry) => !Number.isFinite(entry))) {
    throw new Error('Invalid MayCAD transform matrix');
  }
  return values;
};

const translationFromMatrix = (matrix: number[]) => new THREE.Vector3(matrix[3], matrix[7], matrix[11]);

const rotationFromMatrix = (matrix: number[]) => new THREE.Matrix4().set(
  matrix[0], matrix[1], matrix[2], 0,
  matrix[4], matrix[5], matrix[6], 0,
  matrix[8], matrix[9], matrix[10], 0,
  0, 0, 0, 1,
);

const quarterTurn = (radians: number) => {
  let degrees = Math.round(THREE.MathUtils.radToDeg(radians) / 90) * 90;
  degrees %= 360;
  if (degrees <= -180) degrees += 360;
  if (degrees > 180) degrees -= 360;
  return Object.is(degrees, -0) ? 0 : degrees;
};

// MayCAD extrudes profiles along local +Y. Mengkaile profiles use local +X;
// their local Y/Z cross-section axes correspond to MayCAD +Z/-X.
const MAYCAD_TO_MENGKAILE_LOCAL = new THREE.Matrix4().set(
  0, 0, -1, 0,
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 0, 1,
);

const holeTypeFromMaycad = (profileCode: string): HoleType | null => {
  if (/Q11(?:\D|$)/i.test(profileCode)) return 'countersunk';
  if (/Q10(?:\D|$)/i.test(profileCode)) return 'through';
  // MayCAD Q2 is a blind bore, which has no manufacturing-equivalent hole
  // type in the current designer. It is intentionally left for review.
  return null;
};

const faceFromRelativeOffset = (offset: THREE.Vector3): ProfileSide => {
  if (Math.abs(offset.x) > Math.abs(offset.z)) return offset.x >= 0 ? 'B' : 'D';
  return offset.z >= 0 ? 'A' : 'C';
};

const directChildren = (parent: Element, tagName: string) => Array.from(parent.children)
  .filter((child) => child.tagName === tagName);

export const parseMaycadSceneXml = (xmlText: string): MaycadImportResult => {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error('MayCAD scene XML is invalid');
  const scene = document.querySelector('scene');
  const objectsNode = scene?.querySelector('objects');
  if (!scene || !objectsNode) throw new Error('This file is not a supported MayCAD scene');

  const warnings: string[] = [];
  const profileReviewMap = new Map<string, MaycadProfileReview>();
  const objects = directChildren(objectsNode, 'object');
  const profileRecords = new Map<string, {
    item: MaycadImportedItem;
    maycadRotation: THREE.Matrix4;
    maycadStart: THREE.Vector3;
    longDirection: THREE.Vector3;
  }>();

  objects.forEach((object) => {
    if (object.querySelector(':scope > type')?.textContent !== 'Profile') return;
    const sourceId = String(object.querySelector(':scope > id')?.textContent || profileRecords.size + 1);
    const profileCode = object.querySelector(':scope > profile')?.textContent || '';
    const widthCm = Number(object.querySelector(':scope > width')?.textContent || 2);
    const depthCm = Number(object.querySelector(':scope > length')?.textContent || 2);
    const lengthMm = Math.max(20, Math.round(Number(object.querySelector(':scope > height')?.textContent || 20) * 10));
    const maycadMatrix = matrixValues(object.querySelector(':scope > rotation')?.textContent || '');
    const maycadRotation = rotationFromMatrix(maycadMatrix);
    const maycadStart = translationFromMatrix(maycadMatrix);
    const longDirection = new THREE.Vector3(0, 1, 0).applyMatrix4(maycadRotation).normalize();
    const center = maycadStart.clone().addScaledVector(longDirection, lengthMm / 20);
    const designerRotation = maycadRotation.clone().multiply(MAYCAD_TO_MENGKAILE_LOCAL);
    const euler = new THREE.Euler().setFromRotationMatrix(designerRotation, 'XYZ');
    const mapped = resolveMaycadProfileVariant(profileCode, widthCm, depthCm);
    if (!mapped.exact) warnings.push(`MayCAD ${profileCode || sourceId} 暂按 ${mapped.variantId} 导入，请核对型材型号。`);

    const item: MaycadImportedItem = {
      id: makeImportId('profile', sourceId),
      kind: 'profile',
      name: mapped.variantId,
      variantId: mapped.variantId,
      length: lengthMm,
      position: [Math.round(center.x * 10), Math.round(center.y * 10), Math.round(center.z * 10)],
      rotation: [quarterTurn(euler.x), quarterTurn(euler.y), quarterTurn(euler.z)],
      colorId: 'natural',
      quantity: 1,
      holes: [],
      tappingLeft: false,
      tappingRight: false,
      remark: `MayCAD ${profileCode || 'Profile'} · source #${sourceId}`,
    };
    if (!mapped.exact) {
      const crossSectionMm: [number, number] = [Math.round(widthCm * 10), Math.round(depthCm * 10)];
      const reviewKey = `${profileCode || 'unknown'}|${crossSectionMm.join('x')}`;
      const existingReview = profileReviewMap.get(reviewKey);
      if (existingReview) {
        existingReview.itemIds.push(item.id);
      } else {
        profileReviewMap.set(reviewKey, {
          itemIds: [item.id],
          sourceCode: profileCode || `source #${sourceId}`,
          suggestedVariantId: mapped.variantId,
          crossSectionMm,
          reason: 'unverified',
        });
      }
    }
    profileRecords.set(sourceId, { item, maycadRotation, maycadStart, longDirection });
  });

  objects.forEach((object) => {
    if (object.querySelector(':scope > type')?.textContent !== 'SimpleBore') return;
    const parentId = object.querySelector(':scope > parent')?.textContent || '';
    const parent = profileRecords.get(parentId);
    if (!parent) return;
    const machiningCode = object.querySelector(':scope > profile')?.textContent || '';
    const type = holeTypeFromMaycad(machiningCode);
    if (!type) {
      warnings.push(`MayCAD ${machiningCode || 'blind bore'} 为盲孔，未自动转换，请在设计器中人工确认。`);
      return;
    }
    const sourceId = object.querySelector(':scope > id')?.textContent || 'hole';
    const holeMatrix = matrixValues(object.querySelector(':scope > rotation')?.textContent || '');
    const delta = translationFromMatrix(holeMatrix).sub(parent.maycadStart);
    const positionMm = Math.round(delta.dot(parent.longDirection) * 10);
    const lengthMm = parent.item.length || 20;
    const crossOffset = delta.clone().applyMatrix4(parent.maycadRotation.clone().invert());
    const side = faceFromRelativeOffset(crossOffset);
    const hole: DrillHole = {
      id: makeImportId('hole', sourceId),
      side,
      type,
      positionMm: Math.min(lengthMm - 5, Math.max(5, positionMm)),
      physicalGrooveIndex: 0,
    };
    parent.item.holes?.push(hole);
  });

  const items = Array.from(profileRecords.values()).map((record) => record.item);
  if (!items.length) throw new Error('No MayCAD aluminum profiles were found');
  const title = scene.querySelector('title')?.textContent || undefined;
  return {
    items,
    warnings: Array.from(new Set(warnings)),
    profileReviews: Array.from(profileReviewMap.values()),
    sourceTitle: title,
    confidence: warnings.length ? 0.82 : 0.96,
  };
};

export const normalizeMaycadAiResult = (source: any): MaycadImportResult => {
  const warnings = Array.isArray(source?.warnings) ? source.warnings.map(String) : [];
  const rawItems = Array.isArray(source?.items) ? source.items : [];
  const profileReviews: MaycadProfileReview[] = [];
  const validVariants = new Set([
    '1515', '2020', '2020-N1', '2020-N2', '2020-N2-OPP', '2020-N3',
    '2020-N4-SQ', '2020-N4-RD', '2020R', '2040', '2040-N1-20', '2040-N1-40',
    '2047', '2060', '20100', '3030', '3030-N1', '3030-N2', '3030-N3', '3030R',
    '3060', '3090', '4040', '4040-N1', '4040-N2', '4040-N3', '4080', '40120',
  ]);
  const items = rawItems.flatMap((raw: any, index: number): MaycadImportedItem[] => {
    if (!raw || raw.kind !== 'profile') return [];
    const length = Math.max(20, Math.round(Number(raw.length || raw.lengthMm || 0)));
    const position = Array.isArray(raw.position) ? raw.position : raw.positionMm;
    const rotation = Array.isArray(raw.rotation) ? raw.rotation : raw.rotationDeg;
    if (!length || !Array.isArray(position) || position.length !== 3 || !Array.isArray(rotation) || rotation.length !== 3) return [];
    const requestedVariant = String(raw.variantId || raw.model || '2020');
    const variantId = validVariants.has(requestedVariant) ? requestedVariant : '2020';
    if (variantId !== requestedVariant) warnings.push(`AI返回了未知型材 ${requestedVariant}，暂按2020导入。`);
    const holes: DrillHole[] = (Array.isArray(raw.holes) ? raw.holes : []).flatMap((hole: any, holeIndex: number) => {
      const side = String(hole?.side || '').toUpperCase();
      const type = String(hole?.type || '');
      const positionMm = Math.round(Number(hole?.positionMm));
      if (!['A', 'B', 'C', 'D'].includes(side) || !['through', 'countersunk', 'threaded'].includes(type) || !Number.isFinite(positionMm)) return [];
      return [{
        id: makeImportId(`ai-hole-${index}`, holeIndex + 1),
        side: side as ProfileSide,
        type: type as HoleType,
        positionMm: Math.min(length - 5, Math.max(5, positionMm)),
        physicalGrooveIndex: Math.max(0, Math.round(Number(hole?.physicalGrooveIndex || 0))),
      }];
    });
    const itemId = makeImportId('ai', index + 1);
    profileReviews.push({
      itemIds: [itemId],
      sourceCode: String(raw.maycadCode || raw.profileCode || `PDF profile #${index + 1}`),
      suggestedVariantId: variantId,
      reason: 'ai-inferred',
    });
    return [{
      id: itemId,
      kind: 'profile',
      name: variantId,
      variantId,
      length,
      position: position.map((value: any) => Math.round(Number(value) || 0)) as [number, number, number],
      rotation: rotation.map((value: any) => Math.round((Number(value) || 0) / 90) * 90) as [number, number, number],
      colorId: String(raw.colorId || 'natural'),
      quantity: 1,
      holes,
      tappingLeft: Boolean(raw.tappingLeft),
      tappingRight: Boolean(raw.tappingRight),
      remark: String(raw.remark || 'MayCAD PDF AI reconstruction - review required'),
    }];
  });
  if (!items.length) throw new Error('AI did not return an editable MayCAD assembly');
  return {
    items,
    warnings,
    profileReviews,
    sourceTitle: source?.sourceTitle,
    confidence: Number(source?.confidence || 0.7),
  };
};
