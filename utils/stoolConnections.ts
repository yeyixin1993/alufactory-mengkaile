import type { ParametricSceneItem } from './parametricFurniture';

/** These six rails replace the 30 mm corner blocks with full bearing faces. */
export const STOOL_CONTINUOUS_WIDTH_RAIL_IDS = [
  'parametric-stool-stool-fixed-top-front',
  'parametric-stool-stool-fixed-top-rear',
  'parametric-stool-stool-seat-front',
  'parametric-stool-stool-seat-rear',
  'parametric-stool-stool-middle-front-instances-5-groups-1',
  'parametric-stool-stool-middle-front-instances-6-groups-1',
] as const;

const CONTINUOUS_RAIL_IDS = new Set<string>(STOOL_CONTINUOUS_WIDTH_RAIL_IDS);
const SUPERSEDED_SOURCE_CONNECTIONS = new Set(['three_way', 'angle_bracket']);

/**
 * Rebuild only the raw source template's native frame. Call once, before any
 * connection solver: old SU machining and corner blocks describe a different
 * topology and must not survive alongside new connectors. The shaft/support
 * mechanism, casters, handle and decoration remain source geometry requiring
 * engineering review. This function does not assert connection completeness.
 */
export const prepareStoolConnectionStructure = (
  source: readonly ParametricSceneItem[],
): ParametricSceneItem[] => source
  .filter((item) => !SUPERSEDED_SOURCE_CONNECTIONS.has(item.sourceMesh?.source.semanticType || ''))
  .map((item) => {
    if (item.kind !== 'profile') return { ...item };
    return {
      ...item,
      length: (item.length || 0) + (CONTINUOUS_RAIL_IDS.has(item.id) ? 60 : 0),
      holes: [],
      tappingLeft: false,
      tappingRight: false,
      remark: `${item.remark || ''}｜新方案按隐形角码优先、其次钻攻重建加工，原孔攻丝已被替代。`,
    };
  });
