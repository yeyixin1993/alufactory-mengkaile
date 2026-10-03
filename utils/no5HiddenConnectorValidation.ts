import * as THREE from 'three';
import {
  scanPhysicalConnectionNodes,
  type ConnectionDecisionSceneItem,
  type PhysicalConnectionNode,
} from './connectionDecisionEngine';
import { getAccessoryModelAsset } from '../data/accessoryModelAssets';
import { getDesignerScrewModelDimensions, usesScrewKitElasticFastener } from './designerScrewGeometry';
import { getDiyScrewOrderSpec } from './diyScrewOrderSpecs';

/**
 * Independent physical validator for the No.5 hidden connector.
 *
 * The authoritative connection solver remains responsible for discovering the
 * physical node and selecting a face candidate. This module only audits that
 * resolved node/candidate; it deliberately does not scan or choose joints.
 */

export const NO5_VALIDATION_RULE_VERSION = 'no5-hidden-connector-v1' as const;

export type No5Series = '2020' | '3030';
export type No5ValidationStatus = 'pass' | 'review' | 'block';
export type No5EvidenceStatus = 'confirmed' | 'derived_by_validator' | 'screening_only';
export type No5WorldVectorMm = readonly [number, number, number];

export interface No5ValidationSceneItem extends ConnectionDecisionSceneItem {
  readonly sourceMesh?: { readonly boundsMm: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] } };
  readonly width?: number;
  readonly height?: number;
  readonly thickness?: number;
  readonly screwHead?: 'socket_cylinder' | 'button_socket' | 'flat_socket';
  readonly accessoryProfileSize?: string;
  readonly attachedEnd?: 'left' | 'right';
  readonly attachedPartIds?: readonly string[];
  readonly installBeforeIds?: readonly string[];
  readonly installAfterIds?: readonly string[];
}

export interface No5ValidationCheck {
  readonly code: string;
  readonly status: No5ValidationStatus;
  readonly partIds: readonly string[];
  readonly message: string;
  readonly evidence?: Readonly<Record<string, string | number | boolean>>;
}

export interface No5ToolAccessEvidence {
  readonly fastenerIndex: 0 | 1;
  readonly requiredLengthMm: number;
  readonly radiusMm: number;
  /** True only when the dimensions come from a reviewed tool/catalog record. */
  readonly clearanceConfirmed: boolean;
  readonly sourceEvidenceKey?: string;
}

export interface No5InstallationEvidence {
  /** Travel beyond the final joint needed to close the branch profile. */
  readonly pathClearanceMm: number;
  /** Radius of the swept installation corridor around the slot centreline. */
  readonly radiusMm: number;
  /** True only when the values and assembly strategy were reviewed. */
  readonly clearanceConfirmed: boolean;
  readonly sourceEvidenceKey?: string;
  readonly strategy?: 'carrier_slot_then_branch_close';
}

export interface No5ToolAccessRay {
  readonly fastenerIndex: 0 | 1;
  /** Fastener socket centre, in world millimetres. */
  readonly originMm: No5WorldVectorMm;
  /** Normalized world direction from the socket towards the tool operator. */
  readonly direction: No5WorldVectorMm;
  readonly requiredLengthMm: number;
  readonly radiusMm: number;
  readonly clearanceConfirmed: boolean;
  readonly evidenceStatus: No5EvidenceStatus;
  readonly clear: boolean;
  readonly blockedByIds: readonly string[];
  readonly sourceEvidenceKey?: string;
}

/**
 * Resolved inputs used to create a persisted report. Diagnostic dimensions
 * remain explicitly labelled and never become supplier/tool evidence.
 */
export interface No5ValidationParameters {
  readonly slotToleranceMm: number;
  readonly diagnosticToolLengthMm: number;
  readonly diagnosticToolRadiusMm: number;
  readonly diagnosticInstallationClearanceMm: number;
  readonly toolEvidence: readonly No5ToolAccessEvidence[];
  readonly installationEvidence?: No5InstallationEvidence;
}

export interface No5ValidationReport {
  readonly connectorId: string;
  readonly jointKey: string;
  readonly status: No5ValidationStatus;
  readonly manufacturingReady: boolean;
  readonly installationReady: boolean;
  readonly slotChecks: readonly No5ValidationCheck[];
  readonly toolAccessRays: readonly No5ToolAccessRay[];
  readonly installationChecks: readonly No5ValidationCheck[];
  readonly issues: readonly No5ValidationCheck[];
  readonly ruleVersion: typeof NO5_VALIDATION_RULE_VERSION;
  /** Deterministic digest of the validated geometry outcome and evidence. */
  readonly geometrySignature: string;
  /** Needed to reproduce the exact validation when checking persisted data. */
  readonly validationParameters: No5ValidationParameters;
}

export type No5ValidationCurrentnessReason =
  | 'current'
  | 'report_invalid'
  | 'signature_missing'
  | 'report_content_mismatch'
  | 'connector_identity_mismatch'
  | 'scene_invalid'
  | 'node_missing'
  | 'signature_mismatch'
  | 'validation_failed';

export interface No5ValidationCurrentnessResult {
  readonly current: boolean;
  readonly reason: No5ValidationCurrentnessReason;
  readonly storedSignature?: string;
  readonly currentSignature?: string;
}

export interface InspectNo5ValidationCurrentnessInput {
  readonly report: unknown;
  readonly connector: unknown;
  readonly items: readonly unknown[];
}

export interface ValidateNo5HiddenConnectorInput {
  /** Node returned by the existing authoritative physical connection scan. */
  readonly node: PhysicalConnectionNode;
  /** The already-resolved No.5 candidate/item to audit. */
  readonly connector: No5ValidationSceneItem;
  readonly items: readonly No5ValidationSceneItem[];
  readonly toolEvidence?: readonly No5ToolAccessEvidence[];
  readonly installationEvidence?: No5InstallationEvidence;
  /** Geometry tolerance, not a substitute for missing catalog evidence. */
  readonly slotToleranceMm?: number;
  /** Diagnostic-only values used when real tool evidence is absent. */
  readonly diagnosticToolLengthMm?: number;
  readonly diagnosticToolRadiusMm?: number;
  readonly diagnosticInstallationClearanceMm?: number;
}

export interface No5ModeledGeometry {
  readonly series: No5Series;
  readonly moduleSizeMm: number;
  readonly armReachMm: number;
  readonly armWidthMm: number;
  readonly depthMm: number;
  readonly fastenerLocalCentersMm: readonly [No5WorldVectorMm, No5WorldVectorMm];
}

