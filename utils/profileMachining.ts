import { PROFILE_VARIANTS } from '../constants';
import { DrillHole, Language, ProfileSide } from '../types';

export const OPPOSITE_PROFILE_SIDE: Record<ProfileSide, ProfileSide> = {
  A: 'C',
  B: 'D',
  C: 'A',
  D: 'B',
};

export const getProfileGrooveCount = (variantId = '2020', side: ProfileSide): number => {
  if (variantId === '2020-N4-SQ' || variantId === '2020-N4-RD') return 0;
  if (variantId === '2020-N2-OPP') return side === 'B' || side === 'D' ? 1 : 0;
  if (variantId === '1515-N1' && side === 'A') return 0;
  if (variantId === '1515-N2' && (side === 'A' || side === 'B')) return 0;
  if (variantId === '2047') {
    if (side === 'A') return 0;
    if (side === 'B' || side === 'D') return 2;
  }
  if (variantId === '2040-N1-20' && side === 'A') return 0;
  if ((variantId === '2040-N1-40' || variantId === '3060-N1-60') && side === 'A') return 1;
  if ((variantId === '2040-N1-40' || variantId === '3060-N1-60') && side === 'D') return 2;
  if (variantId === '2060' && (side === 'B' || side === 'D')) return 3;
  if (variantId === '20100' && (side === 'B' || side === 'D')) return 5;
  if (['2040', '3060', '2040-N1-20', '2040-N1-40', '3060-N1-60', '4080'].includes(variantId)
    && (side === 'B' || side === 'D')) return 2;

  const variantName = (PROFILE_VARIANTS.find((variant) => variant.id === variantId)?.name || '').toLowerCase();
  if (variantName.includes('n1') && side === 'A') return 0;
  if (variantName.includes('n2') && (side === 'A' || side === 'B')) return 0;
  if (variantName.includes('n3') && side !== 'D') return 0;
  return 1;
};

const clampGroove = (index: number, grooveCount: number) => (
  Math.max(0, Math.min(Math.max(1, grooveCount) - 1, Math.round(index)))
);

export const displayGrooveToPhysical = (
  side: ProfileSide,
  displayIndex: number,
  grooveCount: number,
) => {
  const index = clampGroove(displayIndex, grooveCount);
  return side === 'C' || side === 'D' ? Math.max(0, grooveCount - index - 1) : index;
};

export const physicalGrooveToDisplay = (
  side: ProfileSide,
  physicalIndex: number,
  grooveCount: number,
) => {
  const index = clampGroove(physicalIndex, grooveCount);
  return side === 'C' || side === 'D' ? Math.max(0, grooveCount - index - 1) : index;
};

export const getHolePhysicalGrooveIndex = (hole: DrillHole, variantId = '2020') => {
  const count = Math.max(1, getProfileGrooveCount(variantId, hole.side));
  if (Number.isFinite(hole.physicalGrooveIndex)) {
    return clampGroove(hole.physicalGrooveIndex as number, count);
  }
  return displayGrooveToPhysical(hole.side, hole.grooveIndex || 0, count);
};

export const getHoleDisplayGrooveIndex = (
  hole: DrillHole,
  viewedSide: ProfileSide,
  variantId = '2020',
) => {
  const count = Math.max(1, getProfileGrooveCount(variantId, viewedSide));
  return physicalGrooveToDisplay(viewedSide, getHolePhysicalGrooveIndex(hole, variantId), count);
};

export const grooveOrdinal = (index: number, language: Language) => {
  if (language === 'cn') return ['第一槽', '第二槽', '第三槽', '第四槽', '第五槽'][index] || `第${index + 1}槽`;
  if (language === 'jp') return ['第一溝', '第二溝', '第三溝', '第四溝', '第五溝'][index] || `第${index + 1}溝`;
  return `Groove ${index + 1}`;
};

export const describeHolePassage = (hole: DrillHole, variantId: string, language: Language) => {
  const exitSide = OPPOSITE_PROFILE_SIDE[hole.side];
  const entryCount = getProfileGrooveCount(variantId, hole.side);
  const exitCount = getProfileGrooveCount(variantId, exitSide);
  const entryGroove = entryCount >= 2
    ? ` ${grooveOrdinal(getHoleDisplayGrooveIndex(hole, hole.side, variantId), language)}`
    : '';
  const exitGroove = exitCount >= 2
    ? ` ${grooveOrdinal(getHoleDisplayGrooveIndex(hole, exitSide, variantId), language)}`
    : '';
  if (language === 'cn') return `${hole.side}面${entryGroove} → ${exitSide}面${exitGroove}`;
  if (language === 'jp') return `${hole.side}面${entryGroove} → ${exitSide}面${exitGroove}`;
  return `${hole.side}${entryGroove} → ${exitSide}${exitGroove}`;
};
