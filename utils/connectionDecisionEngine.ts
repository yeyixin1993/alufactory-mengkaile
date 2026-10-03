import * as THREE from 'three';
import type { DrillHole } from '../types';
import {
  getDesignerExtensionRegistrySnapshot,
  resolveLegacyDesignerExtension,
  type ConnectionExtension,
  type RegisteredDesignerExtension,
} from '../data/designerExtensionRegistry';

/**
 * Pure connection-decision core used by the designer and import pipelines.
 *
 * This module intentionally stops at proposals and impact scopes. It does not
 * create holes, choose screw dimensions, or mutate a scene. Those operations
 * stay in the existing validated geometry/manufacturing adapters.
 */

export type VerifiedConnectionMethod = 'corner_bracket' | 'slot_connector' | 'drill_tap';
export type ConnectionDecisionStatus = 'confirmed' | 'rejected';

export interface ConnectionDecisionSceneItem {
  readonly id: string;
  readonly kind: string;
  readonly position: readonly [number, number, number];
  readonly rotation: readonly [number, number, number];
  readonly variantId?: string;
  readonly length?: number;
  readonly holes?: readonly DrillHole[];
  readonly attachmentKey?: string;
  readonly attachedProfileIds?: readonly string[];
  readonly linkedProfileId?: string;
  readonly linkedHoleId?: string;
  readonly catalogItemId?: string;
}

export interface ConnectionDecisionScanOptions {
  /** Optional exact profile-ID scope. Arrays are accepted for JSON-friendly callers. */
  readonly profileIds?: ReadonlySet<string> | readonly string[];
  /** Optional prefix scope used by existing parametric product families. */
  readonly profileIdPrefix?: string;
}

export interface ConnectionHoleReference {
  readonly profileId: string;
  readonly holeId: string;
  readonly jointKey: string;
}

export interface InstalledConnectionEvidence {
  readonly method: VerifiedConnectionMethod;
  readonly sceneItemIds: readonly string[];
  readonly holes: readonly ConnectionHoleReference[];
  readonly linkedFastenerIds: readonly string[];
  readonly occurrenceCount: number;
}

export interface PhysicalConnectionNode {
  readonly id: string;
  readonly jointKey: string;
  readonly series: '2020' | '3030';
  readonly profileIds: readonly [string, string];
  readonly branchProfileId: string;
  readonly branchEnd: -1 | 1;
  readonly carrierProfileId: string;
  readonly carrierStationMm: number;
  readonly carrierThrough: boolean;
  readonly contactPointMm: readonly [number, number, number];
  readonly installed: Readonly<Record<VerifiedConnectionMethod, InstalledConnectionEvidence>>;
  readonly installedMethods: readonly VerifiedConnectionMethod[];
  readonly unsupportedConnectionItemIds: readonly string[];
}

export interface ConnectionProposal {
  readonly id: string;
  readonly nodeId: string;
  readonly jointKey: string;
  readonly method: VerifiedConnectionMethod;
  readonly connectionRuleId: string;
  readonly connectionRuleStatus: 'verified' | 'production';
  readonly exclusiveGroup: string;
  readonly idempotencyKey: string;
  readonly accessoryCatalogItemIds: readonly string[];
  readonly profileIds: readonly [string, string];
  readonly series: '2020' | '3030';
}

export interface ConnectionDecisionRecord {
  readonly schemaVersion: 1;
  /** Stable persistent identity: physical joint plus verified method. */
  readonly jointKey: string;
  readonly method: VerifiedConnectionMethod;
  readonly status: ConnectionDecisionStatus;
  /** Monotonic local revision; no clock is needed for deterministic replay. */
  readonly revision: number;
}

export type ConnectionDecisionAction =
  | Readonly<{ type: 'confirm'; proposalId: string }>
  | Readonly<{ type: 'reject'; proposalId: string }>
  | Readonly<{ type: 'replace'; proposalId: string; nodeId?: string }>;

export type ConnectionDecisionIssueCode =
  | 'DUPLICATE_INSTALLED_METHOD'
  | 'MULTIPLE_INSTALLED_METHODS'
  | 'UNSUPPORTED_CONNECTION_AT_NODE'
  | 'STALE_DECISION'
  | 'INVALID_DECISION'
  | 'INVALID_ACTION'
  | 'DECISION_GEOMETRY_MISMATCH';

export interface ConnectionDecisionIssue {
  readonly code: ConnectionDecisionIssueCode;
  readonly severity: 'warning' | 'blocking';
  readonly nodeId?: string;
  readonly proposalId?: string;
  readonly itemIds: readonly string[];
  readonly message: string;
}

export interface ConnectionProposalState extends ConnectionProposal {
  readonly state: 'available' | 'installed' | 'confirmed' | 'rejected';
  readonly installedOccurrenceCount: number;
}

export interface ConnectionDecisionPlan {
  readonly schema: 'mengkaile-connection-decision-plan';
  readonly schemaVersion: 1;
  readonly registryRevision: number;
  readonly nodes: readonly PhysicalConnectionNode[];
  readonly proposals: readonly ConnectionProposalState[];
  readonly decisions: readonly ConnectionDecisionRecord[];
  /** Exactly zero or one selected proposal per physical node. */
  readonly selectedProposalByNode: Readonly<Record<string, string>>;
  readonly issues: readonly ConnectionDecisionIssue[];
}