type OrientedBox = {
  readonly id: string;
  readonly center: THREE.Vector3;
  readonly axes: readonly [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  readonly halfSizes: readonly [number, number, number];
};

type ProfileGeometry = OrientedBox & {
  readonly item: No5ValidationSceneItem;
  readonly series: No5Series;
};

const DEFAULT_SLOT_TOLERANCE_MM = 0.5;
const DEFAULT_TOOL_LENGTH_MM = 80;
const DEFAULT_TOOL_RADIUS_MM = 12;
const DEFAULT_INSTALLATION_CLEARANCE_MM = 80;
const AXIS_ALIGNMENT_MIN = 0.985;
const OBB_PENETRATION_TOLERANCE_MM = 0.1;
const EPSILON = 1e-7;

const finitePositive = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

const finiteTriplet = (value: readonly number[]): value is No5WorldVectorMm => (
  value.length === 3 && value.every((entry) => Number.isFinite(entry))
);

const tuple = (value: THREE.Vector3): No5WorldVectorMm => [
  Number(value.x.toFixed(4)),
  Number(value.y.toFixed(4)),
  Number(value.z.toFixed(4)),
];

const vectorLabel = (value: THREE.Vector3) => tuple(value).join(',');

const quaternionFor = (rotation: readonly [number, number, number]) => (
  new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(rotation[0]),
    THREE.MathUtils.degToRad(rotation[1]),
    THREE.MathUtils.degToRad(rotation[2]),
    'XYZ',
  ))
);

const axesFor = (rotation: readonly [number, number, number]) => {
  const quaternion = quaternionFor(rotation);
  return [
    new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize(),
    new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize(),
    new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize(),
  ] as const;
};

const exactSeries = (item: No5ValidationSceneItem): No5Series | null => (
  item.variantId === '2020' || item.variantId === '3030' ? item.variantId : null
);

const connectorSeries = (item: No5ValidationSceneItem): No5Series | null => {
  const value = item.accessoryProfileSize;
  return value === '2020' || value === '3030' ? value : null;
};

export const getNo5ModeledGeometry = (series: No5Series): No5ModeledGeometry => {
  const moduleSizeMm = Number(series.slice(0, 2));
  const asset = getAccessoryModelAsset({ kind: 'hidden_connector', accessoryProfileSize: series });
  if (!asset || asset.placement.calibrationStatus !== 'aligned_to_existing_validator') {
    throw new Error(`No.5 ${series} precision asset metadata is missing or not aligned to the validator.`);
  }
  const [armReachMm, armWidthMm, depthMm] = asset.sceneDimensionsMm;
  const slotAnchors = asset.placement.anchors.filter((anchor) => anchor.role === 'slot_axis');
  if (slotAnchors.length !== 2) {
    throw new Error(`No.5 ${series} requires exactly two calibrated slot-axis anchors.`);
  }
  return {
    series,
    moduleSizeMm,
    armReachMm,
    armWidthMm,
    depthMm,
    fastenerLocalCentersMm: [slotAnchors[0].positionMm, slotAnchors[1].positionMm],
  };
};

/**
 * Converts the authoritative candidate's already face-depth-resolved origin
 * into the local origin used by the renderer's L-shaped No.5 casting. The
 * half-arm shift stays in the candidate plane, preserving its resolved depth,
 * and keeps both socket axes on their respective T-slot centreline.
 */
export const getNo5SlotCenteredOriginMm = (
  faceResolvedOriginMm: No5WorldVectorMm,
  rotationDeg: readonly [number, number, number],
  series: No5Series,
  targetProfiles: readonly [No5ValidationSceneItem, No5ValidationSceneItem],
): No5WorldVectorMm => {
  const geometry = getNo5ModeledGeometry(series);
  const [localX, localY] = axesFor(rotationDeg);
  const targetGeometry = targetProfiles.map(profileGeometry);
  if (!targetGeometry[0] || !targetGeometry[1]) {
    throw new Error('No.5 slot-centering requires two exact 2020/3030 target profiles.');
  }
  const targets = targetGeometry as [ProfileGeometry, ProfileGeometry];
  const xTarget = matchingTargetForAxis(localX, targets).target;
  const yTarget = matchingTargetForAxis(localY, targets).target;
  if (
    xTarget.id === yTarget.id
    || Math.abs(localX.dot(xTarget.axes[0])) < AXIS_ALIGNMENT_MIN
    || Math.abs(localY.dot(yTarget.axes[0])) < AXIS_ALIGNMENT_MIN
  ) {
    throw new Error('No.5 slot-centering requires one perpendicular target profile per arm.');
  }
  const origin = new THREE.Vector3(...faceResolvedOriginMm);
  const desiredLocalXCoordinate = yTarget.center.dot(localX) - geometry.armWidthMm / 2;
  const desiredLocalYCoordinate = xTarget.center.dot(localY) - geometry.armWidthMm / 2;
  origin.addScaledVector(localX, desiredLocalXCoordinate - origin.dot(localX));
  origin.addScaledVector(localY, desiredLocalYCoordinate - origin.dot(localY));
  return tuple(origin);
};

const profileGeometry = (item: No5ValidationSceneItem): ProfileGeometry | null => {
  const series = exactSeries(item);
  if (
    item.kind !== 'profile'
    || !series
    || !finiteTriplet(item.position)
    || !finiteTriplet(item.rotation)
    || !finitePositive(item.length)
  ) return null;
  const moduleSizeMm = Number(series.slice(0, 2));
  return {
    id: item.id,
    item,
    series,
    center: new THREE.Vector3(...item.position),
    axes: axesFor(item.rotation),
    halfSizes: [item.length / 2, moduleSizeMm / 2, moduleSizeMm / 2],
  };
};

const genericBox = (item: No5ValidationSceneItem): OrientedBox | null => {
  if (!finiteTriplet(item.position) || !finiteTriplet(item.rotation)) return null;
  if (item.kind === 'profile') return profileGeometry(item);
  // Imported hardware has exact local mesh bounds rather than board dimensions.
  // Include its conservative oriented envelope, including a non-zero local
  // centre, so hidden connectors cannot pass through ignored source geometry.
  const bounds = item.sourceMesh?.boundsMm;
  if (bounds && finiteTriplet(bounds.min) && finiteTriplet(bounds.max)) {
    const sizes = bounds.max.map((value, axis) => value - bounds.min[axis]);
    if (sizes.every(finitePositive)) {
      const axes = axesFor(item.rotation);
      const center = new THREE.Vector3(...item.position);
      axes.forEach((axis, index) => center.addScaledVector(axis, (bounds.min[index] + bounds.max[index]) / 2));
      return { id: item.id, center, axes, halfSizes: sizes.map(value => value / 2) as [number, number, number] };
    }
  }
  const width = Number(item.width);
  const height = Number(item.height);
  const thickness = Number(item.thickness);
  if (![width, height, thickness].every(finitePositive)) return null;
  return {
    id: item.id,
    center: new THREE.Vector3(...item.position),
    axes: axesFor(item.rotation),
    halfSizes: [width / 2, height / 2, thickness / 2],
  };
};

const projectedRadius = (box: OrientedBox, axis: THREE.Vector3) => box.axes.reduce(
  (sum, boxAxis, index) => sum + box.halfSizes[index] * Math.abs(boxAxis.dot(axis)),
  0,
);

