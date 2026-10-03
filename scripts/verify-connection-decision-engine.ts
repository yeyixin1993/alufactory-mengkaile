import assert from 'node:assert/strict';
import {
  applyConnectionDecisionAction,
  buildConnectionDecisionPlan,
  scanPhysicalConnectionNodes,
  type ConnectionDecisionSceneItem,
} from '../utils/connectionDecisionEngine';

const profile = (
  id: string,
  position: [number, number, number],
  rotation: [number, number, number],
  variantId: string | undefined = '3030',
  length = 1000,
): ConnectionDecisionSceneItem => ({
  id,
  kind: 'profile',
  position,
  rotation,
  variantId,
  length,
});

const connector = (
  id: string,
  kind: 'connector' | 'hidden_connector' | 'l_connector',
  jointKey: string,
  attachedProfileIds: [string, string] = ['branch', 'carrier'],
): ConnectionDecisionSceneItem => ({
  id,
  kind,
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  attachmentKey: `${jointKey}:LEGACY:${id}`,
  attachedProfileIds,
});

const baseItems = [
  profile('carrier', [0, 0, 0], [0, 0, 0]),
  profile('branch', [0, 515, 0], [0, 0, 90]),
];

const nodes = scanPhysicalConnectionNodes(baseItems);
assert.equal(nodes.length, 1, 'one end-to-side physical contact should produce one node');
assert.equal(nodes[0].id, 'branch:JOINT:carrier');
assert.equal(nodes[0].branchProfileId, 'branch');
assert.equal(nodes[0].branchEnd, -1);
assert.equal(nodes[0].carrierProfileId, 'carrier');
assert.equal(nodes[0].carrierStationMm, 500);
assert.deepEqual(nodes[0].contactPointMm, [0, 15, 0]);
assert.deepEqual(
  scanPhysicalConnectionNodes([...baseItems].reverse()),
  nodes,
  'physical node identity and ordering must not depend on scene array order',
);

const bearingBeam = profile('bearing-beam', [0, 425, 165], [0, 0, 0], '3030', 360);
const bearingPost = profile('bearing-post', [165, 205, 165], [0, 0, 90], '3030', 410);
const bearingNode = scanPhysicalConnectionNodes([bearingBeam, bearingPost])[0];
assert.equal(bearingNode.branchProfileId, 'bearing-post', 'the real vertical end face must determine the branch, even near a horizontal rail end');
assert.equal(bearingNode.branchEnd, 1);
assert.equal(bearingNode.carrierProfileId, 'bearing-beam');
const cornerDepth = profile('corner-depth', [165, 425, 0], [0, -90, 0], '3030', 300);
const cornerNodes = scanPhysicalConnectionNodes([bearingBeam, bearingPost, cornerDepth]);
assert.equal(cornerNodes.length, 2, 'a real corner has the depth end and post end bearing on the width beam');
assert.ok(cornerNodes.every((node) => node.carrierProfileId === 'bearing-beam'));
assert.equal(scanPhysicalConnectionNodes([bearingPost, cornerDepth]).length, 0, 'a zero-area edge touch must not become a drilled or hidden joint');
assert.equal(scanPhysicalConnectionNodes([
  profile('lower-width', [0, 455, 135], [0, 0, 0], '3030', 300),
  profile('upper-depth', [165, 485, 0], [0, -90, 0], '3030', 300),
]).length, 0, 'stacked perpendicular side faces do not expose a mating profile end');
assert.equal(scanPhysicalConnectionNodes([
  bearingBeam, { ...bearingPost, position: [195, 205, 165] },
]).length, 0, 'an endpoint meeting only the carrier edge has no bearing area');

