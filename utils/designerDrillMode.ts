/**
 * Drill mode turns a profile surface into an input device: a click on the
 * surface picks the face, the groove and the distance from both ends, and the
 * customer then confirms the hole.
 *
 * The translate gizmo (parked at the profile centre) and the two profile-length
 * handles (parked at both ends) are drawn exactly on that surface, so they
 * cover the spots the customer needs to aim at. They must therefore be hidden
 * while holes are being placed.
 *
 * Hiding alone is not enough: three.js does not skip invisible objects when
 * raycasting, so the gizmo's picker meshes would still swallow the pointer-down
 * and start a profile move instead of letting the drill click through. Both the
 * visibility and the pointer handling are therefore driven by this one rule.
 */
export const isMoveGizmoSuppressed = (drillMode: boolean): boolean => drillMode;
