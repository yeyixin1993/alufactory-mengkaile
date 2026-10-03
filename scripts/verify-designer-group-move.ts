import {
  applyGroupMoveDelta,
  getGroupMoveTargets,
  isGroupMovableItem,
  isMovableAccessoryKind,
} from '../utils/designerGroupMove';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

type TestItem = {
  id: string;
  kind: string;
  lockedPosition?: boolean;
  position: [number, number, number];
};

const item = (id: string, kind: string, position: [number, number, number], lockedPosition?: boolean): TestItem => ({
  id,
  kind,
  position,
  ...(lockedPosition === undefined ? {} : { lockedPosition }),
});

// 1. Kinds that may be dragged away from an installed joint on their own.
assert(isMovableAccessoryKind('screw'), 'screws must stay individually movable');
assert(isMovableAccessoryKind('connector'), 'connectors must stay individually movable');
assert(isMovableAccessoryKind('end_cap'), 'end caps must stay individually movable');
assert(!isMovableAccessoryKind('profile'), 'profiles are not movable accessories');
assert(!isMovableAccessoryKind('plate'), 'plates are not movable accessories');
assert(!isMovableAccessoryKind('pegboard'), 'pegboards are not movable accessories');
assert(!isMovableAccessoryKind('marine_board'), 'marine boards are not movable accessories');
assert(!isMovableAccessoryKind('cabinet_door'), 'cabinet doors are not movable accessories');

// 2. Grouped-move membership: owned decorations follow their host, and a
// locked board/profile must not be dragged out of its assembly by a group.
assert(isGroupMovableItem(item('a', 'profile', [0, 0, 0])), 'a free profile must join a grouped move');
assert(!isGroupMovableItem(item('b', 'end_cap', [0, 0, 0])), 'end caps must never join a grouped move');
assert(!isGroupMovableItem(item('c', 'cabinet_door', [0, 0, 0])), 'cabinet doors must never join a grouped move');
assert(!isGroupMovableItem(item('d', 'profile', [0, 0, 0], true)), 'a locked profile must not join a grouped move');
assert(isGroupMovableItem(item('e', 'screw', [0, 0, 0], true)), 'a locked accessory may still be dragged on purpose');
assert(!isGroupMovableItem(item('f', 'marine_board', [0, 0, 0], true)), 'a locked board must not join a grouped move');

// 3. Selection order, de-duplication, and unknown ids.
const scene: TestItem[] = [
  item('p1', 'profile', [0, 0, 0]),
  item('p2', 'profile', [500, 0, 0]),
  item('cap1', 'end_cap', [0, 0, 0], true),
  item('door1', 'cabinet_door', [0, 0, 0]),
  item('screw1', 'screw', [0, 0, 0], true),
  item('p3', 'profile', [1000, 0, 0], true),
];
assert(
  getGroupMoveTargets(scene, ['p2', 'p1', 'p1']).map((entry) => entry.id).join(',') === 'p2,p1',
  'grouped move must keep selection order and drop repeated ids',
);
assert(
  getGroupMoveTargets(scene, ['p1', 'cap1', 'door1', 'screw1', 'p3']).map((entry) => entry.id).join(',') === 'p1,screw1',
  'grouped move must drop end caps, doors and locked non-accessories',
);
assert(getGroupMoveTargets(scene, ['missing']).length === 0, 'unknown ids must be ignored');
assert(getGroupMoveTargets(scene, []).length === 0, 'an empty selection has no grouped move');

// 4. One identical delta for every member keeps the arrangement intact.
const moved = applyGroupMoveDelta(scene, ['p1', 'p2'], [120, -40, 25]);
const byId = new Map(moved.map((entry) => [entry.id, entry]));
assert(
  JSON.stringify(byId.get('p1')?.position) === JSON.stringify([120, -40, 25]),
  'the first selected profile did not take the group delta',
);
assert(
  JSON.stringify(byId.get('p2')?.position) === JSON.stringify([620, -40, 25]),
  'the second selected profile did not take the group delta',
);
assert(
  JSON.stringify(byId.get('p3')?.position) === JSON.stringify([1000, 0, 0]),
  'an unselected profile must not move with the group',
);
const gapBefore = scene[1].position[0] - scene[0].position[0];
const gapAfter = (byId.get('p2')?.position[0] || 0) - (byId.get('p1')?.position[0] || 0);
assert(gapBefore === gapAfter, 'a grouped move must preserve the spacing inside the selection');
assert(
  applyGroupMoveDelta(scene, ['ghost'], [10, 10, 10]).every((entry, index) => entry === scene[index]),
  'unknown ids must leave the scene untouched',
);

console.log('Designer grouped move/copy regression checks passed.');
