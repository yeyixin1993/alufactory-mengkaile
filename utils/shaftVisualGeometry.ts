import * as THREE from 'three';
import { DESIGNER_MM_PER_SCENE_UNIT } from './designerSceneUnits';

/** Simplified SK8 display body, matching the vendor-v3 local XYZ datum and open Ø8 bore. */
export function createSk8SupportGeometry() {
  const scale = 1 / DESIGNER_MM_PER_SCENE_UNIT;
  const face = new THREE.Shape();
  const outline = [[-21, -16.4], [21, -16.4], [21, -10.4], [9, -10.4], [9, 16.4], [-9, 16.4], [-9, -10.4], [-21, -10.4]];
  outline.forEach(([x, y], index) => {
    if (index === 0) face.moveTo(x * scale, y * scale);
    else face.lineTo(x * scale, y * scale);
  });
  face.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 3.6 * scale, 4 * scale, 0, Math.PI * 2, true);
  face.holes.push(bore);
  const geometry = new THREE.ExtrudeGeometry(face, { depth: 14 * scale, bevelEnabled: false, curveSegments: 48, steps: 1 });
  geometry.translate(0, 0, -7 * scale);
  return geometry;
}

// Display geometry only. These meshes never create machining or BOM records.
// Extrusion bevels stay inside the supplied envelope, including its thickness.
export function extrudeMachinedFace(shape: THREE.Shape, depth: number, bevel: number) {
  const edge = Math.min(bevel, depth * 0.15);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * edge,
    bevelEnabled: true,
    bevelSize: edge,
    bevelThickness: edge,
    bevelSegments: 3,
    curveSegments: 48,
    steps: 1,
  });
  geometry.translate(0, 0, -depth / 2 + edge);
  return geometry;
}

export function createBoredClampHalf(width: number, height: number, depth: number, radius: number, holeY: number) {
  const edge = Math.min(width, height, depth) * 0.025;
  const x = width / 2 - edge;
  const y = height / 2 - edge;
  const corner = Math.min(width, height) * 0.07;
  const face = new THREE.Shape();
  face.moveTo(-x + corner, -y);
  face.lineTo(x - corner, -y);
  face.quadraticCurveTo(x, -y, x, -y + corner);
  face.lineTo(x, y - corner);
  face.quadraticCurveTo(x, y, x - corner, y);
  face.lineTo(-x + corner, y);
  face.quadraticCurveTo(-x, y, -x, y - corner);
  face.lineTo(-x, -y + corner);
  face.quadraticCurveTo(-x, -y, -x + corner, -y);
  const bore = new THREE.Path();
  bore.absarc(0, holeY, radius + edge, 0, Math.PI * 2, true);
  face.holes.push(bore);
  return extrudeMachinedFace(face, depth, edge);
}

export function createSplitCollar(outerRadius: number, boreRadius: number, depth: number) {
  const edge = Math.min(depth * 0.04, (outerRadius - boreRadius) * 0.08);
  const start = Math.PI * 0.06;
  const end = Math.PI * 1.94;
  const face = new THREE.Shape();
  face.absarc(0, 0, outerRadius - edge, start, end, false);
  face.lineTo((boreRadius + edge) * Math.cos(end), (boreRadius + edge) * Math.sin(end));
  face.absarc(0, 0, boreRadius + edge, end, start, true);
  face.closePath();
  return extrudeMachinedFace(face, depth, edge);
}

export function createBoredSleeve(outerRadius: number, boreRadius: number, depth: number) {
  const edge = Math.min(depth * 0.025, (outerRadius - boreRadius) * 0.08);
  const face = new THREE.Shape();
  face.absarc(0, 0, outerRadius - edge, 0, Math.PI * 2, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, boreRadius + edge, 0, Math.PI * 2, true);
  face.holes.push(bore);
  return extrudeMachinedFace(face, depth, edge);
}
