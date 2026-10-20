import type { DrillHole, ScrewHeadType } from '../types';
import { getDiyScrewOrderSpec } from './screwCalculator';

export interface ScrewEstimateInput {
  profileSize: string;
  screwHead: string;
  screwLengthMm: number | null;
  quantity: number;
}
export const screwEstimateKey = (row: ScrewEstimateInput) => {
  const spec = getDiyScrewOrderSpec(row.profileSize, row.screwHead as ScrewHeadType, row.screwLengthMm || 1);
  return `${row.profileSize}:${row.screwHead}:${spec.threadSize}:${spec.lengthMm}`;
};
export const profileScrewRequirements = (profiles: { variantId?: string; quantity: number; holes?: DrillHole[] }[]) => {
  const result = new Map<string, ScrewEstimateInput>();
  for (const profile of profiles) {
    const size = Number((profile.variantId || '2020').slice(0, 2));
    const profileSize = size <= 15 ? '1515' : size <= 20 ? '2020' : size <= 30 ? '3030' : '4040';
    for (const hole of profile.holes || []) {
      if (hole.suppressAutoFastener) continue;
      const screwHead = hole.fastenerHead || (hole.type === 'countersunk' ? 'socket_cylinder' : hole.type === 'through' ? 'button_socket' : null);
      if (!screwHead) continue;
      const spec = getDiyScrewOrderSpec(profileSize, screwHead, hole.fastenerLengthMm || 35);
      const row = { profileSize, screwHead, screwLengthMm: spec.lengthMm, quantity: Math.max(0, profile.quantity || 0) };
      const key = screwEstimateKey(row);
      const old = result.get(key);
      result.set(key, { ...row, quantity: (old?.quantity || 0) + row.quantity });
    }
  }
  return [...result.values()].filter(row => row.quantity > 0);
};

/** Hole-driven packing estimate. Existing rows supply display metadata, never the count. */
export const reconcileScrewEstimates = <T extends ScrewEstimateInput>(confirmed: T[], required: ScrewEstimateInput[]) => {
  const rows: T[] = [];
  const missing: ScrewEstimateInput[] = [];
  for (const need of required) {
    const key = screwEstimateKey(need);
    const matches = confirmed.filter(row => screwEstimateKey(row) === key);
    let remaining = need.quantity + 2;
    if (!matches.length) {
      missing.push({ ...need, quantity: remaining });
      continue;
    }
    // Preserve existing color distribution where possible, cap excess quantities,
    // and put any shortfall on the last row. Spares are added once per spec.
    matches.forEach((row, index) => {
      const quantity = index === matches.length - 1 ? remaining : Math.min(remaining, Math.max(0, row.quantity));
      if (quantity > 0) rows.push({ ...row, quantity });
      remaining -= quantity;
    });
  }
  return { rows, missing };
};
