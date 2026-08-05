export interface ProfileInnerClearance {
  left: number;
  right: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const calculateProfileInnerClearance = (
  targetHalfLength: number,
  movingCenterAlongTarget: number,
  movingHalfExtentAlongTarget: number,
  reservePerpendicularEndModule: boolean,
): ProfileInnerClearance => {
  const targetNearEdge = -targetHalfLength;
  const targetFarEdge = targetHalfLength;
  let movingNearEdge = movingCenterAlongTarget - movingHalfExtentAlongTarget;
  let movingFarEdge = movingCenterAlongTarget + movingHalfExtentAlongTarget;

  // An outside flush perpendicular joint still consumes one profile module
  // from the usable interior. Fold that module inward so panel, shelf and
  // drawer dimensions use real available space rather than raw mesh extent.
  if (reservePerpendicularEndModule) {
    const projectedModule = movingHalfExtentAlongTarget * 2;
    const contactTolerance = 0.002;
    if (movingFarEdge <= targetNearEdge + contactTolerance) {
      movingNearEdge = targetNearEdge;
      movingFarEdge = Math.min(targetFarEdge, targetNearEdge + projectedModule);
    } else if (movingNearEdge >= targetFarEdge - contactTolerance) {
      movingFarEdge = targetFarEdge;
      movingNearEdge = Math.max(targetNearEdge, targetFarEdge - projectedModule);
    }
  }

  const targetLength = targetHalfLength * 2;
  return {
    left: clamp(movingNearEdge + targetHalfLength, 0, targetLength),
    right: clamp(targetHalfLength - movingFarEdge, 0, targetLength),
  };
};