export interface ConnectionDecisionImpact {
  readonly nodeIds: readonly string[];
  readonly profileIds: readonly string[];
  readonly attachmentKeyPrefixes: readonly string[];
  readonly previousMethod: VerifiedConnectionMethod | null;
  readonly nextMethod: VerifiedConnectionMethod | null;
  readonly holes: Readonly<{
    jointKeys: readonly string[];
    profileIds: readonly string[];
    existingHoleIds: readonly string[];
  }>;
  readonly fasteners: Readonly<{
    linkedHoleIds: readonly string[];
    existingSceneItemIds: readonly string[];
    requiresLinkedFastenerAdapter: boolean;
  }>;
  readonly bom: Readonly<{
    connectionRuleIds: readonly string[];
    accessoryCatalogItemIds: readonly string[];
    existingSceneItemIds: readonly string[];
    includeLinkedFasteners: boolean;
  }>;
}

export interface ConnectionDecisionActionResult {
  readonly changed: boolean;
  readonly decisions: readonly ConnectionDecisionRecord[];
  readonly plan: ConnectionDecisionPlan;
  readonly impact: ConnectionDecisionImpact | null;
  readonly issues: readonly ConnectionDecisionIssue[];
  readonly replacedProposalId?: string;
}

type ProfileBox = {
  item: ConnectionDecisionSceneItem;
  center: THREE.Vector3;
  axes: [THREE.Vector3, THREE.Vector3, THREE.Vector3];
  halfSizes: [number, number, number];
};

type Contact = {
  point: THREE.Vector3;
  firstEnd: -1 | 1 | null;
  secondEnd: -1 | 1 | null;
};

type JointCandidate = {
  key: string;
  series: '2020' | '3030';
  first: ConnectionDecisionSceneItem;
  second: ConnectionDecisionSceneItem;
  firstBox: ProfileBox;
  secondBox: ProfileBox;
  contact: Contact;
};

type ReducedConnection = {
  joint: JointCandidate;
  branchProfile: ConnectionDecisionSceneItem;
  branchEnd: -1 | 1;
  carrierProfile: ConnectionDecisionSceneItem;
  carrierStationMm: number;
  carrierThrough: boolean;
};

const VERIFIED_METHODS: readonly VerifiedConnectionMethod[] = [
  'corner_bracket',
  'slot_connector',
  'drill_tap',
];

const METHOD_BY_LEGACY_ITEM_KIND: Readonly<Record<string, VerifiedConnectionMethod | undefined>> = {
  connector: 'corner_bracket',
  hidden_connector: 'slot_connector',
};

const UNSUPPORTED_CONNECTION_KINDS = new Set([
  'extruded_connector',
  'l_connector',
  't_connector',
  'tee_connector',
]);

const CONTACT_TOLERANCE_MM = 1.5;
const PENETRATION_TOLERANCE_MM = 0.4;
const PERPENDICULAR_AXIS_DOT_LIMIT = 0.15;

const roundMillimetre = (value: number) => Number(value.toFixed(3)) || 0;
const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

const asExactProfileIds = (value: ConnectionDecisionScanOptions['profileIds']) => (
  value ? new Set(Array.isArray(value) ? value : [...value]) : null
);

const isFiniteTriplet = (value: readonly number[]) => (
  value.length === 3 && value.every((entry) => Number.isFinite(entry))
);

const exactSeries = (item: ConnectionDecisionSceneItem): '2020' | '3030' | null => {
  // Do not infer a production profile from an absent or approximate variant.
  // The existing import normalizer may supply a reviewed variant before this
  // core is called; raw legacy JSON remains readable but receives no proposal.
  const variant = item.variantId;
  return variant === '2020' || variant === '3030' ? variant : null;
};

const profileBoxFromItem = (item: ConnectionDecisionSceneItem): ProfileBox => {
  const series = exactSeries(item) || '2020';
  const moduleSizeMm = Number(series.slice(0, 2));
  const lengthMm = Math.max(20, Number(item.length) || 1000);
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(item.rotation[0]),
    THREE.MathUtils.degToRad(item.rotation[1]),
    THREE.MathUtils.degToRad(item.rotation[2]),
    'XYZ',
  ));
  return {
    item,
    center: new THREE.Vector3(...item.position),
    axes: [
      new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize(),
      new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize(),
      new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize(),
    ],
    halfSizes: [lengthMm / 2, moduleSizeMm / 2, moduleSizeMm / 2],
  };
};

const separatingAxes = (first: ProfileBox, second: ProfileBox) => [
  ...first.axes,
  ...second.axes,
  ...first.axes.flatMap((firstAxis) => second.axes.map((secondAxis) => (
    new THREE.Vector3().crossVectors(firstAxis, secondAxis)
  ))),
];

const projectedRadius = (box: ProfileBox, axis: THREE.Vector3) => box.axes.reduce(
  (sum, boxAxis, index) => sum + box.halfSizes[index] * Math.abs(boxAxis.dot(axis)),
  0,
);