const initial = buildConnectionDecisionPlan(baseItems);
assert.equal(initial.schemaVersion, 1);
assert.equal(initial.nodes.length, 1);
assert.equal(initial.proposals.length, 3);
assert.deepEqual(initial.decisions, [], 'old JSON without a decision array remains valid');
assert.deepEqual(initial.selectedProposalByNode, {});
assert.equal(new Set(initial.proposals.map((proposal) => proposal.id)).size, 3);
assert.deepEqual(
  initial.proposals.map((proposal) => proposal.method),
  ['corner_bracket', 'slot_connector', 'drill_tap'],
);
assert.equal(initial.proposals.every((proposal) => proposal.idempotencyKey === nodes[0].jointKey), true);
assert.equal(initial.proposals.every((proposal) => (
  proposal.exclusiveGroup === 'mengkaile.connection.primary_joint_method'
)), true);
assert.deepEqual(
  initial.proposals.find((proposal) => proposal.method === 'corner_bracket')?.accessoryCatalogItemIds,
  ['mengkaile.accessory.corner_bracket_no1'],
);
assert.deepEqual(
  initial.proposals.find((proposal) => proposal.method === 'slot_connector')?.accessoryCatalogItemIds,
  ['mengkaile.accessory.hidden_connector_no5'],
);
assert.deepEqual(
  initial.proposals.find((proposal) => proposal.method === 'drill_tap')?.accessoryCatalogItemIds,
  [],
  'drill/tap must not invent a fastener SKU outside the existing adapter',
);

const cornerProposal = initial.proposals.find((proposal) => proposal.method === 'corner_bracket')!;
const hiddenProposal = initial.proposals.find((proposal) => proposal.method === 'slot_connector')!;
const drillProposal = initial.proposals.find((proposal) => proposal.method === 'drill_tap')!;

const confirmed = applyConnectionDecisionAction(baseItems, undefined, {
  type: 'confirm',
  proposalId: cornerProposal.id,
});
assert.equal(confirmed.changed, true);
assert.equal(confirmed.decisions.filter((decision) => decision.status === 'confirmed').length, 1);
assert.equal(confirmed.plan.selectedProposalByNode[nodes[0].id], cornerProposal.id);
assert.equal(confirmed.impact?.previousMethod, null);
assert.equal(confirmed.impact?.nextMethod, 'corner_bracket');
assert.deepEqual(confirmed.impact?.holes.jointKeys, []);
assert.deepEqual(confirmed.impact?.bom.accessoryCatalogItemIds, [
  'mengkaile.accessory.corner_bracket_no1',
]);
assert.deepEqual(
  Object.keys(confirmed.decisions[0]).sort(),
  ['jointKey', 'method', 'revision', 'schemaVersion', 'status'],
  'saved decision identity must stay limited to the stable physical joint and method',
);
const confirmedAgain = applyConnectionDecisionAction(baseItems, confirmed.decisions, {
  type: 'confirm',
  proposalId: cornerProposal.id,
});
assert.equal(confirmedAgain.changed, false, 'repeating the same confirmation must be idempotent');
assert.deepEqual(confirmedAgain.decisions, confirmed.decisions);

const replaced = applyConnectionDecisionAction(baseItems, confirmed.decisions, {
  type: 'replace',
  nodeId: nodes[0].id,
  proposalId: drillProposal.id,
});
assert.equal(replaced.changed, true);
assert.equal(replaced.replacedProposalId, cornerProposal.id);
assert.equal(replaced.plan.selectedProposalByNode[nodes[0].id], drillProposal.id);
assert.equal(replaced.decisions.filter((decision) => decision.status === 'confirmed').length, 1);
assert.equal(replaced.decisions.find((decision) => decision.method === 'corner_bracket')?.status, 'rejected');
assert.deepEqual(replaced.impact?.holes.jointKeys, [`${nodes[0].jointKey}:DRILL-TAP`]);
assert.equal(replaced.impact?.fasteners.requiresLinkedFastenerAdapter, true);
assert.deepEqual(replaced.impact?.bom.connectionRuleIds, [
  'mengkaile.connection.corner_bracket',
  'mengkaile.connection.drill_tap',
]);

