import type { ScrewHeadType, ThreadSize } from '../types';
import { findDesignerFastenerByRule } from '../data/designerFastenerCatalog';

/** Purchasing identity only. No commercial values belong in this module. */
export interface DiyScrewOrderSpec {
  threadSize: ThreadSize;
  lengthMm: number;
  includesElasticFastener?: boolean;
  catalogItemId: string | null;
  mappingStatus: 'exact_catalog' | 'fallback_unverified';
  toolFamily?: 'hex_key';
  toolDriveSizeMm?: number;
}

/** Exact, design-rule-confirmed catalog match. Unlike the public fallback helper,
 * this never guesses a thread from the first two digits of an unknown profile. */
export const findDiyScrewOrderSpec = (
  profileSize: string | undefined,
  screwHead: ScrewHeadType | undefined,
): DiyScrewOrderSpec | null => {
  if (!profileSize || !screwHead) return null;
  const entry = findDesignerFastenerByRule(String(profileSize), screwHead);
  if (!entry) return null;
  return {
    threadSize: entry.threadSize,
    lengthMm: entry.lengthMm,
    includesElasticFastener: entry.includesElasticFastener || undefined,
    catalogItemId: entry.id,
    mappingStatus: 'exact_catalog',
    toolFamily: entry.tool.family,
    toolDriveSizeMm: entry.tool.driveSizeMm,
  };
};

export const getDiyScrewOrderSpec = (
  profileSize: string | undefined,
  screwHead: ScrewHeadType | undefined,
  fallbackLengthMm: number,
): DiyScrewOrderSpec => {
  const normalizedSize = String(profileSize || '2020');
  const configured = findDiyScrewOrderSpec(normalizedSize, screwHead);
  if (configured) return configured;
  const moduleSize = Number(normalizedSize.slice(0, 2));
  const threadSize: ThreadSize = moduleSize <= 15 ? 'M4' : moduleSize <= 20 ? 'M6' : 'M8';
  return {
    threadSize,
    lengthMm: Math.max(1, Math.round(fallbackLengthMm || 1)),
    catalogItemId: null,
    mappingStatus: 'fallback_unverified',
  };
};