const orientedBoxesOverlap = (first: ProfileBox, second: ProfileBox) => {
  const centerDelta = second.center.clone().sub(first.center);
  return separatingAxes(first, second).every((candidateAxis) => {
    if (candidateAxis.lengthSq() < 1e-8) return true;
    const axis = candidateAxis.clone().normalize();
    return Math.abs(centerDelta.dot(axis))
      < projectedRadius(first, axis) + projectedRadius(second, axis) - PENETRATION_TOLERANCE_MM;
  });
};

type FacePoint = [number, number];

/** Clip the branch's actual end rectangle to a carrier side face. */
const endFaceContact = (branch: ProfileBox, carrier: ProfileBox) => {
  const sideAxisIndex = Math.abs(branch.axes[0].dot(carrier.axes[1]))
    >= Math.abs(branch.axes[0].dot(carrier.axes[2])) ? 1 : 2;
  const normal = carrier.axes[sideAxisIndex];
  // A line/corner touch or two crossing side faces is not an end-to-side joint.
  if (Math.abs(branch.axes[0].dot(normal)) < 1 - 1e-5) return null;
  const tangentAxes = [carrier.axes[0], carrier.axes[sideAxisIndex === 1 ? 2 : 1]];
  const tangentHalfSizes = [carrier.halfSizes[0], carrier.halfSizes[sideAxisIndex === 1 ? 2 : 1]];
  const centerSide = branch.center.clone().sub(carrier.center).dot(normal) >= 0 ? 1 : -1;
  const end: -1 | 1 = branch.axes[0].dot(normal) * centerSide > 0 ? -1 : 1;
  const endpoint = branch.center.clone().addScaledVector(branch.axes[0], branch.halfSizes[0] * end);
  const faceCoordinate = carrier.halfSizes[sideAxisIndex] * centerSide;
  const gap = endpoint.clone().sub(carrier.center).dot(normal) - faceCoordinate;
  if (Math.abs(gap) > CONTACT_TOLERANCE_MM) return null;
  let polygon: FacePoint[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
    const corner = endpoint.clone()
      .addScaledVector(branch.axes[1], branch.halfSizes[1] * u)
      .addScaledVector(branch.axes[2], branch.halfSizes[2] * v)
      .sub(carrier.center);
    return [corner.dot(tangentAxes[0]), corner.dot(tangentAxes[1])];
  });
  for (const axis of [0, 1] as const) {
    for (const sign of [-1, 1]) {
      const limit = tangentHalfSizes[axis];
      const input = polygon;
      polygon = [];
      input.forEach((point, index) => {
        const previous = input[(index + input.length - 1) % input.length];
        const inside = sign * point[axis] <= limit;
        const previousInside = sign * previous[axis] <= limit;
        if (inside !== previousInside) {
          const ratio = (sign * limit - previous[axis]) / (point[axis] - previous[axis]);
          polygon.push([
            previous[0] + ratio * (point[0] - previous[0]),
            previous[1] + ratio * (point[1] - previous[1]),
          ]);
        }
        if (inside) polygon.push(point);
      });
    }
  }
  const twiceArea = Math.abs(polygon.reduce((sum, point, index) => {
    const next = polygon[(index + 1) % polygon.length];
    return sum + point[0] * next[1] - point[1] * next[0];
  }, 0));
  if (twiceArea <= PENETRATION_TOLERANCE_MM ** 2 * 2) return null;
  const point = carrier.center.clone().addScaledVector(normal, faceCoordinate + gap / 2);
  for (const axis of [0, 1] as const) {
    const coordinates = polygon.map((vertex) => vertex[axis]);
    point.addScaledVector(tangentAxes[axis], (Math.min(...coordinates) + Math.max(...coordinates)) / 2);
  }
  return { point, end };
};

const profileContact = (first: ProfileBox, second: ProfileBox): Contact | null => {
  if (orientedBoxesOverlap(first, second)) return null;
  const firstContact = endFaceContact(first, second);
  const secondContact = endFaceContact(second, first);
  if (!firstContact && !secondContact) return null;
  return {
    point: (firstContact || secondContact)!.point,
    firstEnd: firstContact?.end ?? null,
    secondEnd: secondContact?.end ?? null,
  };
};

const endpointSideAt = (
  box: ProfileBox,
  point: THREE.Vector3,
  moduleSizeMm: number,
): -1 | 1 | null => {
  const coordinate = point.clone().sub(box.center).dot(box.axes[0]);
  if (Math.abs(box.halfSizes[0] - Math.abs(coordinate)) > moduleSizeMm * 0.7) return null;
  return coordinate >= 0 ? 1 : -1;
};

const carrierRank = (box: ProfileBox) => {
  const axis = box.axes[0];
  return Math.abs(axis.y) * 100 + Math.abs(axis.x) * 10 + Math.abs(axis.z);
};

