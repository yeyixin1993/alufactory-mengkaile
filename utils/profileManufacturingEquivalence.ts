import {
  DrillHole,
  MiterCutConfig,
  MiterCutEnd,
  ProfileSide,
  TappingConfig,
} from '../types';
import {
  getHolePhysicalGrooveIndex,
  getProfileGrooveCount,
  OPPOSITE_PROFILE_SIDE,
} from './profileMachining';

/**
 * Only profiles whose cross-section symmetry has been explicitly confirmed may
 * be grouped after rolling them around their length axis. Keep this list narrow:
 * an omitted model merely creates an extra BOM row, while a false positive can
 * merge different factory machining instructions.
 */
const CONFIRMED_QUARTER_TURN_SYMMETRIC_PROFILES = new Set([
  '1515',
  '2020',
  '3030',
  '4040',
]);

const PROFILE_SIDE_CYCLE: ProfileSide[] = ['A', 'B', 'C', 'D'];

const rotateProfileSide = (side: ProfileSide, quarterTurns: number): ProfileSide => {
  const index = PROFILE_SIDE_CYCLE.indexOf(side);
  return PROFILE_SIDE_CYCLE[(index + quarterTurns) % PROFILE_SIDE_CYCLE.length];
};

const normalizeMiterEnd = (end?: MiterCutEnd) => (
  end?.enabled
    ? { enabled: true, direction: end.direction || 'up', side: end.side || 'AC' }
    : { enabled: false }
);

const hasEnabledMiter = (miterCut?: MiterCutConfig) => (
  Boolean(miterCut?.left?.enabled || miterCut?.right?.enabled)
);

const canSafelyRotateHoleSet = (variantId: string, holes: DrillHole[]) => holes.every((hole) => {
  // Multi-slot faces need a separately verified slot-permutation table. Until
  // that exists, never infer equivalence for them.
  const exitSide = OPPOSITE_PROFILE_SIDE[hole.side];
  return getProfileGrooveCount(variantId, hole.side) === 1
    && getProfileGrooveCount(variantId, exitSide) === 1
    && getHolePhysicalGrooveIndex(hole, variantId) === 0;
});

const canSafelyRotateTapping = (tapping?: TappingConfig) => (
  (!tapping?.left || tapping.left.length <= 1)
  && (!tapping?.right || tapping.right.length <= 1)
);

const normalizeHoles = (
  variantId: string,
  holes: DrillHole[],
  quarterTurns: number,
) => holes
  .map((hole) => ({
    side: rotateProfileSide(hole.side, quarterTurns),
    positionMm: Number(hole.positionMm || 0),
    type: hole.type,
    threadSize: hole.threadSize || '',
    physicalGrooveIndex: getHolePhysicalGrooveIndex(hole, variantId),
    fastenerHead: hole.fastenerHead || '',
    fastenerLengthMm: Number(hole.fastenerLengthMm || 0),
  }))
  .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

export interface ProfileManufacturingOrientationInput {
  variantId?: string;
  holes?: DrillHole[];
  tapping?: TappingConfig;
  tappingLeft?: boolean;
  tappingRight?: boolean;
  miterCut?: MiterCutConfig;
}

/**
 * Returns a canonical machining signature modulo confirmed longitudinal
 * self-rotation. If symmetry or any feature mapping is uncertain, only the
 * unrotated signature participates and the rows remain separate.
 */
export const getRotationallyCanonicalMachiningKey = ({
  variantId = '',
  holes = [],
  tapping,
  tappingLeft = false,
  tappingRight = false,
  miterCut,
}: ProfileManufacturingOrientationInput): string => {
  const mayQuarterTurn = CONFIRMED_QUARTER_TURN_SYMMETRIC_PROFILES.has(variantId)
    && !hasEnabledMiter(miterCut)
    && canSafelyRotateHoleSet(variantId, holes)
    && canSafelyRotateTapping(tapping);
  const candidateTurns = mayQuarterTurn ? [0, 1, 2, 3] : [0];

  const candidates = candidateTurns.map((quarterTurns) => JSON.stringify({
    holes: normalizeHoles(variantId, holes, quarterTurns),
    tapping: {
      left: Array.isArray(tapping?.left) ? tapping.left.map(Boolean) : [],
      right: Array.isArray(tapping?.right) ? tapping.right.map(Boolean) : [],
    },
    tappingLeft: Boolean(tappingLeft),
    tappingRight: Boolean(tappingRight),
    miterCut: {
      left: normalizeMiterEnd(miterCut?.left),
      right: normalizeMiterEnd(miterCut?.right),
    },
  }));

  return candidates.sort((left, right) => left.localeCompare(right))[0];
};
