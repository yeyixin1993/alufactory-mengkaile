import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import {
  Box,
  CircleDot,
  Copy,
  Download,
  Grid3X3,
  Hammer,
  Move3D,
  Paintbrush,
  PanelTop,
  Redo2,
  Rotate3D,
  Save,
  ShoppingCart,
  Trash2,
  Undo2,
  Upload,
  Wrench,
} from 'lucide-react';
import { INITIAL_PRODUCTS, PROFILE_COLORS, PROFILE_VARIANTS } from '../constants';
import {
  CartItem,
  DrillHole,
  HoleType,
  Language,
  Product,
  ProductType,
  ProfileSide,
  ThreadSize,
  User,
} from '../types';
import { normalizeMembershipLevel } from '../utils/membership';

type DIYItemKind = 'profile' | 'plate' | 'pegboard' | 'marine_board' | 'connector' | 'foot';

type Vec3 = [number, number, number];
type RotationAxisIndex = 0 | 1 | 2;

interface DIYSceneItem {
  id: string;
  kind: DIYItemKind;
  name: string;
  position: Vec3;
  rotation: Vec3;
  colorId: string;
  quantity: number;
  variantId?: string;
  length?: number;
  width?: number;
  height?: number;
  thickness?: number;
  holes?: DrillHole[];
  tappingLeft?: boolean;
  tappingRight?: boolean;
  accessoryPrice?: number;
  remark?: string;
}

interface DIYDesignerProps {
  language: Language;
  user?: User | null;
  onAddBatchToCart: (items: CartItem[]) => void;
}

const SCENE_SCALE = 100;
const STORAGE_KEY = 'mengkaile_diy_design_v1';
const MIN_BOARD_AREA = 0.2;
const ALUMINUM_PLATE_PRICE: Record<number, number> = { 1: 500, 2: 700, 3: 1000, 4: 1300, 5: 1600 };
const PEGBOARD_PRICE: Record<number, number> = { 1: 780, 2: 1080, 3: 1380, 4: 1680, 5: 1980 };
const MARINE_BOARD_PRICE: Record<number, number> = { 12: 155, 18: 200 };
const MARINE_COLOR_SURCHARGE = 100;

const COLOR_HEX: Record<string, string> = {
  natural: '#d9dee4',
  silver: '#f4f6f8',
  red: '#c51f2f',
  sapphire_blue: '#174ea6',
  purple: '#733c8f',
  sky_blue: '#4ba7d8',
  green: '#1f6a4a',
  willow_green: '#7ca66a',
  qingli_coffee: '#6e5145',
  beige: '#e8ddc6',
  indigo_blue: '#253a60',
  cool_green: '#74a79a',
  apple_gold: '#c69a4b',
  olive_brown: '#665c3c',
  lime_gold: '#b2a04a',
  pink: '#df8ea8',
  coffee: '#5b3b2d',
  black: '#17191d',
  british_grey: '#66717c',
};

const TEXT: Record<Language, Record<string, string>> = {
  cn: {
    title: '铝型材 3D DIY 设计器',
    subtitle: '拖入型材、板材和配件，调整尺寸、颜色、孔位后直接加入购物车。',
    library: '零件库',
    project: '项目结构',
    properties: '参数与加工',
    empty: '选择一个零件以编辑参数',
    profile2020: '2020 铝型材',
    profile2040: '2040 铝型材',
    plate: '彩色铝板',
    pegboard: '彩色洞洞板',
    marine: '彩色海洋板',
    connector: '角码连接件',
    foot: '调平脚',
    addDemo: '生成示例工作台',
    move: '移动',
    rotate: '每次旋转 90°',
    save: '保存',
    load: '读取',
    export: '导出 JSON',
    addCart: '加入购物车',
    total: '设计估价',
    length: '长度 (mm)',
    width: '宽度 (mm)',
    height: '高度 (mm)',
    thickness: '厚度 (mm)',
    quantity: '数量',
    model: '型材型号',
    color: '颜色',
    position: '位置 (mm)',
    rotation: '旋转 (°)',
    drilling: '定制打孔',
    holePosition: '孔位 (mm)',
    side: '面',
    holeType: '孔类型',
    addHole: '添加孔',
    tapping: '端面攻丝',
    left: '左端',
    right: '右端',
    oxidized: '氧化银白',
    electrophoretic: '电泳',
    powder: '喷粉',
    through: '通孔',
    countersunk: '沉头孔',
    threaded: '螺纹孔',
    saved: '设计已保存在本机',
    loaded: '已读取保存的设计',
    cartAdded: '设计清单已加入购物车',
    dragHint: '点击添加；拖动紫色方块自由移动，拖动两端黑色箭头修改长度，右键旋转或删除。',
    delete: '删除',
    duplicate: '复制',
    backToProject: '返回项目结构',
    projectSummary: '项目结构',
    noParts: '还没有添加任何零件',
    remark: '备注',
    remarkPlaceholder: '为这个零件添加加工、安装或识别备注…',
    rotateX: '绕 X 轴 +90°',
    rotateY: '绕 Y 轴 +90°',
    rotateZ: '绕 Z 轴 +90°',
    snapEnd: '磁吸：端点连接',
    snapSide: '磁吸：交叉连接',
    snapOffset: '磁吸：边缘对齐',
    snapCollision: '已阻止型材相互穿透',
  },
  en: {
    title: 'Aluminum Profile 3D DIY Designer',
    subtitle: 'Drag profiles, panels and hardware into one assembly, then customize sizes, colors and machining.',
    library: 'Parts library',
    project: 'Project structure',
    properties: 'Properties & machining',
    empty: 'Select a part to edit it',
    profile2020: '2020 profile',
    profile2040: '2040 profile',
    plate: 'Colored aluminum plate',
    pegboard: 'Colored pegboard',
    marine: 'Colored marine board',
    connector: 'Corner bracket',
    foot: 'Leveling foot',
    addDemo: 'Build demo workbench',
    move: 'Move',
    rotate: 'Rotate 90° per click',
    save: 'Save',
    load: 'Load',
    export: 'Export JSON',
    addCart: 'Add design to cart',
    total: 'Design estimate',
    length: 'Length (mm)',
    width: 'Width (mm)',
    height: 'Height (mm)',
    thickness: 'Thickness (mm)',
    quantity: 'Quantity',
    model: 'Profile model',
    color: 'Color',
    position: 'Position (mm)',
    rotation: 'Rotation (°)',
    drilling: 'Custom drilling',
    holePosition: 'Hole position (mm)',
    side: 'Face',
    holeType: 'Hole type',
    addHole: 'Add hole',
    tapping: 'End tapping',
    left: 'Left end',
    right: 'Right end',
    oxidized: 'Silver anodized',
    electrophoretic: 'Electrophoretic',
    powder: 'Powder coat',
    through: 'Through hole',
    countersunk: 'Countersunk',
    threaded: 'Threaded',
    saved: 'Design saved on this device',
    loaded: 'Saved design loaded',
    cartAdded: 'Design parts added to cart',
    dragHint: 'Click to add; drag the purple square to move freely, use the black end arrows to resize, and right-click to rotate or delete.',
    delete: 'Delete',
    duplicate: 'Duplicate',
    backToProject: 'Back to project',
    projectSummary: 'Project structure',
    noParts: 'No parts added yet',
    remark: 'Remark',
    remarkPlaceholder: 'Add machining, installation, or identification notes for this part…',
    rotateX: 'Rotate X +90°',
    rotateY: 'Rotate Y +90°',
    rotateZ: 'Rotate Z +90°',
    snapEnd: 'Magnet: end connection',
    snapSide: 'Magnet: cross connection',
    snapOffset: 'Magnet: edge alignment',
    snapCollision: 'Profile overlap prevented',
  },
  jp: {
    title: 'アルミプロファイル 3D DIY デザイナー',
    subtitle: 'プロファイル、パネル、金具を配置し、寸法・色・加工をカスタマイズできます。',
    library: 'パーツライブラリ',
    project: 'プロジェクト構成',
    properties: '設定と加工',
    empty: '編集するパーツを選択してください',
    profile2020: '2020 プロファイル',
    profile2040: '2040 プロファイル',
    plate: 'カラーアルミ板',
    pegboard: 'カラーペグボード',
    marine: 'カラーマリンボード',
    connector: 'コーナーブラケット',
    foot: 'レベリングフット',
    addDemo: '作業台サンプルを作成',
    move: '移動',
    rotate: '1回90°回転',
    save: '保存',
    load: '読込',
    export: 'JSON出力',
    addCart: 'カートに追加',
    total: '見積金額',
    length: '長さ (mm)',
    width: '幅 (mm)',
    height: '高さ (mm)',
    thickness: '厚さ (mm)',
    quantity: '数量',
    model: '型番',
    color: '色',
    position: '位置 (mm)',
    rotation: '回転 (°)',
    drilling: '穴あけ加工',
    holePosition: '穴位置 (mm)',
    side: '面',
    holeType: '穴タイプ',
    addHole: '穴を追加',
    tapping: '端面タップ',
    left: '左端',
    right: '右端',
    oxidized: 'シルバーアルマイト',
    electrophoretic: '電着塗装',
    powder: '粉体塗装',
    through: '貫通穴',
    countersunk: '皿穴',
    threaded: 'ねじ穴',
    saved: '端末に保存しました',
    loaded: '保存済みデザインを読み込みました',
    cartAdded: 'カートに追加しました',
    dragHint: 'クリックで追加。紫の四角で自由移動し、両端の黒い矢印で長さを変更。右クリックで回転・削除できます。',
    delete: '削除',
    duplicate: '複製',
    backToProject: 'プロジェクトへ戻る',
    projectSummary: 'プロジェクト構成',
    noParts: 'パーツがまだありません',
    remark: '備考',
    remarkPlaceholder: '加工、取付、識別用の備考を追加…',
    rotateX: 'X軸 +90°',
    rotateY: 'Y軸 +90°',
    rotateZ: 'Z軸 +90°',
    snapEnd: 'スナップ：端点接続',
    snapSide: 'スナップ：交差接続',
    snapOffset: 'スナップ：端揃え',
    snapCollision: '形材同士の貫通を防止しました',
  },
};