const scanJointCandidates = (
  items: readonly ConnectionDecisionSceneItem[],
  options: ConnectionDecisionScanOptions,
): JointCandidate[] => {
  const exactIds = asExactProfileIds(options.profileIds);
  const profiles = items.filter((item) => (
    item.kind === 'profile'
    && exactSeries(item) !== null
    && isFiniteTriplet(item.position)
    && isFiniteTriplet(item.rotation)
    && (!exactIds || exactIds.has(item.id))
    && (!options.profileIdPrefix || item.id.startsWith(options.profileIdPrefix))
  )).sort((a, b) => a.id.localeCompare(b.id));
  const joints: JointCandidate[] = [];
  profiles.forEach((first, firstIndex) => profiles.slice(firstIndex + 1).forEach((second) => {
    if (first.id === second.id) return;
    const firstSeries = exactSeries(first);
    const secondSeries = exactSeries(second);
    if (!firstSeries || firstSeries !== secondSeries) return;
    const firstBox = profileBoxFromItem(first);
    const secondBox = profileBoxFromItem(second);
    if (Math.abs(firstBox.axes[0].dot(secondBox.axes[0])) > PERPENDICULAR_AXIS_DOT_LIMIT) return;
    const contact = profileContact(firstBox, secondBox);
    if (!contact) return;
    joints.push({
      key: [first.id, second.id].sort().join(':JOINT:'),
      series: firstSeries,
      first,
      second,
      firstBox,
      secondBox,
      contact,
    });
  }));
  return joints;
};

const reduceToPhysicalConnections = (joints: readonly JointCandidate[]): ReducedConnection[] => {
  const candidates = joints.flatMap((joint): ReducedConnection[] => {
    const moduleSizeMm = Number(joint.series.slice(0, 2));
    const { firstEnd, secondEnd } = joint.contact;
    if (firstEnd === null && secondEnd === null) return [];

    let branchProfile: ConnectionDecisionSceneItem;
    let branchEnd: -1 | 1;
    let carrierProfile: ConnectionDecisionSceneItem;
    let carrierThrough = false;
    if (firstEnd !== null && secondEnd === null) {
      branchProfile = joint.first;
      branchEnd = firstEnd;
      carrierProfile = joint.second;
      carrierThrough = endpointSideAt(joint.secondBox, joint.contact.point, moduleSizeMm) === null;
    } else if (secondEnd !== null && firstEnd === null) {
      branchProfile = joint.second;
      branchEnd = secondEnd;
      carrierProfile = joint.first;
      carrierThrough = endpointSideAt(joint.firstBox, joint.contact.point, moduleSizeMm) === null;
    } else {
      const firstIsCarrier = carrierRank(joint.firstBox) >= carrierRank(joint.secondBox);
      carrierProfile = firstIsCarrier ? joint.first : joint.second;
      branchProfile = firstIsCarrier ? joint.second : joint.first;
      branchEnd = (firstIsCarrier ? secondEnd : firstEnd) || 1;
    }
    const carrierBox = carrierProfile.id === joint.first.id ? joint.firstBox : joint.secondBox;
    const carrierLengthMm = Math.max(20, Number(carrierProfile.length) || 1000);
    const carrierStationMm = THREE.MathUtils.clamp(
      joint.contact.point.clone().sub(carrierBox.center).dot(carrierBox.axes[0]) + carrierLengthMm / 2,
      0,
      carrierLengthMm,
    );
    return [{
      joint,
      branchProfile,
      branchEnd,
      carrierProfile,
      carrierStationMm,
      carrierThrough,
    }];
  });

  const chosenByBranchEnd = new Map<string, ReducedConnection>();
  candidates.sort((first, second) => {
    const firstKey = `${first.branchProfile.id}:${first.branchEnd}`;
    const secondKey = `${second.branchProfile.id}:${second.branchEnd}`;
    if (firstKey !== secondKey) return firstKey.localeCompare(secondKey);
    if (first.carrierThrough !== second.carrierThrough) return first.carrierThrough ? -1 : 1;
    const firstCarrierBox = first.carrierProfile.id === first.joint.first.id
      ? first.joint.firstBox
      : first.joint.secondBox;
    const secondCarrierBox = second.carrierProfile.id === second.joint.first.id
      ? second.joint.firstBox
      : second.joint.secondBox;
    const rankDifference = carrierRank(secondCarrierBox) - carrierRank(firstCarrierBox);
    if (Math.abs(rankDifference) > 0.1) return rankDifference;
    return first.joint.key.localeCompare(second.joint.key);
  }).forEach((candidate) => {
    const key = `${candidate.branchProfile.id}:${candidate.branchEnd}`;
    if (!chosenByBranchEnd.has(key)) chosenByBranchEnd.set(key, candidate);
  });
  return [...chosenByBranchEnd.values()].sort((a, b) => a.joint.key.localeCompare(b.joint.key));
};

const sameProfilePair = (
  attachedProfileIds: readonly string[] | undefined,
  profileIds: readonly [string, string],
) => {
  if (!attachedProfileIds || attachedProfileIds.length !== 2) return false;
  const attached = uniqueSorted(attachedProfileIds);
  return attached[0] === profileIds[0] && attached[1] === profileIds[1];
};

const itemAttachesToNode = (
  item: ConnectionDecisionSceneItem,
  jointKey: string,
  profileIds: readonly [string, string],
) => (
  item.attachmentKey === jointKey
  || item.attachmentKey?.startsWith(`${jointKey}:`)
  || sameProfilePair(item.attachedProfileIds, profileIds)
);

const emptyEvidence = (method: VerifiedConnectionMethod): InstalledConnectionEvidence => ({
  method,
  sceneItemIds: [],
  holes: [],
  linkedFastenerIds: [],
  occurrenceCount: 0,
});