const rejected = applyConnectionDecisionAction(baseItems, replaced.decisions, {
  type: 'reject',
  proposalId: drillProposal.id,
});
assert.equal(rejected.plan.selectedProposalByNode[nodes[0].id], undefined);
assert.equal(rejected.impact?.previousMethod, 'drill_tap');
assert.equal(rejected.impact?.nextMethod, null);

const confirmedHidden = applyConnectionDecisionAction(baseItems, rejected.decisions, {
  type: 'confirm',
  proposalId: hiddenProposal.id,
});
assert.equal(confirmedHidden.plan.selectedProposalByNode[nodes[0].id], hiddenProposal.id);
assert.equal(confirmedHidden.decisions.filter((decision) => decision.status === 'confirmed').length, 1);

const invalidReplace = applyConnectionDecisionAction(baseItems, confirmedHidden.decisions, {
  type: 'replace',
  nodeId: 'another-node',
  proposalId: cornerProposal.id,
});
assert.equal(invalidReplace.changed, false);
assert.equal(invalidReplace.impact, null);
assert.equal(invalidReplace.issues.some((issue) => issue.code === 'INVALID_ACTION'), true);

const conflictingSavedDecisions = buildConnectionDecisionPlan(baseItems, [
  {
    jointKey: nodes[0].jointKey,
    method: 'corner_bracket',
    status: 'confirmed',
    revision: 4,
  },
  {
    jointKey: nodes[0].jointKey,
    method: 'drill_tap',
    status: 'confirmed',
    revision: 5,
  },
]);
assert.equal(conflictingSavedDecisions.decisions.filter((decision) => decision.status === 'confirmed').length, 1);
assert.equal(conflictingSavedDecisions.selectedProposalByNode[nodes[0].id], drillProposal.id);
assert.equal(
  conflictingSavedDecisions.decisions.find((decision) => decision.method === 'corner_bracket')?.status,
  'rejected',
  'mutual exclusion must normalize older conflicting decision arrays',
);

const jointKey = nodes[0].jointKey;
const legacyConnectorItems = [...baseItems, connector('corner-1', 'connector', jointKey)];
const legacyConnectorPlan = buildConnectionDecisionPlan(legacyConnectorItems);
assert.deepEqual(legacyConnectorPlan.nodes[0].installedMethods, ['corner_bracket']);
assert.equal(legacyConnectorPlan.selectedProposalByNode[nodes[0].id], cornerProposal.id);
assert.equal(
  legacyConnectorPlan.proposals.find((proposal) => proposal.method === 'corner_bracket')?.state,
  'installed',
);
const rejectInstalled = applyConnectionDecisionAction(legacyConnectorItems, [], {
  type: 'reject',
  proposalId: cornerProposal.id,
});
assert.equal(rejectInstalled.plan.selectedProposalByNode[nodes[0].id], undefined);
assert.equal(rejectInstalled.impact?.previousMethod, 'corner_bracket');
assert.equal(rejectInstalled.impact?.nextMethod, null);

const attachedPairOnly: ConnectionDecisionSceneItem = {
  ...connector('hidden-pair-only', 'hidden_connector', 'nonmatching-key'),
  attachmentKey: undefined,
};
const pairOnlyPlan = buildConnectionDecisionPlan([...baseItems, attachedPairOnly]);
assert.deepEqual(pairOnlyPlan.nodes[0].installedMethods, ['slot_connector']);

const duplicatePlan = buildConnectionDecisionPlan([
  ...legacyConnectorItems,
  connector('corner-2', 'connector', jointKey),
]);
assert.equal(duplicatePlan.nodes[0].installed.corner_bracket.occurrenceCount, 2);
assert.equal(duplicatePlan.issues.some((issue) => issue.code === 'DUPLICATE_INSTALLED_METHOD'), true);