const boxesOverlap = (first: OrientedBox, second: OrientedBox) => {
  const axes = [
    ...first.axes,
    ...second.axes,
    ...first.axes.flatMap((firstAxis) => second.axes.map((secondAxis) => (
      new THREE.Vector3().crossVectors(firstAxis, secondAxis)
    ))),
  ];
  const delta = second.center.clone().sub(first.center);
  return axes.every((candidate) => {
    if (candidate.lengthSq() < EPSILON) return true;
    const axis = candidate.clone().normalize();
    return Math.abs(delta.dot(axis))
      < projectedRadius(first, axis) + projectedRadius(second, axis) - OBB_PENETRATION_TOLERANCE_MM;
  });
};

const segmentIntersectsExpandedBox = (
  start: THREE.Vector3,
  direction: THREE.Vector3,
  lengthMm: number,
  radiusMm: number,
  box: OrientedBox,
) => {
  const end = start.clone().addScaledVector(direction, lengthMm);
  const localStart = box.axes.map((axis) => start.clone().sub(box.center).dot(axis));
  const localEnd = box.axes.map((axis) => end.clone().sub(box.center).dot(axis));
  let minimumT = 0;
  let maximumT = 1;
  for (let axisIndex = 0; axisIndex < 3; axisIndex += 1) {
    const delta = localEnd[axisIndex] - localStart[axisIndex];
    const halfSize = box.halfSizes[axisIndex] + radiusMm;
    if (Math.abs(delta) < EPSILON) {
      if (localStart[axisIndex] < -halfSize || localStart[axisIndex] > halfSize) return false;
      continue;
    }
    const firstT = (-halfSize - localStart[axisIndex]) / delta;
    const secondT = (halfSize - localStart[axisIndex]) / delta;
    const nearT = Math.min(firstT, secondT);
    const farT = Math.max(firstT, secondT);
    minimumT = Math.max(minimumT, nearT);
    maximumT = Math.min(maximumT, farT);
    if (minimumT > maximumT) return false;
  }
  return maximumT >= 0 && minimumT <= 1;
};

const connectorBoxes = (
  connector: No5ValidationSceneItem,
  geometry: No5ModeledGeometry,
): readonly [OrientedBox, OrientedBox] => {
  const [localX, localY, localZ] = axesFor(connector.rotation);
  const axes = [localX, localY, localZ] as const;
  const origin = new THREE.Vector3(...connector.position);
  return [
    {
      id: `${connector.id}:arm-0`,
      center: origin.clone()
        .addScaledVector(localX, geometry.armReachMm / 2)
        .addScaledVector(localY, geometry.armWidthMm / 2),
      axes,
      halfSizes: [geometry.armReachMm / 2, geometry.armWidthMm / 2, geometry.depthMm / 2],
    },
    {
      id: `${connector.id}:arm-1`,
      center: origin.clone()
        .addScaledVector(localX, geometry.armWidthMm / 2)
        .addScaledVector(localY, geometry.armReachMm / 2),
      axes,
      halfSizes: [geometry.armWidthMm / 2, geometry.armReachMm / 2, geometry.depthMm / 2],
    },
  ];
};

const check = (
  code: string,
  status: No5ValidationStatus,
  partIds: readonly string[],
  message: string,
  evidence?: Readonly<Record<string, string | number | boolean>>,
): No5ValidationCheck => ({ code, status, partIds, message, evidence });

const profileAtNode = (
  id: string,
  items: readonly No5ValidationSceneItem[],
) => {
  const item = items.find((entry) => entry.id === id);
  return item ? profileGeometry(item) : null;
};

const profileEndpoint = (profile: ProfileGeometry, side: -1 | 1) => (
  profile.center.clone().addScaledVector(profile.axes[0], profile.halfSizes[0] * side)
);

const obstacleBoxesFor = (
  input: ValidateNo5HiddenConnectorInput,
  ignoredIds: ReadonlySet<string>,
) => input.items.flatMap((item): OrientedBox[] => {
  if (ignoredIds.has(item.id)) return [];
  // Fasteners belonging to this same joint are part of the No.5 assembly, not
  // obstacles in front of their own socket.
  if (
    (item.kind === 'screw' || item.kind === 'fastener' || item.kind === 'bolt')
    && (item.attachmentKey === input.node.jointKey || item.attachmentKey?.startsWith(`${input.node.jointKey}:`))
  ) return [];
  if (item.kind === 'screw' && finiteTriplet(item.position) && finiteTriplet(item.rotation)) {
    // The origin is the head seat, not the centre of a length-sized box.
    // Keep the narrower shaft separate from the head; both are obstacles.
    const { lengthMm, shaftRadiusMm, headRadiusMm, headHeightMm } = getDesignerScrewModelDimensions(item);
    const axes = axesFor(item.rotation);
    const box = (y: number, halfSizes: [number, number, number]): OrientedBox => ({
      id: item.id, axes, center: new THREE.Vector3(...item.position).addScaledVector(axes[1], y), halfSizes,
    });
    const result = [box(-lengthMm / 2, [shaftRadiusMm, lengthMm / 2, shaftRadiusMm]),
      box((headHeightMm + 1) / 2, [headRadiusMm, (headHeightMm + 1) / 2, headRadiusMm])];
    if (getDiyScrewOrderSpec(item.accessoryProfileSize, item.screwHead, lengthMm).includesElasticFastener && usesScrewKitElasticFastener(item)) {
      const nutThickness = Math.max(2.6, shaftRadiusMm * 0.42);
      result.push(box(-Math.max(2.5, shaftRadiusMm * 0.58), [headRadiusMm * 1.325, nutThickness, headRadiusMm * 0.75]));
    }
    return result;
  }
  const box = genericBox(item);
  return box ? [box] : [];
});

const matchingTargetForAxis = (
  axis: THREE.Vector3,
  targets: readonly [ProfileGeometry, ProfileGeometry],
) => {
  const firstAlignment = Math.abs(axis.dot(targets[0].axes[0]));
  const secondAlignment = Math.abs(axis.dot(targets[1].axes[0]));
  return firstAlignment >= secondAlignment
    ? { target: targets[0], alignment: firstAlignment }
    : { target: targets[1], alignment: secondAlignment };
};

const fastenerWorldCenters = (
  connector: No5ValidationSceneItem,
  geometry: No5ModeledGeometry,
) => {
  const axes = axesFor(connector.rotation);
  const origin = new THREE.Vector3(...connector.position);
  return geometry.fastenerLocalCentersMm.map((local) => origin.clone()
    .addScaledVector(axes[0], local[0])
    .addScaledVector(axes[1], local[1])
    .addScaledVector(axes[2], local[2])) as [THREE.Vector3, THREE.Vector3];
};