const collectInstalledEvidence = (
  items: readonly ConnectionDecisionSceneItem[],
  jointKey: string,
  profileIds: readonly [string, string],
) => {
  const sceneItemIdsByMethod = new Map<VerifiedConnectionMethod, string[]>();
  VERIFIED_METHODS.forEach((method) => sceneItemIdsByMethod.set(method, []));
  const unsupportedConnectionItemIds: string[] = [];
  items.forEach((item) => {
    if (!itemAttachesToNode(item, jointKey, profileIds)) return;
    const mappedMethod = METHOD_BY_LEGACY_ITEM_KIND[item.kind];
    if (mappedMethod) sceneItemIdsByMethod.get(mappedMethod)!.push(item.id);
    else if (UNSUPPORTED_CONNECTION_KINDS.has(item.kind)) unsupportedConnectionItemIds.push(item.id);
  });

  const drillTapJointKey = `${jointKey}:DRILL-TAP`;
  const drillTapHoles: ConnectionHoleReference[] = items.flatMap((item) => (
    item.kind === 'profile'
      ? (item.holes || []).filter((hole) => hole.jointKey === drillTapJointKey).map((hole) => ({
        profileId: item.id,
        holeId: hole.id,
        jointKey: drillTapJointKey,
      }))
      : []
  ));
  const drillTapHoleKeys = new Set(drillTapHoles.map((hole) => `${hole.profileId}:${hole.holeId}`));
  const linkedFastenerIds = items.filter((item) => (
    item.kind === 'screw'
    && !!item.linkedProfileId
    && !!item.linkedHoleId
    && drillTapHoleKeys.has(`${item.linkedProfileId}:${item.linkedHoleId}`)
  )).map((item) => item.id);

  const entries = VERIFIED_METHODS.map((method) => {
    if (method === 'drill_tap') {
      return [method, {
        method,
        sceneItemIds: [] as string[],
        holes: drillTapHoles.sort((a, b) => (
          a.profileId.localeCompare(b.profileId) || a.holeId.localeCompare(b.holeId)
        )),
        linkedFastenerIds: uniqueSorted(linkedFastenerIds),
        occurrenceCount: drillTapHoles.length,
      } satisfies InstalledConnectionEvidence];
    }
    const sceneItemIds = uniqueSorted(sceneItemIdsByMethod.get(method) || []);
    return [method, {
      ...emptyEvidence(method),
      sceneItemIds,
      occurrenceCount: sceneItemIds.length,
    } satisfies InstalledConnectionEvidence];
  });
  const evidence = Object.fromEntries(entries) as unknown as Record<VerifiedConnectionMethod, InstalledConnectionEvidence>;

  return {
    evidence,
    unsupportedConnectionItemIds: uniqueSorted(unsupportedConnectionItemIds),
  };
};

export const scanPhysicalConnectionNodes = (
  items: readonly ConnectionDecisionSceneItem[],
  options: ConnectionDecisionScanOptions = {},
): PhysicalConnectionNode[] => reduceToPhysicalConnections(scanJointCandidates(items, options)).map((connection) => {
  const profileIds = [connection.joint.first.id, connection.joint.second.id]
    .sort((a, b) => a.localeCompare(b)) as [string, string];
  const installed = collectInstalledEvidence(items, connection.joint.key, profileIds);
  const installedMethods = VERIFIED_METHODS.filter((method) => installed.evidence[method].occurrenceCount > 0);
  return {
    id: connection.joint.key,
    jointKey: connection.joint.key,
    series: connection.joint.series,
    profileIds,
    branchProfileId: connection.branchProfile.id,
    branchEnd: connection.branchEnd,
    carrierProfileId: connection.carrierProfile.id,
    carrierStationMm: roundMillimetre(connection.carrierStationMm),
    carrierThrough: connection.carrierThrough,
    contactPointMm: [
      roundMillimetre(connection.joint.contact.point.x),
      roundMillimetre(connection.joint.contact.point.y),
      roundMillimetre(connection.joint.contact.point.z),
    ],
    installed: installed.evidence,
    installedMethods,
    unsupportedConnectionItemIds: installed.unsupportedConnectionItemIds,
  };
});

const isVerifiedConnectionExtension = (
  entry: RegisteredDesignerExtension | undefined,
): entry is RegisteredDesignerExtension<ConnectionExtension> => (
  entry?.entityType === 'connection' && (entry.status === 'verified' || entry.status === 'production')
);

const ruleForMethod = (method: VerifiedConnectionMethod) => {
  const entry = resolveLegacyDesignerExtension('connection_mode', method);
  if (!isVerifiedConnectionExtension(entry)) {
    throw new Error(`Verified connection rule is not registered for ${method}.`);
  }
  const rule = entry.connectionRule;
  if (
    rule.memberCount.min !== 2
    || rule.memberCount.max !== 2
    || !rule.requiresPhysicalContact
    || !rule.requiresPerpendicularAxes
    || rule.profileMatch !== 'same_exact_variant'
    || rule.idempotencyKeyStrategy !== 'physical_joint'
  ) {
    throw new Error(`Connection rule ${entry.id} no longer matches the validated physical-joint contract.`);
  }
  return entry;
};

