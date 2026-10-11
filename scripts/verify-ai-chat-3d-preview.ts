import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import type { ProfileConfig } from '../types';

// AIProfile3D renders the chat's read-only 3D preview through a *dynamic*
// import and destructures this exact symbol. When the designer lost the export,
// the destructured value became undefined, calling it threw, and the
// component's .catch() swallowed the failure -- production showed an empty
// preview with a clean console and a green build. Guard the contract here so a
// missing/drifting export fails loudly instead of blanking the preview.
const designer = await import('../components/DIYDesigner');
const { createChatProfilePreview } = designer;
assert.equal(
  typeof createChatProfilePreview,
  'function',
  'components/DIYDesigner must export createChatProfilePreview for the AI chat 3D preview',
);

const config: ProfileConfig = {
  length: 396,
  tapping: { left: [true, false], right: [false, true] },
  holes: [
    { id: 'h1', side: 'A', positionMm: 17, type: 'threaded' },
    { id: 'h2', side: 'C', positionMm: 379, type: 'countersunk' },
  ],
  variantId: '2040',
  colorId: 'natural',
  finish: 'natural',
};

const countMeshes = (object: import('three').Object3D) => {
  let meshes = 0;
  object.traverse((child) => { if ((child as { isMesh?: boolean }).isMesh) meshes += 1; });
  return meshes;
};

// Opaque preview: real geometry, sized from the configured length (SCENE_SCALE = 100).
const opaque = createChatProfilePreview(config);
assert.equal(opaque.type, 'Group');
assert(countMeshes(opaque) > 0, 'opaque preview must contain rendered geometry');
const opaqueBox = new Box3().setFromObject(opaque);
const opaqueSize = opaqueBox.getSize(new Vector3());
assert(
  Math.abs(opaqueSize.x - config.length / 100) < 0.05,
  `preview length must follow the configured length, got ${opaqueSize.x} for ${config.length}mm`,
);
assert(opaqueSize.y > 0.15 && opaqueSize.z > 0.15, '2040 preview must keep its 20x40mm section');
assert(
  new Box3().setFromObject(opaque).isEmpty() === false,
  'preview bounding box must not be empty',
);

// The chat's `透视` toggle reruns the same builder with transparentProfile = true.
const transparent = createChatProfilePreview(config, true);
assert(countMeshes(transparent) > 0, 'transparent preview must contain rendered geometry');
const opaqueBody = opaque.children.find((child) => (child as { isMesh?: boolean }).isMesh) as { material: { transparent: boolean } };
const transparentBody = transparent.children.find((child) => (child as { isMesh?: boolean }).isMesh) as { material: { transparent: boolean } };
assert.equal(opaqueBody.material.transparent, false, 'opaque preview body must stay opaque');
assert.equal(transparentBody.material.transparent, true, '透视 preview body must become transparent');

// Hole/tapping markers are driven by config; they must not vanish silently.
assert(countMeshes(opaque) > countMeshes(createChatProfilePreview({ ...config, holes: [] })), 'hole markers must follow config.holes');

console.log(
  'AI chat 3D preview contract passed:',
  `meshes=${countMeshes(opaque)}`,
  `length=${opaqueSize.x.toFixed(3)}`,
  `section=${opaqueSize.y.toFixed(3)}x${opaqueSize.z.toFixed(3)}`,
);