const drillHoleId = 'legacy-drill-hole';
const legacyDrillItems: ConnectionDecisionSceneItem[] = [
  {
    ...baseItems[0],
    holes: [{
      id: drillHoleId,
      side: 'B',
      positionMm: 500,
      type: 'countersunk',
      jointKey: `${jointKey}:DRILL-TAP`,
    }],
  },
  baseItems[1],
  {
    id: 'legacy-linked-screw',
    kind: 'screw',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    linkedProfileId: 'carrier',
    linkedHoleId: drillHoleId,
  },
];
const legacyDrillPlan = buildConnectionDecisionPlan(legacyDrillItems);
assert.deepEqual(legacyDrillPlan.nodes[0].installedMethods, ['drill_tap']);
const replaceLegacyDrill = applyConnectionDecisionAction(legacyDrillItems, [], {
  type: 'replace',
  proposalId: cornerProposal.id,
});
assert.deepEqual(replaceLegacyDrill.impact?.holes.existingHoleIds, [drillHoleId]);
assert.deepEqual(replaceLegacyDrill.impact?.fasteners.existingSceneItemIds, ['legacy-linked-screw']);
assert.equal(replaceLegacyDrill.impact?.bom.includeLinkedFasteners, true);

const conflictingGeometry = buildConnectionDecisionPlan([
  ...legacyDrillItems,
  connector('hidden-with-drill', 'hidden_connector', jointKey),
  connector('unsupported-l', 'l_connector', jointKey),
]);
assert.equal(conflictingGeometry.issues.some((issue) => issue.code === 'MULTIPLE_INSTALLED_METHODS'), true);
assert.equal(conflictingGeometry.issues.some((issue) => issue.code === 'UNSUPPORTED_CONNECTION_AT_NODE'), true);

assert.equal(scanPhysicalConnectionNodes([
  profile('mixed-a', [0, 0, 0], [0, 0, 0], '2020'),
  profile('mixed-b', [0, 510, 0], [0, 0, 90], '3030'),
]).length, 0, 'mixed exact variants are not compatible');
assert.equal(scanPhysicalConnectionNodes([
  profile('unsupported-a', [0, 0, 0], [0, 0, 0], '4040'),
  profile('unsupported-b', [0, 520, 0], [0, 0, 90], '4040'),
]).length, 0, 'unverified 4040 connections must not receive proposals');
assert.equal(scanPhysicalConnectionNodes([
  profile('parallel-a', [0, 0, 0], [0, 0, 0]),
  profile('parallel-b', [0, 30, 0], [0, 0, 0]),
]).length, 0, 'parallel profiles are not verified perpendicular joints');
assert.equal(scanPhysicalConnectionNodes([
  profile('overlap-a', [0, 0, 0], [0, 0, 0]),
  profile('overlap-b', [0, 500, 0], [0, 0, 90]),
]).length, 0, 'penetrating profiles are not physical surface-contact nodes');

const legacyDefault2020 = scanPhysicalConnectionNodes([
  { ...profile('legacy-carrier', [0, 0, 0], [0, 0, 0], '2020'), variantId: undefined },
  { ...profile('legacy-branch', [0, 510, 0], [0, 0, 90], '2020'), variantId: undefined },
]);
assert.equal(legacyDefault2020.length, 0, 'raw legacy JSON without a reviewed variant must not invent one');

const threeWay = scanPhysicalConnectionNodes([
  profile('upright', [0, 500, 0], [0, 0, 90]),
  profile('width-rail', [515, 15, 0], [0, 0, 0]),
  profile('depth-rail', [0, 15, 515], [0, -90, 0]),
]);
assert.equal(threeWay.length, 2, 'three-member corner must collapse the false pairwise duplicate');
assert.equal(new Set(threeWay.map((node) => `${node.branchProfileId}:${node.branchEnd}`)).size, 2);

const scoped = scanPhysicalConnectionNodes([
  ...baseItems,
  profile('outside-carrier', [3000, 0, 0], [0, 0, 0]),
  profile('outside-branch', [3000, 515, 0], [0, 0, 90]),
], { profileIds: ['branch', 'carrier'] });
assert.equal(scoped.length, 1);
assert.equal(scoped[0].id, jointKey);

console.log('connection decision engine verification passed');