const proposalFor = (node: PhysicalConnectionNode, method: VerifiedConnectionMethod): ConnectionProposal => {
  const entry = ruleForMethod(method);
  return {
    id: `${node.id}:PROPOSAL:${entry.id}`,
    nodeId: node.id,
    jointKey: node.jointKey,
    method,
    connectionRuleId: entry.id,
    connectionRuleStatus: entry.status === 'production' ? 'production' : 'verified',
    exclusiveGroup: entry.connectionRule.exclusiveGroup,
    idempotencyKey: node.jointKey,
    accessoryCatalogItemIds: [...entry.connectionRule.accessoryIds].sort((a, b) => a.localeCompare(b)),
    profileIds: node.profileIds,
    series: node.series,
  };
};

const canonicalizeDecisionInput = (
  input: unknown,
  proposals: readonly ConnectionProposal[],
) => {
  const proposalById = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const proposalByStableIdentity = new Map(proposals.map((proposal) => [
    `${proposal.jointKey}\u0000${proposal.method}`,
    proposal,
  ]));
  const canonicalByIdentity = new Map<string, { record: ConnectionDecisionRecord; inputIndex: number }>();
  const issues: ConnectionDecisionIssue[] = [];
  if (input == null) return { decisions: [] as ConnectionDecisionRecord[], issues };
  if (!Array.isArray(input)) {
    issues.push({
      code: 'INVALID_DECISION',
      severity: 'warning',
      itemIds: [],
      message: 'Ignored connection decisions because the saved value is not an array.',
    });
    return { decisions: [] as ConnectionDecisionRecord[], issues };
  }
  input.forEach((raw, inputIndex) => {
    if (!raw || typeof raw !== 'object') {
      issues.push({
        code: 'INVALID_DECISION',
        severity: 'warning',
        itemIds: [],
        message: `Ignored invalid connection decision at index ${inputIndex}.`,
      });
      return;
    }
    const source = raw as Partial<ConnectionDecisionRecord> & {
      proposalId?: unknown;
      nodeId?: unknown;
    };
    const savedJointKey = typeof source.jointKey === 'string'
      ? source.jointKey
      : typeof source.nodeId === 'string'
        ? source.nodeId
        : undefined;
    const proposal = typeof source.proposalId === 'string'
      ? proposalById.get(source.proposalId)
      : savedJointKey && VERIFIED_METHODS.includes(source.method as VerifiedConnectionMethod)
        ? proposalByStableIdentity.get(`${savedJointKey}\u0000${source.method}`)
        : undefined;
    if (!proposal) {
      issues.push({
        code: 'STALE_DECISION',
        severity: 'warning',
        nodeId: savedJointKey,
        proposalId: typeof source.proposalId === 'string' ? source.proposalId : undefined,
        itemIds: [],
        message: `Ignored a connection decision whose physical node or proposal no longer exists.`,
      });
      return;
    }
    if (source.status !== 'confirmed' && source.status !== 'rejected') {
      issues.push({
        code: 'INVALID_DECISION',
        severity: 'warning',
        nodeId: proposal.nodeId,
        proposalId: proposal.id,
        itemIds: [],
        message: `Ignored a connection decision with an unsupported status.`,
      });
      return;
    }
    const revision = Number.isFinite(source.revision) && Number(source.revision) >= 0
      ? Math.floor(Number(source.revision))
      : inputIndex;
    const record: ConnectionDecisionRecord = {
      schemaVersion: 1,
      jointKey: proposal.jointKey,
      method: proposal.method,
      status: source.status,
      revision,
    };
    const identity = `${record.jointKey}\u0000${record.method}`;
    const existing = canonicalByIdentity.get(identity);
    if (!existing || revision > existing.record.revision || (revision === existing.record.revision && inputIndex > existing.inputIndex)) {
      canonicalByIdentity.set(identity, { record, inputIndex });
    }
  });

  const byNode = new Map<string, ConnectionDecisionRecord[]>();
  canonicalByIdentity.forEach(({ record }) => {
    const records = byNode.get(record.jointKey) || [];
    records.push(record);
    byNode.set(record.jointKey, records);
  });
  byNode.forEach((records) => {
    const confirmed = records.filter((record) => record.status === 'confirmed').sort((a, b) => (
      b.revision - a.revision || a.method.localeCompare(b.method)
    ));
    confirmed.slice(1).forEach((record) => {
      canonicalByIdentity.set(`${record.jointKey}\u0000${record.method}`, {
        record: { ...record, status: 'rejected' },
        inputIndex: Number.MAX_SAFE_INTEGER,
      });
    });
  });
  const decisions = [...canonicalByIdentity.values()].map(({ record }) => record).sort((a, b) => (
    a.jointKey.localeCompare(b.jointKey) || a.method.localeCompare(b.method)
  ));
  return { decisions, issues };
};

