/** Millimetre dimensions of the current designer screw model, not supplier evidence. */
export const getDesignerScrewModelDimensions = (item: { height?: number; width?: number; screwHead?: string }) => {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const lengthMm = clamp(item.height || 35, 6, 120);
  const shaftRadiusMm = clamp((item.width || 12) * 0.28, 2.5, 7);
  const headRadiusMm = shaftRadiusMm * 1.85;
  const headHeightMm = item.screwHead === 'flat_socket' ? Math.max(2.2, shaftRadiusMm * 0.62) : Math.max(4.5, shaftRadiusMm * 1.45);
  return { lengthMm, shaftRadiusMm, headRadiusMm, headHeightMm };
};

/** A screw entering a tapped profile end does not also clamp through the kit's loose T fastener. */
export const usesScrewKitElasticFastener = (item: { attachmentKey?: string; screwHead?: string }) => !(
  item.screwHead === 'button_socket' && item.attachmentKey?.endsWith(':DRILL-TAP')
);