const stableUnique = (values: readonly string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const recordValue = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const confirmedToolEvidence = (value: unknown): No5ToolAccessEvidence[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): No5ToolAccessEvidence[] => {
    const source = recordValue(entry);
    const fastenerIndex = Number(source?.fastenerIndex);
    const sourceEvidenceKey = String(source?.sourceEvidenceKey ?? '').trim();
    if (
      !source
      || (fastenerIndex !== 0 && fastenerIndex !== 1)
      || !finitePositive(source.requiredLengthMm)
      || !finitePositive(source.radiusMm)
      || source.clearanceConfirmed !== true
      || !sourceEvidenceKey
    ) return [];
    return [{
      fastenerIndex: fastenerIndex as 0 | 1,
      requiredLengthMm: source.requiredLengthMm,
      radiusMm: source.radiusMm,
      clearanceConfirmed: true,
      sourceEvidenceKey,
    }];
  }).filter((entry, index, all) => (
    all.findIndex((candidate) => candidate.fastenerIndex === entry.fastenerIndex) === index
  )).sort((first, second) => first.fastenerIndex - second.fastenerIndex);
};

const confirmedInstallationEvidence = (value: unknown): No5InstallationEvidence | undefined => {
  const source = recordValue(value);
  const sourceEvidenceKey = String(source?.sourceEvidenceKey ?? '').trim();
  if (
    !source
    || !finitePositive(source.pathClearanceMm)
    || !finitePositive(source.radiusMm)
    || source.clearanceConfirmed !== true
    || source.strategy !== 'carrier_slot_then_branch_close'
    || !sourceEvidenceKey
  ) return undefined;
  return {
    pathClearanceMm: source.pathClearanceMm,
    radiusMm: source.radiusMm,
    clearanceConfirmed: true,
    sourceEvidenceKey,
    strategy: 'carrier_slot_then_branch_close',
  };
};

type No5SignatureSource = Omit<No5ValidationReport, 'geometrySignature'>;

const canonicalSignatureValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalSignatureValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, entry]) => [key, canonicalSignatureValue(entry)]));
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Number(value.toFixed(6)) : String(value);
  }
  return value;
};

const signatureCheck = (entry: No5ValidationCheck) => ({
  code: entry.code,
  status: entry.status,
  partIds: [...entry.partIds],
  evidence: entry.evidence || null,
});

const signaturePayload = (report: No5SignatureSource) => ({
  ruleVersion: report.ruleVersion,
  connectorId: report.connectorId,
  jointKey: report.jointKey,
  status: report.status,
  manufacturingReady: report.manufacturingReady,
  installationReady: report.installationReady,
  slotChecks: report.slotChecks.map(signatureCheck),
  toolAccessRays: report.toolAccessRays.map((ray) => ({
    fastenerIndex: ray.fastenerIndex,
    originMm: [...ray.originMm],
    direction: [...ray.direction],
    requiredLengthMm: ray.requiredLengthMm,
    radiusMm: ray.radiusMm,
    clearanceConfirmed: ray.clearanceConfirmed,
    evidenceStatus: ray.evidenceStatus,
    clear: ray.clear,
    blockedByIds: [...ray.blockedByIds],
    sourceEvidenceKey: ray.sourceEvidenceKey || null,
  })),
  installationChecks: report.installationChecks.map(signatureCheck),
  validationParameters: report.validationParameters,
});

const digestText = (value: string, seed: number) => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const geometrySignatureFor = (report: No5SignatureSource) => {
  const canonical = JSON.stringify(canonicalSignatureValue(signaturePayload(report)));
  return `no5g1-${digestText(canonical, 0x811c9dc5)}-${digestText(canonical, 0x9e3779b9)}`;
};