const installedIssuesFor = (node: PhysicalConnectionNode): ConnectionDecisionIssue[] => {
  const issues: ConnectionDecisionIssue[] = [];
  VERIFIED_METHODS.forEach((method) => {
    const evidence = node.installed[method];
    if (evidence.occurrenceCount <= 1) return;
    issues.push({
      code: 'DUPLICATE_INSTALLED_METHOD',
      severity: 'blocking',
      nodeId: node.id,
      itemIds: uniqueSorted([
        ...evidence.sceneItemIds,
        ...evidence.holes.map((hole) => hole.holeId),
      ]),
      message: `Physical node ${node.id} contains ${evidence.occurrenceCount} occurrences of ${method}.`,
    });
  });
  if (node.installedMethods.length > 1) {
    issues.push({
      code: 'MULTIPLE_INSTALLED_METHODS',
      severity: 'blocking',
      nodeId: node.id,
      itemIds: uniqueSorted(node.installedMethods.flatMap((method) => [
        ...node.installed[method].sceneItemIds,
        ...node.installed[method].holes.map((hole) => hole.holeId),
      ])),
      message: `Physical node ${node.id} has mutually exclusive connection methods installed together.`,
    });
  }
  if (node.unsupportedConnectionItemIds.length) {
    issues.push({
      code: 'UNSUPPORTED_CONNECTION_AT_NODE',
      severity: 'warning',
      nodeId: node.id,
      itemIds: node.unsupportedConnectionItemIds,
      message: `Physical node ${node.id} includes connection items outside the verified No.1/No.5/drill-tap proposal set.`,
    });
  }
  return issues;
};

export const buildConnectionDecisionPlan = (
  items: readonly ConnectionDecisionSceneItem[],
  decisionsInput: unknown = [],
  options: ConnectionDecisionScanOptions = {},
): ConnectionDecisionPlan => {
  const nodes = scanPhysicalConnectionNodes(items, options);
  const proposals = nodes.flatMap((node) => VERIFIED_METHODS.map((method) => proposalFor(node, method)));
  const canonical = canonicalizeDecisionInput(decisionsInput, proposals);
  const proposalByIdentity = new Map(proposals.map((proposal) => [
    `${proposal.jointKey}\u0000${proposal.method}`,
    proposal,
  ]));
  const decisionByProposal = new Map(canonical.decisions.flatMap((decision) => {
    const proposal = proposalByIdentity.get(`${decision.jointKey}\u0000${decision.method}`);
    return proposal ? [[proposal.id, decision] as const] : [];
  }));
  const confirmedByNode = new Map(canonical.decisions.flatMap((decision) => {
    if (decision.status !== 'confirmed') return [];
    const proposal = proposalByIdentity.get(`${decision.jointKey}\u0000${decision.method}`);
    return proposal ? [[decision.jointKey, { decision, proposal }] as const] : [];
  }));
  const selectedProposalByNode: Record<string, string> = {};
  nodes.forEach((node) => {
    const confirmed = confirmedByNode.get(node.id);
    if (confirmed) {
      selectedProposalByNode[node.id] = confirmed.proposal.id;
      return;
    }
    if (node.installedMethods.length === 1) {
      const installed = proposals.find((proposal) => (
        proposal.nodeId === node.id && proposal.method === node.installedMethods[0]
      ));
      if (installed && decisionByProposal.get(installed.id)?.status !== 'rejected') {
        selectedProposalByNode[node.id] = installed.id;
      }
    }
  });

  const proposalStates: ConnectionProposalState[] = proposals.map((proposal) => {
    const decision = decisionByProposal.get(proposal.id);
    return {
      ...proposal,
      state: decision?.status
        || (nodes.find((node) => node.id === proposal.nodeId)?.installed[proposal.method].occurrenceCount
          ? 'installed'
          : 'available'),
      installedOccurrenceCount: nodes.find((node) => node.id === proposal.nodeId)
        ?.installed[proposal.method].occurrenceCount || 0,
    };
  });
  const issues = [
    ...canonical.issues,
    ...nodes.flatMap(installedIssuesFor),
  ];
  confirmedByNode.forEach(({ decision, proposal }, nodeId) => {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.installedMethods.length === 0) return;
    if (node.installedMethods.length === 1 && node.installedMethods[0] === decision.method) return;
    issues.push({
      code: 'DECISION_GEOMETRY_MISMATCH',
      severity: 'warning',
      nodeId,
      proposalId: proposal.id,
      itemIds: uniqueSorted(node.installedMethods.flatMap((method) => [
        ...node.installed[method].sceneItemIds,
        ...node.installed[method].holes.map((hole) => hole.holeId),
      ])),
      message: `The confirmed method for ${nodeId} still needs to be applied by the existing geometry adapter.`,
    });
  });
  return {
    schema: 'mengkaile-connection-decision-plan',
    schemaVersion: 1,
    registryRevision: getDesignerExtensionRegistrySnapshot().revision,
    nodes,
    proposals: proposalStates,
    decisions: canonical.decisions,
    selectedProposalByNode,
    issues,
  };
};

const selectedProposalForNode = (
  plan: ConnectionDecisionPlan,
  nodeId: string,
) => {
  const proposalId = plan.selectedProposalByNode[nodeId];
  return proposalId ? plan.proposals.find((proposal) => proposal.id === proposalId) || null : null;
};