const makeId = () => `diy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const cloneItems = (items: DIYSceneItem[]) => JSON.parse(JSON.stringify(items)) as DIYSceneItem[];

const profileSize = (variantId = '2020'): [number, number] => {
  const first = variantId.match(/^(\d{2})(\d{2,3})/);
  if (!first) return [20, 20];
  return [Number(first[1]), Number(first[2])];
};

const createItem = (kind: DIYItemKind, index = 0, variantId?: string): DIYSceneItem => {
  const offset = index * 80;
  if (kind === 'profile') {
    const model = variantId || '2020';
    return {
      id: makeId(),
      kind,
      name: model,
      position: [0, 500 + offset, 0],
      rotation: [0, 0, 0],
      colorId: 'natural',
      variantId: model,
      length: 1000,
      holes: [],
      tappingLeft: false,
      tappingRight: false,
      quantity: 1,
      remark: '',
    };
  }
  if (kind === 'plate' || kind === 'pegboard' || kind === 'marine_board') {
    return {
      id: makeId(),
      kind,
      name: kind === 'plate' ? 'Aluminum plate' : kind === 'pegboard' ? 'Pegboard' : 'Marine board',
      position: [0, 550, -120 - offset],
      rotation: [0, 0, 0],
      colorId: kind === 'marine_board' ? 'coffee' : 'black',
      width: 900,
      height: 500,
      thickness: kind === 'marine_board' ? 18 : 2,
      quantity: 1,
      remark: '',
    };
  }
  return {
    id: makeId(),
    kind,
    name: kind === 'connector' ? 'Corner bracket' : 'Leveling foot',
    position: [offset, kind === 'foot' ? 35 : 500, 0],
    rotation: [0, 0, 0],
    colorId: kind === 'connector' ? 'silver' : 'black',
    width: kind === 'connector' ? 35 : 45,
    height: kind === 'connector' ? 35 : 70,
    thickness: kind === 'connector' ? 4 : 35,
    accessoryPrice: kind === 'connector' ? 8 : 12,
    quantity: 1,
    remark: '',
  };
};

const buildDemoWorkbench = (): DIYSceneItem[] => {
  const items: DIYSceneItem[] = [];
  const addProfile = (length: number, position: Vec3, rotation: Vec3 = [0, 0, 0], variantId = '2020') => {
    items.push({ ...createItem('profile', items.length, variantId), length, position, rotation, name: variantId });
  };
  addProfile(1000, [0, 760, 250]);
  addProfile(1000, [0, 760, -250]);
  addProfile(500, [-500, 760, 0], [0, 90, 0]);
  addProfile(500, [500, 760, 0], [0, 90, 0]);
  addProfile(720, [-470, 370, 230], [0, 0, 90]);
  addProfile(720, [470, 370, 230], [0, 0, 90]);
  addProfile(720, [-470, 370, -230], [0, 0, 90]);
  addProfile(720, [470, 370, -230], [0, 0, 90]);
  items.push({ ...createItem('pegboard'), position: [0, 1050, -270], width: 850, height: 420, colorId: 'sapphire_blue' });
  items.push({ ...createItem('marine_board'), position: [0, 790, 0], width: 1000, height: 520, thickness: 18, rotation: [90, 0, 0], colorId: 'coffee' });
  [-470, 470].forEach((x) => [-230, 230].forEach((z) => items.push({ ...createItem('foot'), position: [x, 20, z] })));
  return items;
};

const disposeObject = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
};

const makeMaterial = (colorId: string, selected: boolean, kind: DIYItemKind) => new THREE.MeshStandardMaterial({
  color: COLOR_HEX[colorId] || '#b9c0c7',
  metalness: kind === 'marine_board' ? 0.08 : kind === 'foot' ? 0.45 : 0.72,
  roughness: kind === 'marine_board' ? 0.68 : 0.28,
  emissive: selected ? new THREE.Color('#174ea6') : new THREE.Color('#000000'),
  emissiveIntensity: selected ? 0.18 : 0,
});

const addEdges = (mesh: THREE.Mesh, color = '#475569') => {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 }),
  );
  mesh.add(edges);
};

const addSelectionHitbox = (group: THREE.Group, geometry: THREE.BufferGeometry) => {
  const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  material.colorWrite = false;
  const hitbox = new THREE.Mesh(geometry, material);
  hitbox.userData.selectionProxy = true;
  group.add(hitbox);
};

const profileDimensions = (item: DIYSceneItem) => {
  const [widthMm, heightMm] = profileSize(item.variantId);
  return {
    length: Math.max(20, item.length || 1000) / SCENE_SCALE,
    width: widthMm / SCENE_SCALE,
    height: heightMm / SCENE_SCALE,
  };
};

type ProfileSnap = {
  position: THREE.Vector3;
  point: THREE.Vector3;
  label: 'end' | 'side' | 'offset';
};

type ProfileBox = {
  center: THREE.Vector3;
  axes: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  halfSizes: [number, number, number];
};

const profileBox = (item: DIYSceneItem, group: THREE.Group, position = group.position): ProfileBox => {
  const dimensions = profileDimensions(item);
  return {
    center: position.clone(),
    axes: [
      new THREE.Vector3(1, 0, 0).applyQuaternion(group.quaternion).normalize(),
      new THREE.Vector3(0, 1, 0).applyQuaternion(group.quaternion).normalize(),
      new THREE.Vector3(0, 0, 1).applyQuaternion(group.quaternion).normalize(),
    ],
    halfSizes: [dimensions.length / 2, dimensions.height / 2, dimensions.width / 2],
  };
};

const profileBoxFromItem = (item: DIYSceneItem): ProfileBox => {
  const dimensions = profileDimensions(item);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(item.rotation[0]),
    THREE.MathUtils.degToRad(item.rotation[1]),
    THREE.MathUtils.degToRad(item.rotation[2]),
  ));
  return {
    center: new THREE.Vector3(
      item.position[0] / SCENE_SCALE,
      item.position[1] / SCENE_SCALE,
      item.position[2] / SCENE_SCALE,
    ),
    axes: [
      new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize(),
      new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize(),
      new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize(),
    ],
    halfSizes: [dimensions.length / 2, dimensions.height / 2, dimensions.width / 2],
  };
};

const orientedBoxesOverlap = (first: ProfileBox, second: ProfileBox, tolerance = 0.004) => {
  const axes = [
    ...first.axes,
    ...second.axes,
    ...first.axes.flatMap((firstAxis) => second.axes.map((secondAxis) => (
      new THREE.Vector3().crossVectors(firstAxis, secondAxis)
    ))),
  ];
  const centerDelta = second.center.clone().sub(first.center);
  return axes.every((candidateAxis) => {
    if (candidateAxis.lengthSq() < 1e-8) return true;
    const axis = candidateAxis.normalize();
    const centerDistance = Math.abs(centerDelta.dot(axis));
    const firstRadius = first.axes.reduce(
      (sum, boxAxis, index) => sum + first.halfSizes[index] * Math.abs(boxAxis.dot(axis)),
      0,
    );
    const secondRadius = second.axes.reduce(
      (sum, boxAxis, index) => sum + second.halfSizes[index] * Math.abs(boxAxis.dot(axis)),
      0,
    );
    return centerDistance < firstRadius + secondRadius - tolerance;
  });
};

const profileItemCollides = (candidate: DIYSceneItem, items: DIYSceneItem[]) => {
  if (candidate.kind !== 'profile') return false;
  const candidateBox = profileBoxFromItem(candidate);
  return items.some((item) => (
    item.id !== candidate.id
    && item.kind === 'profile'
    && orientedBoxesOverlap(candidateBox, profileBoxFromItem(item))
  ));
};

const profileCollides = (
  moving: THREE.Group,
  movingItem: DIYSceneItem,
  position: THREE.Vector3,
  items: DIYSceneItem[],
  groups: Map<string, THREE.Group>,
) => {
  const movingBox = profileBox(movingItem, moving, position);
  return items.some((targetItem) => {
    if (targetItem.id === movingItem.id || targetItem.kind !== 'profile') return false;
    const target = groups.get(targetItem.id);
    return !!target && orientedBoxesOverlap(movingBox, profileBox(targetItem, target));
  });
};

const uniqueOffsets = (values: number[]) => (
  values.filter((value, index) => values.findIndex((candidate) => Math.abs(candidate - value) < 0.001) === index)
);

const findMagneticProfileSnap = (
  moving: THREE.Group,
  movingItem: DIYSceneItem,
  items: DIYSceneItem[],
  groups: Map<string, THREE.Group>,
): ProfileSnap | null => {
  if (movingItem.kind !== 'profile') return null;
  const movingBox = profileBox(movingItem, moving);
  let best: { distance: number; snap: ProfileSnap } | null = null;

  items.forEach((targetItem) => {
    if (targetItem.id === movingItem.id || targetItem.kind !== 'profile') return;
    const target = groups.get(targetItem.id);
    if (!target) return;
    const targetBox = profileBox(targetItem, target);

    targetBox.axes.forEach((targetNormalAxis, targetAxisIndex) => {
      [-1, 1].forEach((targetDirection) => {
        const targetNormal = targetNormalAxis.clone().multiplyScalar(targetDirection);
        const targetFaceCenter = targetBox.center.clone().addScaledVector(
          targetNormal,
          targetBox.halfSizes[targetAxisIndex],
        );
        const tangentIndices = ([0, 1, 2] as const).filter((index) => index !== targetAxisIndex);
        const tangentOffsets = tangentIndices.map((tangentIndex) => {
          const tangent = targetBox.axes[tangentIndex];
          const movingProjectedHalf = movingBox.axes.reduce(
            (sum, movingAxis, movingIndex) => (
              sum + movingBox.halfSizes[movingIndex] * Math.abs(movingAxis.dot(tangent))
            ),
            0,
          );
          const targetHalf = targetBox.halfSizes[tangentIndex];
          const insideAlignment = Math.max(0, targetHalf - movingProjectedHalf);
          const outsideAlignment = targetHalf + movingProjectedHalf;
          return uniqueOffsets([0, -insideAlignment, insideAlignment, -outsideAlignment, outsideAlignment]);
        });

        movingBox.axes.forEach((movingNormalAxis, movingAxisIndex) => {
          [-1, 1].forEach((movingDirection) => {
            const movingNormal = movingNormalAxis.clone().multiplyScalar(movingDirection);
            if (targetNormal.dot(movingNormal) > -0.995) return;
            const movingFaceOffset = movingNormal.clone().multiplyScalar(movingBox.halfSizes[movingAxisIndex]);

            tangentOffsets[0].forEach((firstOffset) => tangentOffsets[1].forEach((secondOffset) => {
              const targetPoint = targetFaceCenter.clone()
                .addScaledVector(targetBox.axes[tangentIndices[0]], firstOffset)
                .addScaledVector(targetBox.axes[tangentIndices[1]], secondOffset);
              const candidatePosition = targetPoint.clone().sub(movingFaceOffset);
              const distance = moving.position.distanceTo(candidatePosition);
              if (distance > 0.65 || (best && distance >= best.distance)) return;
              if (profileCollides(moving, movingItem, candidatePosition, items, groups)) return;
              const hasOffset = Math.abs(firstOffset) > 0.001 || Math.abs(secondOffset) > 0.001;
              best = {
                distance,
                snap: {
                  position: candidatePosition,
                  point: targetPoint,
                  label: hasOffset ? 'offset' : targetAxisIndex === 0 || movingAxisIndex === 0 ? 'end' : 'side',
                },
              };
            }));
          });
        });
      });
    });
  });
  return best?.snap || null;
};

type ProfileFace = 'top' | 'right' | 'bottom' | 'left';

const getActiveProfileFaces = (variantId = '2020'): Set<ProfileFace> => {
  const active = new Set<ProfileFace>(['top', 'right', 'bottom', 'left']);
  if (variantId.includes('N4')) return new Set<ProfileFace>();
  if (variantId.includes('N3')) return new Set<ProfileFace>(['bottom']);
  if (variantId.includes('N2-OPP')) return new Set<ProfileFace>(['right', 'left']);
  if (variantId.includes('N2')) {
    active.delete('top');
    active.delete('right');
  } else if (variantId.includes('N1')) {
    active.delete('top');
  }
  return active;
};

const addTSlotHole = (
  shape: THREE.Shape,
  face: ProfileFace,
  center: number,
  width: number,
  height: number,
  cellSize: number,
) => {
  const skin = Math.max(0.006, cellSize * 0.025);
  const opening = cellSize * 0.27;
  const chamber = cellSize * 0.54;
  const neckDepth = cellSize * 0.11;
  const totalDepth = cellSize * 0.30;
  const path = new THREE.Path();

  if (face === 'top') {
    const edge = height / 2 - skin;
    path.moveTo(center - opening / 2, edge);
    path.lineTo(center + opening / 2, edge);
    path.lineTo(center + opening / 2, edge - neckDepth);
    path.lineTo(center + chamber / 2, edge - neckDepth);
    path.lineTo(center + chamber / 2, edge - totalDepth);
    path.lineTo(center - chamber / 2, edge - totalDepth);
    path.lineTo(center - chamber / 2, edge - neckDepth);
    path.lineTo(center - opening / 2, edge - neckDepth);
  } else if (face === 'bottom') {
    const edge = -height / 2 + skin;
    path.moveTo(center - opening / 2, edge);
    path.lineTo(center - opening / 2, edge + neckDepth);
    path.lineTo(center - chamber / 2, edge + neckDepth);
    path.lineTo(center - chamber / 2, edge + totalDepth);
    path.lineTo(center + chamber / 2, edge + totalDepth);
    path.lineTo(center + chamber / 2, edge + neckDepth);
    path.lineTo(center + opening / 2, edge + neckDepth);
    path.lineTo(center + opening / 2, edge);
  } else if (face === 'right') {
    const edge = width / 2 - skin;
    path.moveTo(edge, center - opening / 2);
    path.lineTo(edge - neckDepth, center - opening / 2);
    path.lineTo(edge - neckDepth, center - chamber / 2);
    path.lineTo(edge - totalDepth, center - chamber / 2);
    path.lineTo(edge - totalDepth, center + chamber / 2);
    path.lineTo(edge - neckDepth, center + chamber / 2);
    path.lineTo(edge - neckDepth, center + opening / 2);
    path.lineTo(edge, center + opening / 2);
  } else {
    const edge = -width / 2 + skin;
    path.moveTo(edge, center - opening / 2);
    path.lineTo(edge, center + opening / 2);
    path.lineTo(edge + neckDepth, center + opening / 2);
    path.lineTo(edge + neckDepth, center + chamber / 2);
    path.lineTo(edge + totalDepth, center + chamber / 2);
    path.lineTo(edge + totalDepth, center - chamber / 2);
    path.lineTo(edge + neckDepth, center - chamber / 2);
    path.lineTo(edge + neckDepth, center - opening / 2);
  }
  path.closePath();
  shape.holes.push(path);
};

const addProfileEndDetail = (
  group: THREE.Group,
  item: DIYSceneItem,
  selected: boolean,
  side: -1 | 1,
  length: number,
  width: number,
  height: number,
  columns: number,
  rows: number,
) => {
  const face = new THREE.Group();
  face.position.x = side * (length / 2 + 0.004);
  face.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;

  const cellWidth = width / columns;
  const cellHeight = height / rows;
  const cellSize = Math.min(cellWidth, cellHeight);
  const wall = Math.max(0.012, cellSize * 0.075);
  const surfaceColor = COLOR_HEX[item.colorId] || '#d9dee4';
  const surfaceMaterial = new THREE.MeshStandardMaterial({
    color: surfaceColor,
    metalness: 0.78,
    roughness: 0.24,
    emissive: selected ? new THREE.Color('#174ea6') : new THREE.Color('#000000'),
    emissiveIntensity: selected ? 0.2 : 0,
    side: THREE.DoubleSide,
  });
  const cavityMaterial = new THREE.MeshBasicMaterial({
    color: '#171c22',
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });

  const addPlane = (
    planeWidth: number,
    planeHeight: number,
    x: number,
    y: number,
    material: THREE.Material,
    z = 0,
  ) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(planeWidth, planeHeight), material);
    mesh.position.set(x, y, z);
    mesh.renderOrder = 2;
    face.add(mesh);
    return mesh;
  };

  addPlane(width * 0.985, height * 0.985, 0, 0, cavityMaterial, 0);
  addPlane(width, wall, 0, height / 2 - wall / 2, surfaceMaterial, 0.001);
  addPlane(width, wall, 0, -height / 2 + wall / 2, surfaceMaterial, 0.001);
  addPlane(wall, height, -width / 2 + wall / 2, 0, surfaceMaterial, 0.001);
  addPlane(wall, height, width / 2 - wall / 2, 0, surfaceMaterial, 0.001);

  for (let column = 1; column < columns; column += 1) {
    addPlane(wall, height - wall * 2, -width / 2 + column * cellWidth, 0, surfaceMaterial, 0.001);
  }
  for (let row = 1; row < rows; row += 1) {
    addPlane(width - wall * 2, wall, 0, -height / 2 + row * cellHeight, surfaceMaterial, 0.001);
  }

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const centerX = -width / 2 + (column + 0.5) * cellWidth;
      const centerY = -height / 2 + (row + 0.5) * cellHeight;
      const spokeLength = cellSize * 0.43;
      const spokeThickness = Math.max(0.009, cellSize * 0.055);
      [45, 135, 225, 315].forEach((degrees) => {
        const angle = THREE.MathUtils.degToRad(degrees);
        const spoke = addPlane(
          spokeLength,
          spokeThickness,
          centerX + Math.cos(angle) * cellSize * 0.18,
          centerY + Math.sin(angle) * cellSize * 0.18,
          surfaceMaterial,
          0.002,
        );
        spoke.rotation.z = angle;
      });

      const hub = new THREE.Mesh(
        new THREE.RingGeometry(cellSize * 0.09, cellSize * 0.17, 24),
        surfaceMaterial,
      );
      hub.position.set(centerX, centerY, 0.003);
      hub.renderOrder = 3;
      face.add(hub);

      const slotOpening = cellSize * 0.27;
      const slotDepth = wall * 1.45;
      if (row === rows - 1) {
        addPlane(slotOpening, slotDepth, centerX, height / 2 - slotDepth / 2, cavityMaterial, 0.004);
      }
      if (row === 0) {
        addPlane(slotOpening, slotDepth, centerX, -height / 2 + slotDepth / 2, cavityMaterial, 0.004);
      }
      if (column === 0) {
        addPlane(slotDepth, slotOpening, -width / 2 + slotDepth / 2, centerY, cavityMaterial, 0.004);
      }
      if (column === columns - 1) {
        addPlane(slotDepth, slotOpening, width / 2 - slotDepth / 2, centerY, cavityMaterial, 0.004);
      }
    }
  }

  group.add(face);
};

const createProfileObject = (item: DIYSceneItem, selected: boolean) => {
  const group = new THREE.Group();
  const [sectionWidth, sectionHeight] = profileSize(item.variantId);
  const length = Math.max(20, item.length || 1000) / SCENE_SCALE;
  const width = sectionWidth / SCENE_SCALE;
  const height = sectionHeight / SCENE_SCALE;
  const cellSize = Math.min(width, height);
  const activeFaces = getActiveProfileFaces(item.variantId);
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, -height / 2);
  shape.lineTo(width / 2, -height / 2);
  shape.lineTo(width / 2, height / 2);
  shape.lineTo(-width / 2, height / 2);
  shape.closePath();

  const columns = Math.max(1, Math.round(width / cellSize));
  const rows = Math.max(1, Math.round(height / cellSize));
  const xCenters = Array.from({ length: columns }, (_, index) => -width / 2 + ((index + 0.5) * width) / columns);
  const yCenters = Array.from({ length: rows }, (_, index) => -height / 2 + ((index + 0.5) * height) / rows);
  if (activeFaces.has('top')) xCenters.forEach((center) => addTSlotHole(shape, 'top', center, width, height, cellSize));
  if (activeFaces.has('bottom')) xCenters.forEach((center) => addTSlotHole(shape, 'bottom', center, width, height, cellSize));
  if (activeFaces.has('right')) yCenters.forEach((center) => addTSlotHole(shape, 'right', center, width, height, cellSize));
  if (activeFaces.has('left')) yCenters.forEach((center) => addTSlotHole(shape, 'left', center, width, height, cellSize));

  xCenters.forEach((x) => yCenters.forEach((y) => {
    const bore = new THREE.Path();
    bore.absarc(x, y, cellSize * 0.13, 0, Math.PI * 2, false);
    shape.holes.push(bore);
  }));

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: Math.min(0.008, cellSize * 0.025),
    bevelThickness: Math.min(0.008, cellSize * 0.025),
    curveSegments: 16,
  });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-length / 2, 0, 0);
  geometry.computeVertexNormals();

  const body = new THREE.Mesh(geometry, makeMaterial(item.colorId, selected, item.kind));
  body.castShadow = true;
  body.receiveShadow = true;
  addEdges(body, item.colorId === 'black' ? '#64748b' : '#6b7280');
  group.add(body);

  const grooveMaterial = new THREE.MeshStandardMaterial({ color: '#232a31', metalness: 0.25, roughness: 0.75 });
  const grooveThickness = Math.max(0.014, cellSize * 0.055);
  const grooveDepth = Math.max(0.01, cellSize * 0.035);
  if (activeFaces.has('top')) xCenters.forEach((center) => {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(length * 0.985, grooveDepth, grooveThickness), grooveMaterial.clone());
    groove.position.set(0, height / 2 + 0.001, -center);
    group.add(groove);
  });
  if (activeFaces.has('bottom')) xCenters.forEach((center) => {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(length * 0.985, grooveDepth, grooveThickness), grooveMaterial.clone());
    groove.position.set(0, -height / 2 - 0.001, -center);
    group.add(groove);
  });
  if (activeFaces.has('right')) yCenters.forEach((center) => {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(length * 0.985, grooveThickness, grooveDepth), grooveMaterial.clone());
    groove.position.set(0, center, -width / 2 - 0.001);
    group.add(groove);
  });
  if (activeFaces.has('left')) yCenters.forEach((center) => {
    const groove = new THREE.Mesh(new THREE.BoxGeometry(length * 0.985, grooveThickness, grooveDepth), grooveMaterial.clone());
    groove.position.set(0, center, width / 2 + 0.001);
    group.add(groove);
  });

  const railMaterial = makeMaterial(item.colorId, selected, item.kind);
  railMaterial.roughness = 0.22;
  const railHeight = Math.max(0.018, cellSize * 0.09);
  const railWidth = Math.max(0.026, cellSize * 0.16);
  const railOffset = cellSize * 0.23;
  const addRail = (rail: THREE.Mesh) => {
    rail.castShadow = true;
    rail.receiveShadow = true;
    addEdges(rail, item.colorId === 'black' ? '#7c8796' : '#7b8491');
    group.add(rail);
  };
  if (activeFaces.has('top')) xCenters.forEach((center) => [-1, 1].forEach((direction) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length * 0.99, railHeight, railWidth), railMaterial.clone());
    rail.position.set(0, height / 2 + railHeight / 2, -center + direction * railOffset);
    addRail(rail);
  }));
  if (activeFaces.has('bottom')) xCenters.forEach((center) => [-1, 1].forEach((direction) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length * 0.99, railHeight, railWidth), railMaterial.clone());
    rail.position.set(0, -height / 2 - railHeight / 2, -center + direction * railOffset);
    addRail(rail);
  }));
  if (activeFaces.has('right')) yCenters.forEach((center) => [-1, 1].forEach((direction) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length * 0.99, railWidth, railHeight), railMaterial.clone());
    rail.position.set(0, center + direction * railOffset, -width / 2 - railHeight / 2);
    addRail(rail);
  }));
  if (activeFaces.has('left')) yCenters.forEach((center) => [-1, 1].forEach((direction) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length * 0.99, railWidth, railHeight), railMaterial.clone());
    rail.position.set(0, center + direction * railOffset, width / 2 + railHeight / 2);
    addRail(rail);
  }));

  (item.holes || []).forEach((hole) => {
    const x = -length / 2 + (hole.positionMm / Math.max(20, item.length || 1000)) * length;
    const innerRadius = hole.type === 'threaded' ? 0.027 : 0.032;
    const outerRadius = hole.type === 'countersunk' ? 0.052 : hole.type === 'threaded' ? 0.043 : 0.039;
    const marker = new THREE.Group();
    const opening = new THREE.Mesh(
      new THREE.CircleGeometry(innerRadius, 28),
      new THREE.MeshStandardMaterial({ color: '#10151c', metalness: 0.15, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(innerRadius, outerRadius, 28),
      new THREE.MeshStandardMaterial({
        color: hole.type === 'countersunk' ? '#89939e' : '#303944',
        metalness: 0.72,
        roughness: 0.3,
        polygonOffset: true,
        polygonOffsetFactor: -3,
      }),
    );
    marker.add(rim, opening);
    marker.position.x = x;
    if (hole.side === 'A' || hole.side === 'C') {
      marker.position.z = hole.side === 'A' ? width / 2 + 0.003 : -width / 2 - 0.003;
      if (hole.side === 'C') marker.rotation.y = Math.PI;
    } else {
      marker.position.y = hole.side === 'B' ? height / 2 + 0.003 : -height / 2 - 0.003;
      marker.rotation.x = hole.side === 'B' ? -Math.PI / 2 : Math.PI / 2;
    }
    group.add(marker);
  });
  addProfileEndDetail(group, item, selected, -1, length, width, height, columns, rows);
  addProfileEndDetail(group, item, selected, 1, length, width, height, columns, rows);
  addSelectionHitbox(group, new THREE.BoxGeometry(length, Math.max(height + 0.12, 0.32), Math.max(width + 0.12, 0.32)));
  return group;
};

const createBoardObject = (item: DIYSceneItem, selected: boolean) => {
  const group = new THREE.Group();
  const width = Math.max(1, item.width || 900) / SCENE_SCALE;
  const height = Math.max(1, item.height || 500) / SCENE_SCALE;
  const thickness = Math.max(1, item.thickness || 2) / SCENE_SCALE;
  const board = new THREE.Mesh(new THREE.BoxGeometry(width, height, thickness), makeMaterial(item.colorId, selected, item.kind));
  board.castShadow = true;
  board.receiveShadow = true;
  addEdges(board, item.kind === 'marine_board' ? '#5b3b2d' : '#334155');
  group.add(board);

  if (item.kind === 'marine_board') {
    const grainMaterial = new THREE.LineBasicMaterial({ color: '#2f211a', transparent: true, opacity: 0.22 });
    for (let i = -4; i <= 4; i += 1) {
      const y = (i / 10) * height;
      const points = [new THREE.Vector3(-width / 2, y, thickness / 2 + 0.003), new THREE.Vector3(width / 2, y + Math.sin(i) * 0.05, thickness / 2 + 0.003)];
      group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), grainMaterial));
    }
  }

  if (item.kind === 'pegboard') {
    const spacingMm = 50;
    const columns = Math.min(24, Math.max(2, Math.floor((item.width || 900) / spacingMm)));
    const rows = Math.min(18, Math.max(2, Math.floor((item.height || 500) / spacingMm)));
    const holeGeometry = new THREE.CylinderGeometry(0.04, 0.04, thickness * 1.35, 14);
    const holeMaterial = new THREE.MeshStandardMaterial({ color: '#10141a', roughness: 0.9 });
    const holes = new THREE.InstancedMesh(holeGeometry, holeMaterial, columns * rows);
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        dummy.position.set(-width / 2 + ((col + 1) / (columns + 1)) * width, -height / 2 + ((row + 1) / (rows + 1)) * height, thickness / 2);
        dummy.rotation.x = Math.PI / 2;
        dummy.updateMatrix();
        holes.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    group.add(holes);
  }
  addSelectionHitbox(group, new THREE.BoxGeometry(width, height, Math.max(thickness + 0.16, 0.18)));
  return group;
};

const createAccessoryObject = (item: DIYSceneItem, selected: boolean) => {
  const group = new THREE.Group();
  const material = makeMaterial(item.colorId, selected, item.kind);
  if (item.kind === 'foot') {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 24), material);
    stem.position.y = 0.22;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.28, 0.12, 28), material.clone());
    pad.position.y = -0.08;
    group.add(stem, pad);
  } else {
    const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.08, 0.28), material);
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.28), material.clone());
    horizontal.position.x = 0.18;
    vertical.position.y = 0.18;
    group.add(horizontal, vertical);
  }
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      addEdges(child);
    }
  });
  addSelectionHitbox(group, new THREE.BoxGeometry(0.65, 0.65, 0.65));
  return group;
};

type TransformGizmoInternals = TransformControls & {
  _gizmo?: {
    gizmo: Record<string, THREE.Group>;
    picker: Record<string, THREE.Group>;
  };
};

const customizeTranslateGizmo = (transform: TransformControls) => {
  const internals = transform as TransformGizmoInternals;
  const translateGizmo = internals._gizmo?.gizmo.translate;
  const translatePicker = internals._gizmo?.picker.translate;
  if (!translateGizmo || !translatePicker) return;

  const removeUnwantedHandles = (container: THREE.Group, replaceCenter: boolean) => {
    container.children.slice().forEach((child) => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) return;
      if (child.name === 'XY' || child.name === 'YZ' || child.name === 'XZ' || (replaceCenter && child.name === 'XYZ')) {
        container.remove(child);
        child.geometry.dispose();
        return;
      }
      if (child.name !== 'X' && child.name !== 'Y' && child.name !== 'Z') return;
      child.geometry.computeBoundingBox();
      const center = child.geometry.boundingBox?.getCenter(new THREE.Vector3());
      const component = child.name === 'X' ? center?.x : child.name === 'Y' ? center?.y : center?.z;
      if (component !== undefined && component < -0.04) {
        container.remove(child);
        child.geometry.dispose();
      }
    });
  };

  removeUnwantedHandles(translateGizmo, true);
  removeUnwantedHandles(translatePicker, true);
};

const createFreeMoveHandle = () => {
  const root = new THREE.Group();
  root.name = 'profile-free-move-handle';
  root.visible = false;
  const square = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, 0.09),
    new THREE.MeshBasicMaterial({
      color: '#8b5cf6',
      transparent: true,
      opacity: 0.98,
      depthTest: false,
      depthWrite: false,
    }),
  );
  square.renderOrder = 1000;
  square.userData.freeMoveHandle = true;
  const pickerMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  pickerMaterial.colorWrite = false;
  const picker = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), pickerMaterial);
  picker.userData.freeMoveHandle = true;
  root.add(square, picker);
  return root;
};

const createProfileLengthHandles = () => {
  const root = new THREE.Group();
  root.name = 'profile-length-handles';
  root.visible = false;

  ([-1, 1] as const).forEach((side) => {
    const handle = new THREE.Group();
    handle.userData.lengthHandleSide = side;

    const blackMaterial = new THREE.MeshBasicMaterial({
      color: '#111827',
      depthTest: false,
      transparent: true,
      opacity: 0.96,
    });
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.035), blackMaterial);
    stem.position.x = side * 0.21;
    stem.renderOrder = 120;

    const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.095, 0.19, 16), blackMaterial.clone());
    arrow.position.x = side * 0.48;
    arrow.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    arrow.renderOrder = 120;

    const pickerMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    pickerMaterial.colorWrite = false;
    const picker = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.28, 0.28), pickerMaterial);
    picker.position.x = side * 0.3;
    picker.userData.lengthHandleSide = side;
    handle.add(stem, arrow, picker);
    root.add(handle);
  });
  return root;
};

const syncProfileLengthHandles = (
  handles: THREE.Group,
  profileGroup: THREE.Group | undefined,
  item: DIYSceneItem | undefined,
  lengthOverride?: number,
  positionOverride?: THREE.Vector3,
) => {
  if (!profileGroup || !item || item.kind !== 'profile') {
    handles.visible = false;
    return;
  }
  const length = lengthOverride ?? profileDimensions(item).length;
  handles.visible = true;
  handles.position.copy(positionOverride || profileGroup.position);
  handles.quaternion.copy(profileGroup.quaternion);
  handles.children.forEach((handle) => {
    const side = handle.userData.lengthHandleSide as -1 | 1;
    handle.position.set(side * length / 2, 0, 0);
  });
};

const syncFreeMoveHandle = (
  handle: THREE.Group,
  selectedGroup: THREE.Group | undefined,
  selectedItem: DIYSceneItem | undefined,
) => {
  if (!selectedGroup || !selectedItem) {
    handle.visible = false;
    return;
  }
  handle.visible = true;
  handle.position.copy(selectedGroup.position);
  handle.quaternion.copy(selectedGroup.quaternion);
};

const ThreeAssembly: React.FC<{
  items: DIYSceneItem[];
  selectedId: string | null;
  rotationLabels: [string, string, string];
  snapLabels: { end: string; side: string; offset: string; collision: string };
  deleteLabel: string;
  onSelect: (id: string | null) => void;
  onTransform: (id: string, position: Vec3, rotation: Vec3) => void;
  onResizeProfile: (id: string, length: number, position: Vec3) => void;
  onRotate90: (id: string, axisIndex: RotationAxisIndex) => void;
  onDelete: (id: string) => void;
}> = ({
  items,
  selectedId,
  rotationLabels,
  snapLabels,
  deleteLabel,
  onSelect,
  onTransform,
  onResizeProfile,
  onRotate90,
  onDelete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [snapHint, setSnapHint] = useState<string | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const transformRef = useRef<TransformControls | null>(null);
  const lengthHandlesRef = useRef<THREE.Group | null>(null);
  const freeMoveHandleRef = useRef<THREE.Group | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const groupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const lastFrameSignatureRef = useRef('');
  const itemsRef = useRef(items);
  const onSelectRef = useRef(onSelect);
  const onTransformRef = useRef(onTransform);
  const onResizeProfileRef = useRef(onResizeProfile);
  const onRotate90Ref = useRef(onRotate90);
  const onDeleteRef = useRef(onDelete);
  const snapLabelsRef = useRef(snapLabels);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { onTransformRef.current = onTransform; }, [onTransform]);
  useEffect(() => { onResizeProfileRef.current = onResizeProfile; }, [onResizeProfile]);
  useEffect(() => { onRotate90Ref.current = onRotate90; }, [onRotate90]);
  useEffect(() => { onDeleteRef.current = onDelete; }, [onDelete]);
  useEffect(() => { snapLabelsRef.current = snapLabels; }, [snapLabels]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eef3f8');
    scene.fog = new THREE.Fog('#eef3f8', 28, 60);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 200);
    camera.position.set(14, 11, 16);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      setRenderError(null);
    } catch (error) {
      console.error('Unable to initialize the 3D designer', error);
      setRenderError('3D rendering is unavailable on this device. Please enable WebGL or try a newer browser.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    const orbit = new OrbitControls(camera, renderer.domElement);
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.target.set(0, 4, 0);
    orbit.maxDistance = 55;
    orbit.minDistance = 4;

    const transform = new TransformControls(camera, renderer.domElement);
    transform.setMode('translate');
    transform.setSize(0.78);
    const helper = transform.getHelper();
    scene.add(helper);
    customizeTranslateGizmo(transform);
    const lengthHandles = createProfileLengthHandles();
    scene.add(lengthHandles);
    const freeMoveHandle = createFreeMoveHandle();
    scene.add(freeMoveHandle);
    const snapGuide = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.028, 10, 40),
      new THREE.MeshBasicMaterial({ color: '#0ea5e9', transparent: true, opacity: 0.95, depthTest: false }),
    );
    snapGuide.visible = false;
    snapGuide.renderOrder = 100;
    scene.add(snapGuide);
    let transformWasDragging = false;
    let lastSafeProfilePosition: THREE.Vector3 | null = null;
    let snapHintTimer = 0;
    const onDraggingChanged = (event: { value: unknown }) => {
      orbit.enabled = !event.value;
      if (event.value) {
        transformWasDragging = true;
        const object = transform.object as THREE.Group | undefined;
        lastSafeProfilePosition = object?.position.clone() || null;
      } else {
        lastSafeProfilePosition = null;
      }
    };
    const onObjectChange = () => {
      const object = transform.object as THREE.Group | undefined;
      const itemId = object?.userData.itemId as string | undefined;
      const item = itemId ? itemsRef.current.find((entry) => entry.id === itemId) : undefined;
      if (!object || !item || item.kind !== 'profile') {
        snapGuide.visible = false;
        return;
      }
      const snap = findMagneticProfileSnap(object, item, itemsRef.current, groupsRef.current);
      if (snap) {
        object.position.copy(snap.position);
        syncProfileLengthHandles(lengthHandles, object, item);
        syncFreeMoveHandle(freeMoveHandle, object, item);
        if (lastSafeProfilePosition) lastSafeProfilePosition.copy(snap.position);
        else lastSafeProfilePosition = snap.position.clone();
        snapGuide.position.copy(snap.point);
        snapGuide.quaternion.copy(camera.quaternion);
        snapGuide.visible = true;
        setSnapHint(snapLabelsRef.current[snap.label]);
        return;
      }
      if (profileCollides(object, item, object.position, itemsRef.current, groupsRef.current)) {
        if (lastSafeProfilePosition) object.position.copy(lastSafeProfilePosition);
        syncProfileLengthHandles(lengthHandles, object, item);
        syncFreeMoveHandle(freeMoveHandle, object, item);
        snapGuide.visible = false;
        setSnapHint(snapLabelsRef.current.collision);
        return;
      }
      lastSafeProfilePosition = object.position.clone();
      syncProfileLengthHandles(lengthHandles, object, item);
      syncFreeMoveHandle(freeMoveHandle, object, item);
      snapGuide.visible = false;
      setSnapHint(null);
    };
    const onTransformMouseUp = () => {
      const object = transform.object;
      const itemId = object?.userData.itemId as string | undefined;
      if (!object || !itemId) return;
      onTransformRef.current(
        itemId,
        [Math.round(object.position.x * SCENE_SCALE), Math.round(object.position.y * SCENE_SCALE), Math.round(object.position.z * SCENE_SCALE)],
        [
          Math.round(THREE.MathUtils.radToDeg(object.rotation.x)),
          Math.round(THREE.MathUtils.radToDeg(object.rotation.y)),
          Math.round(THREE.MathUtils.radToDeg(object.rotation.z)),
        ],
      );
      snapGuide.visible = false;
      window.clearTimeout(snapHintTimer);
      snapHintTimer = window.setTimeout(() => setSnapHint(null), 1000);
    };
    transform.addEventListener('dragging-changed', onDraggingChanged);
    transform.addEventListener('objectChange', onObjectChange);
    transform.addEventListener('mouseUp', onTransformMouseUp);

    scene.add(new THREE.HemisphereLight('#ffffff', '#728196', 2.1));
    const keyLight = new THREE.DirectionalLight('#ffffff', 3.4);
    keyLight.position.set(8, 16, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight('#8bb8ff', 1.2);
    fillLight.position.set(-10, 7, -8);
    scene.add(fillLight);
    const grid = new THREE.GridHelper(40, 40, '#8fa2b5', '#c8d2dd');
    grid.position.y = -0.01;
    scene.add(grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.ShadowMaterial({ color: '#314158', opacity: 0.12 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const content = new THREE.Group();
    scene.add(content);

    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const resizePlane = new THREE.Plane();
    const movePlane = new THREE.Plane();
    type LengthResizeState = {
      item: DIYSceneItem;
      object: THREE.Group;
      pointerId: number;
      side: -1 | 1;
      startPoint: THREE.Vector3;
      startLength: number;
      axis: THREE.Vector3;
      fixedEnd: THREE.Vector3;
      validLength: number;
      validPosition: THREE.Vector3;
    };
    let lengthResizeState: LengthResizeState | null = null;
    type FreeMoveState = {
      item: DIYSceneItem;
      object: THREE.Group;
      pointerId: number;
      startPoint: THREE.Vector3;
      startPosition: THREE.Vector3;
      validPosition: THREE.Vector3;
    };
    let freeMoveState: FreeMoveState | null = null;
    let pointerStart: { x: number; y: number; button: number } | null = null;
    let rightPointerMoved = false;
    const setPointerRay = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };
    const getHitItemId = (clientX: number, clientY: number) => {
      setPointerRay(clientX, clientY);
      const hit = raycaster.intersectObjects(content.children, true)[0];
      if (!hit) return null;
      let current: THREE.Object3D | null = hit.object;
      while (current && !current.userData.itemId) current = current.parent;
      return (current?.userData.itemId as string) || null;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 0 && freeMoveHandle.visible) {
        setPointerRay(event.clientX, event.clientY);
        const moveHit = raycaster.intersectObjects(freeMoveHandle.children, true)[0];
        const object = transform.object as THREE.Group | undefined;
        const itemId = object?.userData.itemId as string | undefined;
        const item = itemId ? itemsRef.current.find((entry) => entry.id === itemId) : undefined;
        if (moveHit && object && item) {
          const cameraDirection = camera.getWorldDirection(new THREE.Vector3()).normalize();
          movePlane.setFromNormalAndCoplanarPoint(cameraDirection, moveHit.point);
          const startPoint = raycaster.ray.intersectPlane(movePlane, new THREE.Vector3());
          if (startPoint) {
            freeMoveState = {
              item,
              object,
              pointerId: event.pointerId,
              startPoint,
              startPosition: object.position.clone(),
              validPosition: object.position.clone(),
            };
            orbit.enabled = false;
            transform.enabled = false;
            renderer.domElement.setPointerCapture?.(event.pointerId);
            pointerStart = null;
            event.preventDefault();
            event.stopPropagation();
            return;
          }
        }
      }
      if (event.button === 0 && lengthHandles.visible) {
        setPointerRay(event.clientX, event.clientY);
        const handleHit = raycaster.intersectObjects(lengthHandles.children, true)[0];
        if (handleHit) {
          let handleObject: THREE.Object3D | null = handleHit.object;
          while (handleObject && handleObject.userData.lengthHandleSide === undefined) handleObject = handleObject.parent;
          const side = handleObject?.userData.lengthHandleSide as -1 | 1 | undefined;
          const object = transform.object as THREE.Group | undefined;
          const itemId = object?.userData.itemId as string | undefined;
          const item = itemId ? itemsRef.current.find((entry) => entry.id === itemId) : undefined;
          if (side && object && item?.kind === 'profile') {
            const startLength = profileDimensions(item).length;
            const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(object.quaternion).normalize();
            const cameraDirection = camera.getWorldDirection(new THREE.Vector3()).normalize();
            resizePlane.setFromNormalAndCoplanarPoint(cameraDirection, handleHit.point);
            const startPoint = raycaster.ray.intersectPlane(resizePlane, new THREE.Vector3());
            if (startPoint) {
              const fixedEnd = object.position.clone().addScaledVector(axis, -side * startLength / 2);
              lengthResizeState = {
                item,
                object,
                pointerId: event.pointerId,
                side,
                startPoint,
                startLength,
                axis,
                fixedEnd,
                validLength: startLength,
                validPosition: object.position.clone(),
              };
              orbit.enabled = false;
              transform.enabled = false;
              renderer.domElement.setPointerCapture?.(event.pointerId);
              pointerStart = null;
              event.preventDefault();
              event.stopPropagation();
              return;
            }
          }
        }
      }
      pointerStart = { x: event.clientX, y: event.clientY, button: event.button };
      if (event.button === 2) rightPointerMoved = false;
      else setContextMenu(null);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (freeMoveState) {
        const state = freeMoveState;
        setPointerRay(event.clientX, event.clientY);
        const currentPoint = raycaster.ray.intersectPlane(movePlane, new THREE.Vector3());
        if (!currentPoint) return;
        const nextPosition = state.startPosition.clone().add(currentPoint.sub(state.startPoint));
        state.object.position.copy(nextPosition);
        if (state.item.kind === 'profile') {
          const snap = findMagneticProfileSnap(state.object, state.item, itemsRef.current, groupsRef.current);
          if (snap) {
            nextPosition.copy(snap.position);
            state.object.position.copy(nextPosition);
            setSnapHint(snapLabelsRef.current[snap.label]);
          } else if (profileCollides(state.object, state.item, nextPosition, itemsRef.current, groupsRef.current)) {
            state.object.position.copy(state.validPosition);
            syncProfileLengthHandles(lengthHandles, state.object, state.item);
            syncFreeMoveHandle(freeMoveHandle, state.object, state.item);
            setSnapHint(snapLabelsRef.current.collision);
            return;
          } else {
            setSnapHint(null);
          }
        }
        state.validPosition.copy(nextPosition);
        syncProfileLengthHandles(lengthHandles, state.object, state.item);
        syncFreeMoveHandle(freeMoveHandle, state.object, state.item);
        event.preventDefault();
        return;
      }
      const state = lengthResizeState;
      if (!state) return;
      setPointerRay(event.clientX, event.clientY);
      const currentPoint = raycaster.ray.intersectPlane(resizePlane, new THREE.Vector3());
      if (!currentPoint) return;
      const delta = currentPoint.clone().sub(state.startPoint).dot(state.axis);
      const nextLength = THREE.MathUtils.clamp(state.startLength + state.side * delta, 0.21, 30);
      const nextPosition = state.fixedEnd.clone().addScaledVector(state.axis, state.side * nextLength / 2);
      const candidate: DIYSceneItem = {
        ...state.item,
        length: Math.round(nextLength * SCENE_SCALE),
        position: [
          Math.round(nextPosition.x * SCENE_SCALE),
          Math.round(nextPosition.y * SCENE_SCALE),
          Math.round(nextPosition.z * SCENE_SCALE),
        ],
      };
      if (profileItemCollides(candidate, itemsRef.current)) {
        setSnapHint(snapLabelsRef.current.collision);
        return;
      }
      state.validLength = nextLength;
      state.validPosition.copy(nextPosition);
      state.object.position.copy(nextPosition);
      state.object.scale.set(nextLength / state.startLength, 1, 1);
      syncProfileLengthHandles(lengthHandles, state.object, state.item, nextLength, nextPosition);
      setSnapHint(null);
      event.preventDefault();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (freeMoveState) {
        const state = freeMoveState;
        freeMoveState = null;
        state.object.position.copy(state.validPosition);
        transform.enabled = true;
        orbit.enabled = true;
        if (renderer.domElement.hasPointerCapture?.(state.pointerId)) {
          renderer.domElement.releasePointerCapture?.(state.pointerId);
        }
        onTransformRef.current(
          state.item.id,
          [
            Math.round(state.validPosition.x * SCENE_SCALE),
            Math.round(state.validPosition.y * SCENE_SCALE),
            Math.round(state.validPosition.z * SCENE_SCALE),
          ],
          state.item.rotation,
        );
        transformWasDragging = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (lengthResizeState) {
        const state = lengthResizeState;
        lengthResizeState = null;
        state.object.scale.set(1, 1, 1);
        state.object.position.copy(state.validPosition);
        transform.enabled = true;
        orbit.enabled = true;
        if (renderer.domElement.hasPointerCapture?.(state.pointerId)) {
          renderer.domElement.releasePointerCapture?.(state.pointerId);
        }
        onResizeProfileRef.current(
          state.item.id,
          Math.round(state.validLength * SCENE_SCALE),
          [
            Math.round(state.validPosition.x * SCENE_SCALE),
            Math.round(state.validPosition.y * SCENE_SCALE),
            Math.round(state.validPosition.z * SCENE_SCALE),
          ],
        );
        transformWasDragging = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const start = pointerStart;
      pointerStart = null;
      if (!start) return;
      const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (start.button === 2) {
        rightPointerMoved = distance > 7;
        return;
      }
      if (transformWasDragging) {
        transformWasDragging = false;
        return;
      }
      if (distance > 7) return;
      onSelectRef.current(getHitItemId(event.clientX, event.clientY));
    };
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (rightPointerMoved) {
        rightPointerMoved = false;
        return;
      }
      const itemId = getHitItemId(event.clientX, event.clientY);
      if (!itemId) {
        setContextMenu(null);
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      onSelectRef.current(itemId);
      setContextMenu({
        id: itemId,
        x: THREE.MathUtils.clamp(event.clientX - rect.left, 8, Math.max(8, rect.width - 154)),
        y: THREE.MathUtils.clamp(event.clientY - rect.top, 8, Math.max(8, rect.height - 174)),
      });
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerUp);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      if (width < 2 || height < 2) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(mount);
    if (!resizeObserver) window.addEventListener('resize', resize);
    resize();

    let animationFrame = 0;
    const animate = () => {
      orbit.update();
      if (freeMoveHandle.visible) {
        const helperDistance = camera.position.distanceTo(freeMoveHandle.position);
        freeMoveHandle.scale.setScalar(THREE.MathUtils.clamp(helperDistance * 0.1, 0.55, 2));
      }
      if (lengthHandles.visible) {
        const helperDistance = camera.position.distanceTo(lengthHandles.position);
        const helperScale = THREE.MathUtils.clamp(helperDistance * 0.075, 0.34, 1.35);
        lengthHandles.children.forEach((handle) => handle.scale.setScalar(helperScale));
      }
      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };
    animate();

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    orbitRef.current = orbit;
    transformRef.current = transform;
    lengthHandlesRef.current = lengthHandles;
    freeMoveHandleRef.current = freeMoveHandle;
    contentRef.current = content;

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerUp);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
      transform.removeEventListener('dragging-changed', onDraggingChanged);
      transform.removeEventListener('objectChange', onObjectChange);
      transform.removeEventListener('mouseUp', onTransformMouseUp);
      window.clearTimeout(snapHintTimer);
      transform.detach();
      transform.dispose();
      disposeObject(lengthHandles);
      scene.remove(lengthHandles);
      disposeObject(freeMoveHandle);
      scene.remove(freeMoveHandle);
      snapGuide.geometry.dispose();
      (snapGuide.material as THREE.Material).dispose();
      orbit.dispose();
      disposeObject(content);
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      orbitRef.current = null;
      transformRef.current = null;
      lengthHandlesRef.current = null;
      freeMoveHandleRef.current = null;
      contentRef.current = null;
      groupsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    const transform = transformRef.current;
    const lengthHandles = lengthHandlesRef.current;
    const freeMoveHandle = freeMoveHandleRef.current;
    if (!content || !transform || !lengthHandles || !freeMoveHandle) return;
    transform.detach();
    lengthHandles.visible = false;
    freeMoveHandle.visible = false;
    content.children.slice().forEach((child) => {
      content.remove(child);
      disposeObject(child);
    });
    const groups = new Map<string, THREE.Group>();
    items.forEach((item) => {
      const group = item.kind === 'profile'
        ? createProfileObject(item, item.id === selectedId)
        : item.kind === 'plate' || item.kind === 'pegboard' || item.kind === 'marine_board'
          ? createBoardObject(item, item.id === selectedId)
          : createAccessoryObject(item, item.id === selectedId);
      group.userData.itemId = item.id;
      group.traverse((child) => {
        child.userData.itemId = item.id;
      });
      group.position.set(item.position[0] / SCENE_SCALE, item.position[1] / SCENE_SCALE, item.position[2] / SCENE_SCALE);
      group.rotation.set(
        THREE.MathUtils.degToRad(item.rotation[0]),
        THREE.MathUtils.degToRad(item.rotation[1]),
        THREE.MathUtils.degToRad(item.rotation[2]),
      );
      content.add(group);
      groups.set(item.id, group);
    });
    groupsRef.current = groups;
    const selected = selectedId ? groups.get(selectedId) : undefined;
    if (selected) transform.attach(selected);
    const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : undefined;
    syncProfileLengthHandles(lengthHandles, selected, selectedItem);
    syncFreeMoveHandle(freeMoveHandle, selected, selectedItem);

    const frameSignature = items.map((item) => [
      item.id,
      item.kind,
      item.variantId,
      item.length,
      item.width,
      item.height,
      item.thickness,
      item.rotation.join(','),
    ].join(':')).join('|');
    if (items.length > 0 && frameSignature !== lastFrameSignatureRef.current) {
      const camera = cameraRef.current;
      const orbit = orbitRef.current;
      if (camera && orbit) {
        const bounds = new THREE.Box3().setFromObject(content);
        const sphere = bounds.getBoundingSphere(new THREE.Sphere());
        if (Number.isFinite(sphere.radius) && sphere.radius > 0) {
          const direction = camera.position.clone().sub(orbit.target);
          if (direction.lengthSq() < 0.001) direction.set(1, 0.75, 1);
          direction.normalize();
          const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
          const distance = Math.max(4, (sphere.radius / Math.sin(halfFov)) * 1.25);
          orbit.target.copy(sphere.center);
          camera.position.copy(sphere.center).add(direction.multiplyScalar(distance));
          camera.near = Math.max(0.02, distance / 100);
          camera.far = Math.max(200, distance * 20);
          camera.updateProjectionMatrix();
          orbit.update();
        }
      }
    }
    lastFrameSignatureRef.current = frameSignature;
  }, [items, selectedId]);

  return (
    <div className="relative h-[52vh] min-h-[380px] max-h-[620px] w-full sm:h-[62vh] xl:h-[calc(100vh-220px)] xl:min-h-[590px] xl:max-h-none">
      <div ref={mountRef} className="absolute inset-0 overflow-hidden" data-testid="diy-3d-canvas" />
      {contextMenu && (
        <div
          className="absolute z-30 w-36 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="px-2 pb-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">+90°</div>
          {rotationLabels.map((label, axisIndex) => (
            <button
              key={label}
              onClick={() => {
                onRotate90Ref.current(contextMenu.id, axisIndex as RotationAxisIndex);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
            >
              <Rotate3D className="h-3.5 w-3.5" />{label}
            </button>
          ))}
          <div className="my-1 border-t border-slate-100" />
          <button
            onClick={() => {
              onDeleteRef.current(contextMenu.id);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[11px] font-black text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />{deleteLabel}
          </button>
        </div>
      )}
      {snapHint && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full bg-sky-500 px-4 py-2 text-[11px] font-black text-white shadow-xl shadow-sky-500/30">
          {snapHint}
        </div>
      )}
      {renderError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-100 p-8 text-center">
          <div className="max-w-sm rounded-2xl border border-red-200 bg-white p-6 text-sm font-bold text-red-700 shadow-xl">{renderError}</div>
        </div>
      )}
    </div>
  );
};

const getItemLabel = (item: DIYSceneItem, language: Language) => {
  const t = TEXT[language];
  if (item.kind === 'profile') return `${item.variantId || '2020'} · ${item.length || 0}mm`;
  if (item.kind === 'plate') return `${t.plate} · ${item.width}×${item.height}`;
  if (item.kind === 'pegboard') return `${t.pegboard} · ${item.width}×${item.height}`;
  if (item.kind === 'marine_board') return `${t.marine} · ${item.width}×${item.height}`;
  return item.kind === 'connector' ? t.connector : t.foot;
};

const profileFinishForColor = (colorId: string) => (colorId === 'natural' || colorId === 'silver' ? 'oxidized' : 'powder');

const calculatePrice = (item: DIYSceneItem, user?: User | null) => {
  const quantity = Math.max(1, item.quantity || 1);
  if (item.kind === 'profile') {
    const variant = PROFILE_VARIANTS.find((entry) => entry.id === item.variantId) || PROFILE_VARIANTS[0];
    const membership = normalizeMembershipLevel(user?.membershipLevel);
    const discount = membership === 'vip_plus' ? 4 : membership === 'vip' ? 2 : 0;
    const material = ((item.length || 1000) / 1000) * Math.max(0, variant.price[profileFinishForColor(item.colorId)] - discount);
    const holes = (item.holes || []).reduce((sum, hole) => sum + (hole.type === 'through' ? 1 : 1.8), 0);
    const tapping = (item.tappingLeft ? 1.5 : 0) + (item.tappingRight ? 1.5 : 0);
    const danger = (item.length || 0) > 20 && (item.length || 0) <= 100 ? 5 : 0;
    return Number(((material + holes + tapping + danger) * quantity).toFixed(1));
  }
  if (item.kind === 'plate' || item.kind === 'pegboard' || item.kind === 'marine_board') {
    const area = Math.max(MIN_BOARD_AREA, ((item.width || 0) * (item.height || 0)) / 1_000_000);
    const thickness = item.thickness || (item.kind === 'marine_board' ? 18 : 2);
    const rate = item.kind === 'plate'
      ? (ALUMINUM_PLATE_PRICE[thickness] || 0)
      : item.kind === 'pegboard'
        ? (PEGBOARD_PRICE[thickness] || 0)
        : (MARINE_BOARD_PRICE[thickness] || 0) + (item.colorId === 'natural' ? 0 : MARINE_COLOR_SURCHARGE);
    return Number((area * rate * quantity).toFixed(1));
  }
  return Number(((item.accessoryPrice || 0) * quantity).toFixed(1));
};

const NumberField: React.FC<{ label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }> = ({ label, value, min, max, step = 1, onChange }) => (
  <label className="block">
    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{label}</span>
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value) || 0)}
      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
    />
  </label>
);

const DIYDesigner: React.FC<DIYDesignerProps> = ({ language, user, onAddBatchToCart }) => {
  const t = TEXT[language];
  const navigate = useNavigate();
  const [items, setItems] = useState<DIYSceneItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<DIYSceneItem[][]>([]);
  const [future, setFuture] = useState<DIYSceneItem[][]>([]);
  const [notice, setNotice] = useState('');
  const [holePosition, setHolePosition] = useState(100);
  const [holeSide, setHoleSide] = useState<ProfileSide>('A');
  const [holeType, setHoleType] = useState<HoleType>('through');
  const [threadSize, setThreadSize] = useState<ThreadSize>('M6');
  const importRef = useRef<HTMLInputElement>(null);

  const selected = items.find((item) => item.id === selectedId) || null;
  const total = useMemo(() => items.reduce((sum, item) => sum + calculatePrice(item, user), 0), [items, user]);
  const currency = language === 'cn' ? '￥' : '$';

  const commit = (next: DIYSceneItem[], selection = selectedId) => {
    setHistory((current) => [...current.slice(-39), cloneItems(items)]);
    setFuture([]);
    setItems(next);
    setSelectedId(selection && next.some((item) => item.id === selection) ? selection : null);
  };

  const updateSelected = (patch: Partial<DIYSceneItem>) => {
    if (!selected) return;
    const candidate = { ...selected, ...patch };
    if (profileItemCollides(candidate, items)) {
      showNotice(t.snapCollision);
      return;
    }
    commit(items.map((item) => item.id === selected.id ? candidate : item), selected.id);
  };

  const rotateItemBy90 = (itemId: string, axisIndex: RotationAxisIndex) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    const rotation = [...item.rotation] as Vec3;
    rotation[axisIndex] = ((rotation[axisIndex] + 90) % 360 + 360) % 360;
    const candidate = { ...item, rotation };
    if (profileItemCollides(candidate, items)) {
      showNotice(t.snapCollision);
      return;
    }
    commit(items.map((entry) => entry.id === itemId ? candidate : entry), itemId);
  };

  const rotateSelectedBy90 = (axisIndex: RotationAxisIndex) => {
    if (!selected) return;
    rotateItemBy90(selected.id, axisIndex);
  };

  const deleteItem = (itemId: string) => {
    commit(items.filter((item) => item.id !== itemId), null);
  };

  useEffect(() => {
    const handleDeleteShortcut = (event: KeyboardEvent) => {
      if (!selectedId || (event.key !== 'Delete' && event.key !== 'Backspace')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const isEditing = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (isEditing) return;
      event.preventDefault();
      deleteItem(selectedId);
    };
    window.addEventListener('keydown', handleDeleteShortcut);
    return () => window.removeEventListener('keydown', handleDeleteShortcut);
  }, [items, selectedId]);

  const addItem = (kind: DIYItemKind, variantId?: string) => {
    const item = createItem(kind, items.length, variantId);
    commit([...items, item], item.id);
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture((current) => [cloneItems(items), ...current.slice(0, 39)]);
    setItems(cloneItems(previous));
    setHistory((current) => current.slice(0, -1));
    setSelectedId(null);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((current) => [...current, cloneItems(items)]);
    setItems(cloneItems(next));
    setFuture((current) => current.slice(1));
    setSelectedId(null);
  };

  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, items }));
    showNotice(t.saved);
  };

  const load = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.items)) {
        commit(parsed.items, null);
        showNotice(t.loaded);
      }
    } catch (error) {
      console.warn('Unable to load DIY design', error);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mengkaile-diy-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(parsed.items)) commit(parsed.items, null);
      } catch (error) {
        console.warn('Unable to import DIY design', error);
      }
    };
    reader.readAsText(file);
  };

  const toCartItems = (): CartItem[] => {
    const profileProduct = INITIAL_PRODUCTS.find((product) => product.type === ProductType.PROFILE)!;
    const plateProduct = INITIAL_PRODUCTS.find((product) => product.type === ProductType.ALUMINUM_PLATE)!;
    const pegboardProduct = INITIAL_PRODUCTS.find((product) => product.type === ProductType.PEGBOARD)!;
    const marineProduct = INITIAL_PRODUCTS.find((product) => product.type === ProductType.MARINE_BOARD)!;
    const accessoryProduct: Product = {
      id: 'accessory',
      type: ProductType.ACCESSORY,
      name: { en: 'Aluminum Profile Accessories', cn: '铝型材配件', jp: 'アルミプロファイルアクセサリー' },
      description: { en: 'Hardware selected in the 3D DIY designer.', cn: '3D DIY设计器中选择的连接配件。', jp: '3D DIYデザイナーで選択した金具。' },
      basePrice: 0,
      imageUrl: '/images/accessory/accessory_codes.jpg',
    };
    return items.map((item) => {
      const totalPrice = calculatePrice(item, user);
      if (item.kind === 'profile') {
        const config = {
          length: item.length || 1000,
          variantId: item.variantId || '2020',
          finish: profileFinishForColor(item.colorId),
          colorId: item.colorId,
          holes: item.holes || [],
          tapping: { left: [!!item.tappingLeft], right: [!!item.tappingRight] },
          unitPrice: Number((totalPrice / Math.max(1, item.quantity)).toFixed(1)),
          remark: [item.remark?.trim(), `3D DIY position ${item.position.join(',')}mm; rotation ${item.rotation.join(',')}deg`].filter(Boolean).join('；'),
        };
        return { id: makeId(), product: profileProduct, quantity: item.quantity, config, totalPrice };
      }
      if (item.kind === 'plate' || item.kind === 'pegboard' || item.kind === 'marine_board') {
        const product = item.kind === 'plate' ? plateProduct : item.kind === 'pegboard' ? pegboardProduct : marineProduct;
        const areaSqm = ((item.width || 0) * (item.height || 0)) / 1_000_000;
        const chargedArea = areaSqm > 0 && areaSqm < MIN_BOARD_AREA ? MIN_BOARD_AREA : areaSqm;
        const thickness = item.thickness || (item.kind === 'marine_board' ? 18 : 2);
        const unitRate = item.kind === 'plate'
          ? (ALUMINUM_PLATE_PRICE[thickness] || 0)
          : item.kind === 'pegboard'
            ? (PEGBOARD_PRICE[thickness] || 0)
            : (MARINE_BOARD_PRICE[thickness] || 0) + (item.colorId === 'natural' ? 0 : MARINE_COLOR_SURCHARGE);
        const config = {
          width: item.width,
          height: item.height,
          thickness,
          colorId: item.colorId,
          colorName: PROFILE_COLORS.find((color) => color.id === item.colorId)?.name[language] || item.colorId,
          marineSpecId: item.kind === 'marine_board' ? 'marine_bbb_uv_film' : undefined,
          unitPrice: Number((totalPrice / Math.max(1, item.quantity)).toFixed(1)),
          areaSqm,
          chargedArea,
          unitRate,
          minAreaApplied: areaSqm > 0 && areaSqm < MIN_BOARD_AREA,
          diyPosition: item.position,
          diyRotation: item.rotation,
          remark: item.remark?.trim() || undefined,
        };
        return { id: makeId(), product, quantity: item.quantity, config, totalPrice };
      }
      const accessoryId = item.kind === 'connector' ? 'diy-corner-bracket' : 'diy-leveling-foot';
      const unitPrice = item.accessoryPrice || 0;
      return {
        id: makeId(),
        product: accessoryProduct,
        quantity: 1,
        config: {
          type: 'profile_accessory',
          profileSize: '2020',
          colorMode: item.colorId === 'natural' || item.colorId === 'silver' ? 'natural' : 'colored',
          colorId: item.colorId,
          colorName: PROFILE_COLORS.find((color) => color.id === item.colorId)?.name[language] || item.colorId,
          quantities: { [accessoryId]: item.quantity },
          totalQuantity: item.quantity,
          unitTotal: totalPrice,
          lines: [{
            id: accessoryId,
            code: item.kind === 'connector' ? 1 : 8,
            name: item.kind === 'connector' ? t.connector : t.foot,
            imageKey: item.kind === 'connector' ? '1' : '8',
            quantity: item.quantity,
            unitPrice,
            subtotal: totalPrice,
            isBulk: false,
          }],
          diyPosition: item.position,
          diyRotation: item.rotation,
          remark: item.remark?.trim() || undefined,
        },
        totalPrice,
      };
    });
  };

  const addDesignToCart = () => {
    if (!items.length) return;
    onAddBatchToCart(toCartItems());
    showNotice(t.cartAdded);
    window.setTimeout(() => navigate('/cart'), 450);
  };

  const addHole = () => {
    if (!selected || selected.kind !== 'profile') return;
    const length = selected.length || 1000;
    if (holePosition < 5 || holePosition > length - 5) return;
    const hole: DrillHole = {
      id: makeId(),
      positionMm: holePosition,
      side: holeSide,
      type: holeType,
      threadSize: holeType === 'threaded' ? threadSize : undefined,
    };
    updateSelected({ holes: [...(selected.holes || []), hole] });
  };

  const palette = [
    { kind: 'profile' as const, variantId: '2020', label: t.profile2020, icon: Box },
    { kind: 'profile' as const, variantId: '2040', label: t.profile2040, icon: Box },
    { kind: 'plate' as const, label: t.plate, icon: PanelTop },
    { kind: 'pegboard' as const, label: t.pegboard, icon: Grid3X3 },
    { kind: 'marine_board' as const, label: t.marine, icon: PanelTop },
    { kind: 'connector' as const, label: t.connector, icon: Wrench },
    { kind: 'foot' as const, label: t.foot, icon: CircleDot },
  ];

  return (
    <div className="min-h-[calc(100vh-88px)] bg-slate-100">
      <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{t.title}</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">{t.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={undo} disabled={!history.length} className="diy-toolbar-button" aria-label="Undo"><Undo2 className="h-4 w-4" /></button>
            <button onClick={redo} disabled={!future.length} className="diy-toolbar-button" aria-label="Redo"><Redo2 className="h-4 w-4" /></button>
            <button className="diy-toolbar-button diy-toolbar-active gap-2"><Move3D className="h-4 w-4" />{t.move}</button>
            <button onClick={save} className="diy-toolbar-button gap-2"><Save className="h-4 w-4" />{t.save}</button>
            <button onClick={load} className="diy-toolbar-button gap-2"><Upload className="h-4 w-4" />{t.load}</button>
            <button onClick={exportJson} className="diy-toolbar-button gap-2"><Download className="h-4 w-4" />{t.export}</button>
            <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(event) => importJson(event.target.files?.[0])} />
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1800px] grid-cols-1 gap-3 p-3 xl:grid-cols-[260px_minmax(0,1fr)_330px]">
        <aside className="order-1 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">{t.library}</h2>
            <Hammer className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-400">{t.dragHint}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-1">
            {palette.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={`${entry.kind}-${entry.variantId || ''}`}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData('application/x-mengkaile-part', JSON.stringify({ kind: entry.kind, variantId: entry.variantId }))}
                  onClick={() => addItem(entry.kind, entry.variantId)}
                  className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-400 hover:bg-blue-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm group-hover:text-blue-600"><Icon className="h-5 w-5" /></span>
                  <span className="text-xs font-black text-slate-700">{entry.label}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => commit(buildDemoWorkbench(), null)} className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-600">
            {t.addDemo}
          </button>

        </aside>

        <main
          className="order-2 relative overflow-hidden rounded-3xl border border-slate-200 bg-[#eef3f8] shadow-sm"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            try {
              const part = JSON.parse(event.dataTransfer.getData('application/x-mengkaile-part'));
              addItem(part.kind, part.variantId);
            } catch {
              // Ignore unrelated drops.
            }
          }}
        >
          <ThreeAssembly
            items={items}
            selectedId={selectedId}
            rotationLabels={[t.rotateX, t.rotateY, t.rotateZ]}
            snapLabels={{ end: t.snapEnd, side: t.snapSide, offset: t.snapOffset, collision: t.snapCollision }}
            deleteLabel={t.delete}
            onSelect={setSelectedId}
            onTransform={(id, position, rotation) => {
              const transformed = items.find((item) => item.id === id);
              if (!transformed) return;
              const candidate = { ...transformed, position, rotation };
              if (profileItemCollides(candidate, items)) {
                showNotice(t.snapCollision);
                return;
              }
              const next = items.map((item) => item.id === id ? candidate : item);
              commit(next, id);
            }}
            onResizeProfile={(id, length, position) => {
              const resized = items.find((item) => item.id === id);
              if (!resized || resized.kind !== 'profile') return;
              const candidate = {
                ...resized,
                length: Math.min(3000, Math.max(21, length)),
                position,
                holes: (resized.holes || []).filter((hole) => hole.positionMm <= length - 5),
              };
              if (profileItemCollides(candidate, items)) {
                showNotice(t.snapCollision);
                return;
              }
              commit(items.map((item) => item.id === id ? candidate : item), id);
            }}
            onRotate90={rotateItemBy90}
            onDelete={deleteItem}
          />
          <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-lg backdrop-blur">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.total}</div>
            <div className="text-2xl font-black text-slate-900">{currency}{total.toFixed(1)}</div>
            <div className="text-[11px] font-bold text-slate-400">{items.length} parts</div>
          </div>
          {notice && <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-2xl">{notice}</div>}
        </main>

        <aside className="order-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          {!selected ? (
            <>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">{t.projectSummary}</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-slate-100 p-3">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.project}</div>
                  <div className="mt-1 text-xl font-black text-slate-900">{items.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-950 p-3 text-white">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.total}</div>
                  <div className="mt-1 text-xl font-black">{currency}{total.toFixed(1)}</div>
                </div>
              </div>
              <div className="mt-4 max-h-[560px] space-y-1 overflow-auto pr-1">
                {items.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    <span className="text-[10px] font-black opacity-60">{String(index + 1).padStart(2, '0')}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold">{getItemLabel(item, language)}</span>
                      {!!item.remark?.trim() && (
                        <span className="mt-0.5 block truncate text-[10px] font-bold text-slate-400">
                          {t.remark}：{item.remark.trim()}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-black text-slate-400">×{item.quantity}</span>
                  </button>
                ))}
                {!items.length && <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">{t.noParts}</div>}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => setSelectedId(null)} className="mb-3 text-xs font-black text-blue-600 transition hover:text-blue-500">← {t.backToProject}</button>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">{t.properties}</h2>
              <div className="mt-4 space-y-5">
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  const duplicated = { ...cloneItems([selected])[0], id: makeId(), position: [selected.position[0] + 80, selected.position[1] + 80, selected.position[2]] as Vec3 };
                  commit([...items, duplicated], duplicated.id);
                }} className="diy-toolbar-button flex-1 gap-2"><Copy className="h-4 w-4" />{t.duplicate}</button>
                <button onClick={() => deleteItem(selected.id)} className="diy-toolbar-button flex-1 gap-2 text-red-600 hover:border-red-300 hover:bg-red-50"><Trash2 className="h-4 w-4" />{t.delete}</button>
              </div>

              {selected.kind === 'profile' && (
                <>
                  <label className="block">
                    <span className="diy-field-label">{t.model}</span>
                    <select value={selected.variantId} onChange={(event) => updateSelected({ variantId: event.target.value, name: event.target.value })} className="diy-select">
                      {PROFILE_VARIANTS.map((variant) => <option key={variant.id} value={variant.id}>{variant.name}</option>)}
                    </select>
                  </label>
                  <NumberField label={t.length} value={selected.length || 1000} min={21} max={3000} onChange={(length) => updateSelected({ length: Math.min(3000, Math.max(21, length)), holes: (selected.holes || []).filter((hole) => hole.positionMm <= length - 5) })} />
                </>
              )}

              {(selected.kind === 'plate' || selected.kind === 'pegboard' || selected.kind === 'marine_board') && (
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label={t.width} value={selected.width || 0} min={1} max={selected.kind === 'marine_board' ? 2440 : 2400} onChange={(width) => updateSelected({ width })} />
                  <NumberField label={t.height} value={selected.height || 0} min={1} max={selected.kind === 'marine_board' ? 1220 : 2400} onChange={(height) => updateSelected({ height })} />
                  <label className="col-span-2 block">
                    <span className="diy-field-label">{t.thickness}</span>
                    <select value={selected.thickness} onChange={(event) => updateSelected({ thickness: Number(event.target.value) })} className="diy-select">
                      {(selected.kind === 'marine_board' ? [12, 18] : selected.kind === 'pegboard' ? [2, 5] : [1, 2, 3, 4, 5]).map((value) => <option key={value} value={value}>{value}mm</option>)}
                    </select>
                  </label>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center gap-2"><Paintbrush className="h-4 w-4 text-blue-600" /><span className="diy-field-label !mb-0">{t.color}</span></div>
                <div className="grid grid-cols-2 gap-2">
                  {PROFILE_COLORS.map((color) => (
                    <button
                      key={color.id}
                      title={color.name[language]}
                      onClick={() => updateSelected({ colorId: color.id })}
                      className={`flex min-w-0 items-center gap-2 rounded-xl border p-2 text-left transition ${selected.colorId === color.id ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-slate-50 hover:border-blue-300'}`}
                    >
                      <span className="h-7 w-7 shrink-0 rounded-lg border border-black/10 shadow-inner" style={{ backgroundColor: COLOR_HEX[color.id] || '#ccc' }} />
                      <span className="min-w-0 truncate text-[10px] font-black text-slate-700">{color.name[language]}</span>
                    </button>
                  ))}
                </div>
              </div>

              <NumberField label={t.quantity} value={selected.quantity} min={1} max={999} onChange={(quantity) => updateSelected({ quantity: Math.max(1, quantity) })} />

              <div>
                <div className="diy-field-label">{t.position}</div>
                <div className="grid grid-cols-3 gap-2">
                  {(['X', 'Y', 'Z'] as const).map((axis, index) => <NumberField key={axis} label={axis} value={selected.position[index]} onChange={(value) => {
                    const position = [...selected.position] as Vec3;
                    position[index] = value;
                    updateSelected({ position });
                  }} />)}
                </div>
              </div>
              <div>
                <div className="diy-field-label">{t.rotation}</div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { label: t.rotateX, index: 0 as const },
                    { label: t.rotateY, index: 1 as const },
                    { label: t.rotateZ, index: 2 as const },
                  ]).map((axis) => (
                    <button key={axis.index} onClick={() => rotateSelectedBy90(axis.index)} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-[10px] font-black text-slate-700 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700">
                      <Rotate3D className="h-4 w-4" />
                      <span>{axis.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-center text-[10px] font-bold text-slate-400">X {selected.rotation[0]}° · Y {selected.rotation[1]}° · Z {selected.rotation[2]}°</div>
              </div>

              <label className="block">
                <span className="diy-field-label">{t.remark}</span>
                <textarea
                  value={selected.remark || ''}
                  onChange={(event) => updateSelected({ remark: event.target.value })}
                  placeholder={t.remarkPlaceholder}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {selected.kind === 'profile' && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <div className="mb-3 flex items-center gap-2"><CircleDot className="h-4 w-4 text-blue-600" /><h3 className="text-xs font-black uppercase tracking-widest text-blue-900">{t.drilling}</h3></div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label={t.holePosition} value={holePosition} min={5} max={(selected.length || 1000) - 5} onChange={setHolePosition} />
                    <label className="block"><span className="diy-field-label">{t.side}</span><select value={holeSide} onChange={(event) => setHoleSide(event.target.value as ProfileSide)} className="diy-select"><option>A</option><option>B</option><option>C</option><option>D</option></select></label>
                    <label className="col-span-2 block"><span className="diy-field-label">{t.holeType}</span><select value={holeType} onChange={(event) => setHoleType(event.target.value as HoleType)} className="diy-select"><option value="through">{t.through}</option><option value="countersunk">{t.countersunk}</option><option value="threaded">{t.threaded}</option></select></label>
                    {holeType === 'threaded' && <label className="col-span-2 block"><span className="diy-field-label">Thread</span><select value={threadSize} onChange={(event) => setThreadSize(event.target.value as ThreadSize)} className="diy-select">{(['M3', 'M4', 'M5', 'M6', 'M8'] as ThreadSize[]).map((size) => <option key={size}>{size}</option>)}</select></label>}
                    <button onClick={addHole} className="col-span-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-black text-white hover:bg-blue-500">{t.addHole}</button>
                  </div>
                  <div className="mt-3 space-y-1">
                    {(selected.holes || []).map((hole) => (
                      <div key={hole.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-600">
                        <span>{hole.side} · {hole.positionMm}mm · {t[hole.type]}{hole.threadSize ? ` ${hole.threadSize}` : ''}</span>
                        <button onClick={() => updateSelected({ holes: (selected.holes || []).filter((entry) => entry.id !== hole.id) })} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-blue-100 pt-3">
                    <div className="diy-field-label">{t.tapping}</div>
                    <div className="flex gap-4 text-xs font-bold text-slate-600">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={!!selected.tappingLeft} onChange={(event) => updateSelected({ tappingLeft: event.target.checked })} />{t.left}</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={!!selected.tappingRight} onChange={(event) => updateSelected({ tappingRight: event.target.checked })} />{t.right}</label>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t.total}</div>
                <div className="mt-1 text-2xl font-black">{currency}{calculatePrice(selected, user).toFixed(1)}</div>
              </div>
              </div>
            </>
          )}
          <button onClick={addDesignToCart} disabled={!items.length} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black text-white shadow-xl shadow-blue-600/20 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none">
            <ShoppingCart className="h-5 w-5" />{t.addCart} · {currency}{total.toFixed(1)}
          </button>
        </aside>
      </div>
    </div>
  );
};

export default DIYDesigner;