export const validateNo5HiddenConnector = (
  input: ValidateNo5HiddenConnectorInput,
): No5ValidationReport => {
  const { node, connector, items } = input;
  const slotToleranceMm = finitePositive(input.slotToleranceMm)
    ? input.slotToleranceMm
    : DEFAULT_SLOT_TOLERANCE_MM;
  const diagnosticToolLengthMm = finitePositive(input.diagnosticToolLengthMm)
    ? input.diagnosticToolLengthMm
    : DEFAULT_TOOL_LENGTH_MM;
  const diagnosticToolRadiusMm = finitePositive(input.diagnosticToolRadiusMm)
    ? input.diagnosticToolRadiusMm
    : DEFAULT_TOOL_RADIUS_MM;
  const diagnosticInstallationClearanceMm = finitePositive(input.diagnosticInstallationClearanceMm)
    ? input.diagnosticInstallationClearanceMm
    : DEFAULT_INSTALLATION_CLEARANCE_MM;
  const toolEvidence = confirmedToolEvidence(input.toolEvidence);
  const installationEvidence = confirmedInstallationEvidence(input.installationEvidence);
  const validationParameters: No5ValidationParameters = {
    slotToleranceMm,
    diagnosticToolLengthMm,
    diagnosticToolRadiusMm,
    diagnosticInstallationClearanceMm,
    toolEvidence,
    ...(installationEvidence ? { installationEvidence } : {}),
  };
  const slotChecks: No5ValidationCheck[] = [];
  const installationChecks: No5ValidationCheck[] = [];
  const pairIds = [...node.profileIds].sort((a, b) => a.localeCompare(b));
  const attachedPair = [...(connector.attachedProfileIds || [])].sort((a, b) => a.localeCompare(b));
  const connectorIdentityValid = connector.kind === 'hidden_connector'
    && attachedPair.length === 2
    && attachedPair.every((id, index) => id === pairIds[index]);
  slotChecks.push(check(
    'NO5_TARGET_PAIR',
    connectorIdentityValid ? 'pass' : 'block',
    [connector.id, ...node.profileIds],
    connectorIdentityValid
      ? '5号隐藏连接已绑定权威节点的两根目标型材。'
      : '5号隐藏连接未准确绑定权威节点的两根目标型材。',
    { jointKey: node.jointKey },
  ));

  const firstProfile = profileAtNode(node.profileIds[0], items);
  const secondProfile = profileAtNode(node.profileIds[1], items);
  const targetsValid = Boolean(
    firstProfile
    && secondProfile
    && firstProfile.series === node.series
    && secondProfile.series === node.series
    && (node.series === '2020' || node.series === '3030'),
  );
  slotChecks.push(check(
    'NO5_EXACT_PROFILE_SERIES',
    targetsValid ? 'pass' : 'block',
    node.profileIds,
    targetsValid
      ? `两根目标型材均为已明确识别的${node.series}方型材。`
      : '5号隐藏连接只允许用于已明确识别且同系列的2020或3030方型材。',
    { authoritativeSeries: node.series },
  ));

  const reportedConnectorSeries = connectorSeries(connector);
  const seriesMatches = reportedConnectorSeries === null || reportedConnectorSeries === node.series;
  slotChecks.push(check(
    'NO5_CONNECTOR_SERIES',
    seriesMatches ? (reportedConnectorSeries ? 'pass' : 'review') : 'block',
    [connector.id],
    reportedConnectorSeries === node.series
      ? `连接件规格与${node.series}型材一致。`
      : reportedConnectorSeries
        ? `连接件规格${reportedConnectorSeries}与节点${node.series}不一致。`
        : '连接件未携带明确的2020/3030规格标识，需要补录目录证据。',
    { connectorSeries: reportedConnectorSeries || 'missing', nodeSeries: node.series },
  ));

  const geometry = getNo5ModeledGeometry(node.series);
  const connectorDimensionsPresent = finitePositive(connector.width)
    && finitePositive(connector.height)
    && finitePositive(connector.thickness);
  const connectorDimensionsValid = connectorDimensionsPresent
    && Math.abs(connector.width! - geometry.armReachMm) <= slotToleranceMm
    && Math.abs(connector.height! - geometry.armWidthMm) <= slotToleranceMm
    && Math.abs(connector.thickness! - geometry.depthMm) <= slotToleranceMm;
  slotChecks.push(check(
    'NO5_CATALOG_GEOMETRY',
    connectorDimensionsValid ? 'pass' : connectorDimensionsPresent ? 'block' : 'review',
    [connector.id],
    connectorDimensionsValid
      ? '连接件实体尺寸与当前5号规格一致。'
      : connectorDimensionsPresent
        ? '连接件实体尺寸与当前5号规格不一致。'
        : '旧导入连接件缺少实体尺寸，需补录后才能按5号规则放行。',
    {
      expectedArmReachMm: geometry.armReachMm,
      expectedArmWidthMm: geometry.armWidthMm,
      expectedDepthMm: geometry.depthMm,
    },
  ));
  const connectorAxesValid = finiteTriplet(connector.position) && finiteTriplet(connector.rotation);
  const [localX, localY, faceNormal] = connectorAxesValid
    ? axesFor(connector.rotation)
    : [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  const origin = connectorAxesValid ? new THREE.Vector3(...connector.position) : new THREE.Vector3();
  const authoritativePlacementIdentity = Boolean(
    connector.attachmentKey
    && connector.attachmentKey.startsWith(`${node.jointKey}:SLOT-5:FACE-`),
  );
  const derivedValidationEligible = connectorIdentityValid
    && targetsValid
    && reportedConnectorSeries === node.series
    && connectorDimensionsValid
    && connectorAxesValid
    && authoritativePlacementIdentity;

  let mappedTargets: readonly [ProfileGeometry, ProfileGeometry] | null = null;
  if (firstProfile && secondProfile && connectorAxesValid) {
    const targets = [firstProfile, secondProfile] as const;
    const xMatch = matchingTargetForAxis(localX, targets);
    const yMatch = matchingTargetForAxis(localY, targets);
    const orientationValid = xMatch.target.id !== yMatch.target.id
      && xMatch.alignment >= AXIS_ALIGNMENT_MIN
      && yMatch.alignment >= AXIS_ALIGNMENT_MIN
      && Math.abs(xMatch.target.axes[0].dot(yMatch.target.axes[0])) <= 1 - AXIS_ALIGNMENT_MIN;
    mappedTargets = orientationValid ? [xMatch.target, yMatch.target] : null;
    slotChecks.push(check(
      'NO5_ARM_PROFILE_ALIGNMENT',
      orientationValid ? 'pass' : 'block',
      [connector.id, firstProfile.id, secondProfile.id],
      orientationValid
        ? '连接件两条臂分别沿两根互相垂直的型材轴线布置。'
        : '连接件臂方向没有分别对准两根互相垂直的目标型材。',
      {
        localXAlignment: Number(xMatch.alignment.toFixed(4)),
        localYAlignment: Number(yMatch.alignment.toFixed(4)),
      },
    ));

    const firstFaceAlignment = Math.max(
      Math.abs(faceNormal.dot(firstProfile.axes[1])),
      Math.abs(faceNormal.dot(firstProfile.axes[2])),
    );
    const secondFaceAlignment = Math.max(
      Math.abs(faceNormal.dot(secondProfile.axes[1])),
      Math.abs(faceNormal.dot(secondProfile.axes[2])),
    );
    const faceDirectionsValid = firstFaceAlignment >= AXIS_ALIGNMENT_MIN
      && secondFaceAlignment >= AXIS_ALIGNMENT_MIN;
    slotChecks.push(check(
      'NO5_OPEN_SLOT_FACE_DIRECTION',
      faceDirectionsValid ? 'pass' : 'block',
      [connector.id, firstProfile.id, secondProfile.id],
      faceDirectionsValid
        ? '连接件法向对准两根方型材的开槽面方向。'
        : '连接件法向没有对准两根型材可用的方形开槽面。',
      {
        firstFaceAlignment: Number(firstFaceAlignment.toFixed(4)),
        secondFaceAlignment: Number(secondFaceAlignment.toFixed(4)),
        faceNormal: vectorLabel(faceNormal),
      },
    ));

    const firstSurface = firstProfile.center.dot(faceNormal) + projectedRadius(firstProfile, faceNormal);
    const secondSurface = secondProfile.center.dot(faceNormal) + projectedRadius(secondProfile, faceNormal);
    const surfaceDelta = Math.abs(firstSurface - secondSurface);
    const commonSurface = (firstSurface + secondSurface) / 2;
    const expectedCenterCoordinate = commonSurface - geometry.depthMm / 2 + 0.2;
    const recessDelta = Math.abs(origin.dot(faceNormal) - expectedCenterCoordinate);
    slotChecks.push(check(
      'NO5_COMMON_SLOT_PLANE',
      surfaceDelta <= slotToleranceMm ? 'pass' : 'block',
      [firstProfile.id, secondProfile.id],
      surfaceDelta <= slotToleranceMm
        ? '两根型材存在同一共面槽口面。'
        : '两根型材的候选槽口面不共面，单件5号连接无法同时落槽。',
      {
        surfaceDeltaMm: Number(surfaceDelta.toFixed(4)),
        toleranceMm: slotToleranceMm,
      },
    ));
    slotChecks.push(check(
      'NO5_CASTING_RECESS',
      recessDelta <= slotToleranceMm ? 'pass' : 'block',
      [connector.id, firstProfile.id, secondProfile.id],
      recessDelta <= slotToleranceMm
        ? '连接件铸体已按槽面深度落位。'
        : '连接件铸体没有落在共同槽面的正确深度。',
      {
        recessDeltaMm: Number(recessDelta.toFixed(4)),
        expectedCenterPlaneMm: Number(expectedCenterCoordinate.toFixed(4)),
      },
    ));
  } else {
    slotChecks.push(check(
      'NO5_ARM_PROFILE_ALIGNMENT',
      'block',
      [connector.id, ...node.profileIds],
      '连接件或目标型材缺少有限的世界坐标，无法核验方向。',
    ));
  }

  const fastenerCenters = connectorAxesValid
    ? fastenerWorldCenters(connector, geometry)
    : [new THREE.Vector3(), new THREE.Vector3()] as [THREE.Vector3, THREE.Vector3];
  if (mappedTargets) {
    mappedTargets.forEach((target, fastenerIndex) => {
      const socket = fastenerCenters[fastenerIndex];
      const longAxis = target.axes[0];
      const acrossAxis = new THREE.Vector3().crossVectors(faceNormal, longAxis).normalize();
      const slotOffsetMm = Math.abs(socket.clone().sub(target.center).dot(acrossAxis));
      const alongMm = socket.clone().sub(target.center).dot(longAxis);
      const withinLength = Math.abs(alongMm) <= target.halfSizes[0] + slotToleranceMm;
      const centred = slotOffsetMm <= slotToleranceMm;
      slotChecks.push(check(
        `NO5_FASTENER_${fastenerIndex + 1}_SLOT_CENTERLINE`,
        centred && withinLength ? 'pass' : 'block',
        [connector.id, target.id],
        centred && withinLength
          ? `第${fastenerIndex + 1}颗螺钉中心对准${target.id}的真实槽中心线。`
          : `第${fastenerIndex + 1}颗螺钉没有落在${target.id}的有效槽中心线上。`,
        {
          slotOffsetMm: Number(slotOffsetMm.toFixed(4)),
          toleranceMm: slotToleranceMm,
          withinProfileLength: withinLength,
          socketOriginMm: vectorLabel(socket),
        },
      ));

      const armStart = origin.clone()
        .addScaledVector(fastenerIndex === 0 ? localY : localX, geometry.armWidthMm / 2);
      const armEnd = armStart.clone()
        .addScaledVector(fastenerIndex === 0 ? localX : localY, geometry.armReachMm);
      const projectedStart = armStart.clone().sub(target.center).dot(longAxis);
      const projectedEnd = armEnd.clone().sub(target.center).dot(longAxis);
      // The L bend may extend across the neighbouring profile by up to one
      // module. Its far end and socket must still lie inside the target slot.
      const armFits = Math.abs(projectedEnd) <= target.halfSizes[0] + slotToleranceMm
        && Math.abs(projectedStart) <= target.halfSizes[0] + geometry.moduleSizeMm + slotToleranceMm;
      slotChecks.push(check(
        `NO5_ARM_${fastenerIndex + 1}_REACH`,
        armFits ? 'pass' : 'block',
        [connector.id, target.id],
        armFits
          ? `第${fastenerIndex + 1}条连接臂完整位于目标槽的有效长度内。`
          : `第${fastenerIndex + 1}条连接臂超出目标槽的有效长度。`,
        { armReachMm: geometry.armReachMm },
      ));
    });
  } else {
    [0, 1].forEach((index) => slotChecks.push(check(
      `NO5_FASTENER_${index + 1}_SLOT_CENTERLINE`,
      'block',
      [connector.id, ...node.profileIds],
      `方向关系无效，无法核验第${index + 1}颗螺钉的槽中心线。`,
    )));
  }

  const ignoredIds = new Set([connector.id, ...node.profileIds]);
  const obstacleBoxes = obstacleBoxesFor(input, ignoredIds);
  const itemById = new Map(items.map((item) => [item.id, item]));
  // No.5 is installed during the frame/connection stage. Boards, doors and
  // end caps may legitimately occupy the final tool volume after tightening;
  // they become blockers only when their explicit order requires them first.
  const installationObstacleBoxes = obstacleBoxes.filter((obstacle) => {
    const item = itemById.get(obstacle.id);
    return item?.kind === 'profile' || item?.installBeforeIds?.includes(connector.id);
  });
  const castingBlockedByIds = connectorAxesValid
    ? stableUnique(obstacleBoxes.filter((obstacle) => (
      connectorBoxes(connector, geometry).some((arm) => boxesOverlap(arm, obstacle))
    )).map((obstacle) => obstacle.id))
    : [];
  slotChecks.push(check(
    'NO5_CASTING_OBSTRUCTION',
    castingBlockedByIds.length ? 'block' : 'pass',
    [connector.id, ...castingBlockedByIds],
    castingBlockedByIds.length
      ? '连接件铸体与其他已建模构件发生实体干涉。'
      : '连接件铸体未与目标型材之外的已建模构件干涉。',
    { blockedByIds: castingBlockedByIds.join(',') || 'none' },
  ));

  const toolAccessRays = ([0, 1] as const).map((fastenerIndex): No5ToolAccessRay => {
    const evidence = toolEvidence.find((entry) => entry.fastenerIndex === fastenerIndex);
    const evidenceComplete = Boolean(
      evidence
      && evidence.clearanceConfirmed
      && finitePositive(evidence.requiredLengthMm)
      && finitePositive(evidence.radiusMm)
      && evidence.sourceEvidenceKey,
    );
    const derivedByValidator = !evidenceComplete && derivedValidationEligible;
    const requiredLengthMm = evidenceComplete
      ? evidence!.requiredLengthMm
      : derivedByValidator ? DEFAULT_TOOL_LENGTH_MM : diagnosticToolLengthMm;
    const radiusMm = evidenceComplete
      ? evidence!.radiusMm
      : derivedByValidator ? DEFAULT_TOOL_RADIUS_MM : diagnosticToolRadiusMm;
    const originMm = fastenerCenters[fastenerIndex];
    const blockedByIds = connectorAxesValid
      ? stableUnique(installationObstacleBoxes.filter((obstacle) => segmentIntersectsExpandedBox(
        originMm,
        faceNormal,
        requiredLengthMm,
        radiusMm,
        obstacle,
      )).map((obstacle) => obstacle.id))
      : [];
    return {
      fastenerIndex,
      originMm: tuple(originMm),
      direction: tuple(faceNormal),
      requiredLengthMm,
      radiusMm,
      clearanceConfirmed: evidenceComplete || derivedByValidator,
      evidenceStatus: evidenceComplete
        ? 'confirmed'
        : derivedByValidator ? 'derived_by_validator' : 'screening_only',
      clear: connectorAxesValid && blockedByIds.length === 0,
      blockedByIds,
      sourceEvidenceKey: evidenceComplete
        ? evidence!.sourceEvidenceKey
        : derivedByValidator ? NO5_VALIDATION_RULE_VERSION : undefined,
    };
  });

  toolAccessRays.forEach((ray) => {
    const status: No5ValidationStatus = ray.clearanceConfirmed
      ? (ray.clear ? 'pass' : 'block')
      : 'review';
    installationChecks.push(check(
      `NO5_TOOL_ACCESS_${ray.fastenerIndex + 1}`,
      status,
      [connector.id, ...ray.blockedByIds],
      ray.clearanceConfirmed
        ? ray.clear
          ? ray.evidenceStatus === 'confirmed'
            ? `第${ray.fastenerIndex + 1}颗螺钉的工具直达通道已按目录尺寸验证。`
            : `第${ray.fastenerIndex + 1}颗螺钉的80×R12mm直达通道已由5号专项规则验证。`
          : `第${ray.fastenerIndex + 1}颗螺钉的已确认工具通道被构件遮挡。`
        : `第${ray.fastenerIndex + 1}颗螺钉目前只有${ray.requiredLengthMm}×R${ray.radiusMm}mm筛查通道，不能视为已验证净空。`,
      {
        evidenceStatus: ray.evidenceStatus,
        clearanceConfirmed: ray.clearanceConfirmed,
        screeningClear: ray.clear,
        blockedByIds: ray.blockedByIds.join(',') || 'none',
      },
    ));
  });

  const carrier = profileAtNode(node.carrierProfileId, items);
  const branch = profileAtNode(node.branchProfileId, items);
  const contact = new THREE.Vector3(...node.contactPointMm);
  const branchEndpointDelta = branch
    ? profileEndpoint(branch, node.branchEnd).distanceTo(contact)
    : Number.POSITIVE_INFINITY;
  const branchEndpointValid = Boolean(branch && branchEndpointDelta <= geometry.moduleSizeMm * 0.7);
  installationChecks.push(check(
    'NO5_BRANCH_OPEN_END',
    branchEndpointValid ? 'pass' : 'block',
    [node.branchProfileId, connector.id],
    branchEndpointValid
      ? '分支型材以开放端套入第二条连接臂，端部关系有效。'
      : '分支型材的安装端不在该物理节点，无法沿槽套入连接件。',
    { endpointDeltaMm: Number.isFinite(branchEndpointDelta) ? Number(branchEndpointDelta.toFixed(4)) : 'missing' },
  ));

  const installationEvidenceComplete = Boolean(
    installationEvidence
    && installationEvidence.clearanceConfirmed
    && installationEvidence.strategy === 'carrier_slot_then_branch_close'
    && finitePositive(installationEvidence.pathClearanceMm)
    && finitePositive(installationEvidence.radiusMm)
    && installationEvidence.sourceEvidenceKey,
  );
  const slotGeometryPass = slotChecks.every((entry) => entry.status === 'pass');
  const installationDerivedByValidator = !installationEvidenceComplete
    && derivedValidationEligible
    && slotGeometryPass;
  const installationClearanceConfirmed = installationEvidenceComplete || installationDerivedByValidator;
  const pathClearanceMm = installationEvidenceComplete
    ? installationEvidence!.pathClearanceMm
    : installationDerivedByValidator ? DEFAULT_INSTALLATION_CLEARANCE_MM : diagnosticInstallationClearanceMm;
  const pathRadiusMm = installationEvidenceComplete
    ? installationEvidence!.radiusMm
    : installationDerivedByValidator ? DEFAULT_TOOL_RADIUS_MM : geometry.armWidthMm / 2;

  let carrierPathBlockedByIds: string[] = [];
  if (carrier) {
    const carrierArmIndex = mappedTargets?.findIndex((target) => target.id === carrier.id) ?? -1;
    const carrierSlotDestination = carrierArmIndex >= 0
      ? fastenerCenters[carrierArmIndex].clone().addScaledVector(faceNormal, -geometry.depthMm / 2)
      : origin.clone();
    const endpoints = [-1, 1].map((side) => ({
      side: side as -1 | 1,
      point: carrierSlotDestination.clone().addScaledVector(
        carrier.axes[0],
        side * carrier.halfSizes[0]
          - carrierSlotDestination.clone().sub(carrier.center).dot(carrier.axes[0]),
      ),
    }));
    const endpointPaths = endpoints.map(({ point }) => {
      const delta = carrierSlotDestination.clone().sub(point);
      const length = delta.length();
      const direction = length > EPSILON ? delta.clone().normalize() : carrier.axes[0].clone();
      const blockers = stableUnique(installationObstacleBoxes.filter((obstacle) => segmentIntersectsExpandedBox(
        point,
        direction,
        length,
        pathRadiusMm,
        obstacle,
      )).map((obstacle) => obstacle.id));
      return { length, blockers };
    });
    const bestPath = [...endpointPaths].sort((first, second) => (
      first.blockers.length - second.blockers.length || first.length - second.length
    ))[0];
    carrierPathBlockedByIds = bestPath?.blockers || [];
  }
  const carrierPathClear = Boolean(carrier && carrierPathBlockedByIds.length === 0);
  installationChecks.push(check(
    'NO5_CARRIER_SLOT_FEED_PATH',
    installationClearanceConfirmed ? (carrierPathClear ? 'pass' : 'block') : 'review',
    [node.carrierProfileId, connector.id, ...carrierPathBlockedByIds],
    installationClearanceConfirmed
      ? carrierPathClear
        ? installationEvidenceComplete
          ? '连接件可按已确认工艺从承载型材开放端沿共同槽面送入节点。'
          : '连接件可按5号专项规则从承载型材开放端沿共同槽面送入节点。'
        : '按已确认安装包络，连接件无法从承载型材任一端送入。'
      : '已计算承载槽送入路径，但安装包络尚未由工具/工艺目录确认。',
    {
      clearanceConfirmed: installationClearanceConfirmed,
      evidenceStatus: installationEvidenceComplete ? 'confirmed' : installationDerivedByValidator ? 'derived_by_validator' : 'screening_only',
      pathClearanceMm,
      radiusMm: pathRadiusMm,
      screeningClear: carrierPathClear,
      blockedByIds: carrierPathBlockedByIds.join(',') || 'none',
    },
  ));

  let branchPathBlockedByIds: string[] = [];
  if (branch) {
    const branchEntryPoint = profileEndpoint(branch, node.branchEnd);
    branchEntryPoint.addScaledVector(
      faceNormal,
      origin.dot(faceNormal) - branchEntryPoint.dot(faceNormal),
    );
    const approachDirection = branch.axes[0].clone().multiplyScalar(-node.branchEnd).normalize();
    branchPathBlockedByIds = stableUnique(installationObstacleBoxes.filter((obstacle) => segmentIntersectsExpandedBox(
      branchEntryPoint,
      approachDirection,
      pathClearanceMm,
      pathRadiusMm,
      obstacle,
    )).map((obstacle) => obstacle.id));
  }
  const branchPathClear = Boolean(branch && branchPathBlockedByIds.length === 0);
  installationChecks.push(check(
    'NO5_BRANCH_CLOSE_PATH',
    installationClearanceConfirmed ? (branchPathClear ? 'pass' : 'block') : 'review',
    [node.branchProfileId, connector.id, ...branchPathBlockedByIds],
    installationClearanceConfirmed
      ? branchPathClear
        ? installationEvidenceComplete
          ? '分支型材可按已确认工艺沿轴线闭合并套入连接件第二臂。'
          : '分支型材可按5号专项规则沿轴线闭合并套入连接件第二臂。'
        : '按已确认安装包络，分支型材闭合路径受阻。'
      : '已筛查分支型材闭合方向，但实际移动包络和安装工艺尚未确认。',
    {
      clearanceConfirmed: installationClearanceConfirmed,
      evidenceStatus: installationEvidenceComplete ? 'confirmed' : installationDerivedByValidator ? 'derived_by_validator' : 'screening_only',
      pathClearanceMm,
      radiusMm: pathRadiusMm,
      screeningClear: branchPathClear,
      blockedByIds: branchPathBlockedByIds.join(',') || 'none',
    },
  ));

  const relatedEndCaps = items.filter((item) => (
    item.kind === 'end_cap'
    && (
      item.linkedProfileId === node.carrierProfileId
      || item.attachedProfileIds?.includes(node.carrierProfileId)
    )
  ));
  installationChecks.push(check(
    'NO5_END_CAP_SEQUENCE',
    'pass',
    [connector.id, ...relatedEndCaps.map((item) => item.id)],
    relatedEndCaps.length
      ? '承载型材端盖必须排在5号连接送入之后安装。'
      : '承载型材开放端未发现已建模端盖阻断。',
    { installConnectorBeforeEndCaps: relatedEndCaps.length > 0 },
  ));

  const manufacturingReady = slotChecks.every((entry) => entry.status === 'pass');
  const installationReady = manufacturingReady
    && toolAccessRays.every((ray) => ray.clearanceConfirmed && ray.clear)
    && installationChecks.every((entry) => entry.status === 'pass');
  const allChecks = [...slotChecks, ...installationChecks];
  const issues = allChecks.filter((entry) => entry.status !== 'pass');
  const status: No5ValidationStatus = allChecks.some((entry) => entry.status === 'block')
    ? 'block'
    : installationReady ? 'pass' : 'review';

  const unsignedReport: No5SignatureSource = {
    connectorId: connector.id,
    jointKey: node.jointKey,
    status,
    manufacturingReady,
    installationReady,
    slotChecks,
    toolAccessRays,
    installationChecks,
    issues,
    ruleVersion: NO5_VALIDATION_RULE_VERSION,
    validationParameters,
  };
  return {
    ...unsignedReport,
    geometrySignature: geometrySignatureFor(unsignedReport),
  };
};

const validationParametersFromUnknown = (value: unknown): No5ValidationParameters | null => {
  const source = recordValue(value);
  if (
    !source
    || !finitePositive(source.slotToleranceMm)
    || !finitePositive(source.diagnosticToolLengthMm)
    || !finitePositive(source.diagnosticToolRadiusMm)
    || !finitePositive(source.diagnosticInstallationClearanceMm)
    || !Array.isArray(source.toolEvidence)
  ) return null;
  const toolEvidence = confirmedToolEvidence(source.toolEvidence);
  if (toolEvidence.length !== source.toolEvidence.length) return null;
  const installationEvidence = source.installationEvidence == null
    ? undefined
    : confirmedInstallationEvidence(source.installationEvidence);
  if (source.installationEvidence != null && !installationEvidence) return null;
  return {
    slotToleranceMm: source.slotToleranceMm,
    diagnosticToolLengthMm: source.diagnosticToolLengthMm,
    diagnosticToolRadiusMm: source.diagnosticToolRadiusMm,
    diagnosticInstallationClearanceMm: source.diagnosticInstallationClearanceMm,
    toolEvidence,
    ...(installationEvidence ? { installationEvidence } : {}),
  };
};

const currentSceneItems = (value: readonly unknown[]): No5ValidationSceneItem[] | null => {
  const items: No5ValidationSceneItem[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    const source = recordValue(entry);
    const id = String(source?.id ?? '').trim();
    const kind = String(source?.kind ?? '').trim();
    const position = Array.isArray(source?.position) ? source.position.slice(0, 3).map(Number) : [];
    const rotation = Array.isArray(source?.rotation) ? source.rotation.slice(0, 3).map(Number) : [];
    if (
      !source
      || !id
      || !kind
      || ids.has(id)
      || !finiteTriplet(position)
      || !finiteTriplet(rotation)
    ) return null;
    ids.add(id);
    items.push({
      ...source,
      id,
      kind,
      position,
      rotation,
    } as unknown as No5ValidationSceneItem);
  }
  return items;
};

/**
 * Verifies that a persisted No.5 report is internally intact and still
 * reproduces against the current scene. Reports created before geometry
 * signatures existed are deliberately stale, even when their old status says
 * `pass`; callers must run the validator again before release.
 */
export const inspectNo5ValidationCurrentness = (
  input: InspectNo5ValidationCurrentnessInput,
): No5ValidationCurrentnessResult => {
  const source = recordValue(input.report);
  const connectorInput = recordValue(input.connector);
  const connectorId = String(source?.connectorId ?? '').trim();
  const jointKey = String(source?.jointKey ?? '').trim();
  const storedSignature = String(source?.geometrySignature ?? '').trim();
  if (
    !source
    || source.ruleVersion !== NO5_VALIDATION_RULE_VERSION
    || !connectorId
    || !jointKey
    || !connectorInput
  ) return { current: false, reason: 'report_invalid' };
  if (!storedSignature) return { current: false, reason: 'signature_missing' };
  if (!/^no5g1-[0-9a-f]{8}-[0-9a-f]{8}$/.test(storedSignature)) {
    return { current: false, reason: 'report_invalid', storedSignature };
  }
  if (String(connectorInput.id ?? '').trim() !== connectorId) {
    return { current: false, reason: 'connector_identity_mismatch', storedSignature };
  }

  let signedContentSignature: string;
  try {
    signedContentSignature = geometrySignatureFor(source as unknown as No5SignatureSource);
  } catch {
    return { current: false, reason: 'report_invalid', storedSignature };
  }
  if (signedContentSignature !== storedSignature) {
    return {
      current: false,
      reason: 'report_content_mismatch',
      storedSignature,
      currentSignature: signedContentSignature,
    };
  }

  const validationParameters = validationParametersFromUnknown(source.validationParameters);
  if (!validationParameters) {
    return { current: false, reason: 'report_invalid', storedSignature };
  }
  const items = currentSceneItems(input.items);
  if (!items) return { current: false, reason: 'scene_invalid', storedSignature };
  const connector = items.find((item) => item.id === connectorId);
  if (!connector || connector.kind !== 'hidden_connector') {
    return { current: false, reason: 'connector_identity_mismatch', storedSignature };
  }

  let node: PhysicalConnectionNode | undefined;
  try {
    node = scanPhysicalConnectionNodes(items).find((entry) => entry.jointKey === jointKey);
  } catch {
    return { current: false, reason: 'scene_invalid', storedSignature };
  }
  if (!node) return { current: false, reason: 'node_missing', storedSignature };

  let currentReport: No5ValidationReport;
  try {
    currentReport = validateNo5HiddenConnector({
      node,
      connector,
      items,
      ...validationParameters,
    });
  } catch {
    return { current: false, reason: 'validation_failed', storedSignature };
  }
  return currentReport.geometrySignature === storedSignature
    ? {
      current: true,
      reason: 'current',
      storedSignature,
      currentSignature: currentReport.geometrySignature,
    }
    : {
      current: false,
      reason: 'signature_mismatch',
      storedSignature,
      currentSignature: currentReport.geometrySignature,
    };
};