const decisionImpact = (
  node: PhysicalConnectionNode,
  previous: ConnectionProposal | null,
  next: ConnectionProposal | null,
): ConnectionDecisionImpact => {
  const relevant = [previous, next].filter((proposal): proposal is ConnectionProposal => !!proposal);
  const drillTapInvolved = relevant.some((proposal) => proposal.method === 'drill_tap');
  const drillTapEvidence = node.installed.drill_tap;
  const existingConnectionItemIds = VERIFIED_METHODS.flatMap((method) => node.installed[method].sceneItemIds);
  return {
    nodeIds: [node.id],
    profileIds: [...node.profileIds],
    attachmentKeyPrefixes: [node.jointKey],
    previousMethod: previous?.method || null,
    nextMethod: next?.method || null,
    holes: {
      jointKeys: drillTapInvolved ? [`${node.jointKey}:DRILL-TAP`] : [],
      profileIds: drillTapInvolved ? [...node.profileIds] : [],
      existingHoleIds: drillTapInvolved
        ? uniqueSorted(drillTapEvidence.holes.map((hole) => hole.holeId))
        : [],
    },
    fasteners: {
      linkedHoleIds: drillTapInvolved
        ? uniqueSorted(drillTapEvidence.holes.map((hole) => hole.holeId))
        : [],
      existingSceneItemIds: drillTapInvolved ? drillTapEvidence.linkedFastenerIds : [],
      requiresLinkedFastenerAdapter: relevant.some((proposal) => proposal.method === 'drill_tap'),
    },
    bom: {
      connectionRuleIds: uniqueSorted(relevant.map((proposal) => proposal.connectionRuleId)),
      accessoryCatalogItemIds: uniqueSorted(relevant.flatMap((proposal) => proposal.accessoryCatalogItemIds)),
      existingSceneItemIds: uniqueSorted([
        ...existingConnectionItemIds,
        ...drillTapEvidence.linkedFastenerIds,
      ]),
      includeLinkedFasteners: drillTapInvolved,
    },
  };
};

const sameDecisionList = (
  first: readonly ConnectionDecisionRecord[],
  second: readonly ConnectionDecisionRecord[],
) => JSON.stringify(first) === JSON.stringify(second);

export const applyConnectionDecisionAction = (
  items: readonly ConnectionDecisionSceneItem[],
  decisionsInput: unknown,
  action: ConnectionDecisionAction,
  options: ConnectionDecisionScanOptions = {},
): ConnectionDecisionActionResult => {
  const before = buildConnectionDecisionPlan(items, decisionsInput, options);
  const proposal = before.proposals.find((candidate) => candidate.id === action.proposalId);
  const invalidAction = !proposal || (action.type === 'replace' && action.nodeId && action.nodeId !== proposal.nodeId);
  if (invalidAction) {
    const issue: ConnectionDecisionIssue = {
      code: 'INVALID_ACTION',
      severity: 'warning',
      nodeId: action.type === 'replace' ? action.nodeId : undefined,
      proposalId: action.proposalId,
      itemIds: [],
      message: 'The requested connection proposal is stale or does not belong to the supplied physical node.',
    };
    return {
      changed: false,
      decisions: before.decisions,
      plan: before,
      impact: null,
      issues: [...before.issues, issue],
    };
  }
  const node = before.nodes.find((candidate) => candidate.id === proposal.nodeId)!;
  const previous = selectedProposalForNode(before, node.id);
  const targetIdentity = `${proposal.jointKey}\u0000${proposal.method}`;
  const existingTarget = before.decisions.find((decision) => (
    `${decision.jointKey}\u0000${decision.method}` === targetIdentity
  ));
  const targetStatus: ConnectionDecisionStatus = action.type === 'reject' ? 'rejected' : 'confirmed';
  const otherConfirmed = before.decisions.some((decision) => (
    decision.jointKey === node.jointKey
    && decision.method !== proposal.method
    && decision.status === 'confirmed'
  ));
  if (existingTarget?.status === targetStatus && (targetStatus === 'rejected' || !otherConfirmed)) {
    return {
      changed: false,
      decisions: before.decisions,
      plan: before,
      impact: null,
      issues: before.issues,
    };
  }
  const nextRevision = before.decisions.reduce((max, decision) => Math.max(max, decision.revision), 0) + 1;
  const decisionByIdentity = new Map(before.decisions.map((decision) => [
    `${decision.jointKey}\u0000${decision.method}`,
    decision,
  ]));

  if (action.type === 'reject') {
    decisionByIdentity.set(targetIdentity, {
      schemaVersion: 1,
      jointKey: proposal.jointKey,
      method: proposal.method,
      status: 'rejected',
      revision: nextRevision,
    });
  } else {
    before.proposals.filter((candidate) => candidate.nodeId === node.id).forEach((candidate) => {
      const identity = `${candidate.jointKey}\u0000${candidate.method}`;
      const existing = decisionByIdentity.get(identity);
      if (!existing || existing.status !== 'confirmed' || candidate.id === proposal.id) return;
      decisionByIdentity.set(identity, {
        ...existing,
        status: 'rejected',
        revision: nextRevision,
      });
    });
    decisionByIdentity.set(targetIdentity, {
      schemaVersion: 1,
      jointKey: proposal.jointKey,
      method: proposal.method,
      status: 'confirmed',
      revision: nextRevision,
    });
  }

  const decisions = [...decisionByIdentity.values()].sort((a, b) => (
    a.jointKey.localeCompare(b.jointKey) || a.method.localeCompare(b.method)
  ));
  const after = buildConnectionDecisionPlan(items, decisions, options);
  const next = selectedProposalForNode(after, node.id);
  return {
    changed: !sameDecisionList(before.decisions, after.decisions),
    decisions: after.decisions,
    plan: after,
    impact: previous?.id === next?.id ? null : decisionImpact(node, previous, next),
    issues: after.issues,
    replacedProposalId: action.type === 'replace' && previous && previous.id !== proposal.id
      ? previous.id
      : undefined,
  };
};
