// Selection rules for the designer's grouped move/copy gestures. A shift- or
// marquee-selection is dragged as one rigid body: every member takes the same
// world delta, so the arrangement inside the selection is preserved and the
// whole gesture stays a single undoable commit.

type Vec3 = [number, number, number];

interface GroupMoveCandidate {
  id: string;
  kind: string;
  lockedPosition?: boolean;
}

export const isMovableAccessoryKind = (kind: string) => (
  kind !== 'profile'
  && kind !== 'plate'
  && kind !== 'pegboard'
  && kind !== 'marine_board'
  && kind !== 'cabinet_door'
);

// End caps and cabinet doors are owned by a host profile/opening and follow it
// automatically; dragging them inside a group would fight that ownership.
const GROUP_MOVE_EXCLUDED_KINDS = new Set<string>(['end_cap', 'cabinet_door']);

export const isGroupMovableItem = (item: GroupMoveCandidate) => (
  !GROUP_MOVE_EXCLUDED_KINDS.has(item.kind)
  && (!item.lockedPosition || isMovableAccessoryKind(item.kind))
);

export const getGroupMoveTargets = <T extends GroupMoveCandidate>(items: T[], selectedIds: string[]): T[] => {
  const taken = new Set<string>();
  return selectedIds.flatMap((id) => {
    if (taken.has(id)) return [];
    const item = items.find((entry) => entry.id === id);
    if (!item || !isGroupMovableItem(item)) return [];
    taken.add(id);
    return [item];
  });
};

// Applies one identical delta to every listed item. Unselected items and
// unknown ids are returned untouched.
export const applyGroupMoveDelta = <T extends { id: string; position: Vec3 }>(
  items: T[],
  ids: string[],
  delta: Vec3,
): T[] => {
  const moving = new Set(ids);
  return items.map((item) => (
    moving.has(item.id)
      ? {
        ...item,
        position: [
          item.position[0] + delta[0],
          item.position[1] + delta[1],
          item.position[2] + delta[2],
        ] as Vec3,
      } as T
      : item
  ));
};
