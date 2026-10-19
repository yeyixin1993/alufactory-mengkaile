import assert from 'node:assert/strict';
import { Mesh, Raycaster, Vector3 } from 'three';
import { PROFILE_VARIANTS } from '../constants';
import { createChatProfilePreview } from '../components/DIYDesigner';
import { getProfileGrooveCount, getProfileVisualGrooveCount } from '../utils/profileMachining';
import type { ProfileSide } from '../types';

// Explicit catalog expectations in A/B/C/D order, independent of renderer rules.
const expected: Record<string, number[]> = {
  '1515': [1,1,1,1], '1515-N1': [0,1,1,1], '1515-N2': [0,0,1,1],
  '2020': [1,1,1,1], '2020-N1': [0,1,1,1], '2020-N2': [0,0,1,1],
  '2020-N2-OPP': [0,1,0,1], '2020-N3': [0,0,0,1],
  '2020-N4-SQ': [0,0,0,0], '2020-N4-RD': [0,0,0,0], '2020R': [0,0,1,1],
  '2040': [1,2,1,2], '2040-N1-20': [0,2,1,2], '2040-N1-40': [1,2,1,0],
  '2047': [0,2,1,2], '2060': [1,3,1,3], '20100': [1,5,1,5],
  '3030': [1,1,1,1], '3030-N1': [0,1,1,1], '3030-N2': [0,0,1,1],
  '3030R': [0,0,1,1], '3060': [1,2,1,2], '3060-N1-60': [1,2,1,0],
  '4040': [1,1,1,1], '4080': [1,2,1,2],
};
const sides: ProfileSide[] = ['A','B','C','D'];
for (const { id } of PROFILE_VARIANTS) {
  assert(expected[id], `Add catalog expectations for ${id}`);
  assert.deepEqual(sides.map(side => getProfileVisualGrooveCount(id, side)), expected[id], id);
  const group = createChatProfilePreview({ variantId: id, length: 200, colorId: 'natural', finish: 'natural', holes: [], tapping: {left: [], right: []} });
  const body = group.children.find(child => child instanceof Mesh) as Mesh;
  body.updateMatrixWorld(true);
  const [, w, h] = id.match(/^(\d{2})(\d{2,3})/)!;
  const width = Number(w) / 100, height = Number(h) / 100;
  sides.forEach((side, index) => {
    // Curved exteriors have no planar boundary to probe; their flat slotted sides still do.
    if ((id.endsWith('R') && index < 2) || id === '2020-N4-RD') return;
    const wide = side === 'B' || side === 'D';
    const span = wide ? height : width;
    const stationCount = Math.max(1, Math.round(span / Math.min(width, height)));
    for (let station = 0; station < stationCount; station++) {
      const cross = id === '2047' && wide ? (station === 0 ? -0.135 : 0.135) : -span / 2 + (station + 0.5) * span / stationCount;
      const normal = new Vector3(0, side === 'A' ? 1 : side === 'C' ? -1 : 0, side === 'B' ? 1 : side === 'D' ? -1 : 0);
      const boundary = new Vector3(0, wide ? cross : normal.y * height / 2, wide ? normal.z * width / 2 : cross);
      const ray = new Raycaster(boundary.clone().add(normal), normal.clone().negate());
      const hit = ray.intersectObject(body, false)[0];
      assert(hit, `${id} ${side} must intersect body`);
      const recessed = hit.distance > 1.01;
      assert.equal(recessed, expected[id][index] > 0, `${id} ${side} station ${station}: actual mesh groove (distance ${hit.distance})`);
    }
  });
}
for (const id of ['2040-N1-40', '3060-N1-60']) {
  assert.equal(getProfileGrooveCount(id, 'D'), 2, 'sealed wide face retains two machining stations');
}
console.log(`Verified visible slots and actual 3D mesh faces for all ${PROFILE_VARIANTS.length} catalog profiles.`);
