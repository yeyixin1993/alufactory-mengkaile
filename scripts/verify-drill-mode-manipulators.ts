import { isMoveGizmoSuppressed } from '../utils/designerDrillMode';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

// 1. Outside drill mode the coloured translate gizmo and the two length handles
// must stay available: moving and resizing are the normal editing gestures.
assert(!isMoveGizmoSuppressed(false), 'move manipulators must stay available outside drill mode');

// 2. Inside drill mode the customer aims at a profile surface to pick the face,
// the groove and the distance. The gizmo sits on that surface, so it has to go.
assert(isMoveGizmoSuppressed(true), 'move manipulators must be suppressed while placing holes');

// 3. The rule must be total (never undefined), because it gates both the gizmo
// visibility and the pointer-down pick in the 3D viewport.
assert(isMoveGizmoSuppressed(true) === true, 'suppression must be a strict boolean');

console.log('drill-mode manipulator suppression: ok');
