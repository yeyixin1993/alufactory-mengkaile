import assert from 'node:assert/strict';
import {
  scanPhysicalConnectionNodes,
  type ConnectionDecisionSceneItem,
} from '../utils/connectionDecisionEngine';
import {
  NO5_VALIDATION_RULE_VERSION,
  getNo5SlotCenteredOriginMm,
  inspectNo5ValidationCurrentness,
  validateNo5HiddenConnector,
  type No5ValidationSceneItem,
} from '../utils/no5HiddenConnectorValidation';

const profile = (
  id: string,
  position: [number, number, number],
  rotation: [number, number, number],
  length = 1000,
  variantId: '2020' | '3030' = '3030',
): No5ValidationSceneItem => ({
  id,
  kind: 'profile',
  position,
  rotation,
  variantId,
  length,
});

const carrier = profile('carrier', [0, 0, 0], [0, 0, 0]);
const branch = profile('branch', [0, 515, 0], [0, 0, 90]);
const baseItems = [carrier, branch];
const node = scanPhysicalConnectionNodes(baseItems as ConnectionDecisionSceneItem[])[0];
assert.ok(node, 'authoritative solver should resolve the fixture physical node');
assert.deepEqual(node.contactPointMm, [0, 15, 0]);

// The solver's contact is the branch end touching the carrier side, not the
// crossing of the two top-slot centrelines. The helper must solve both groove
// centres and preserve the already-resolved face depth.
const correctedOrigin = getNo5SlotCenteredOriginMm(
  [0, 15, 13.1],
  [0, 0, 0],
  '3030',
  [carrier, branch],
);
assert.deepEqual(correctedOrigin, [-6.3, -6.3, 13.1]);

const connector = (
  position: [number, number, number],
  overrides: Partial<No5ValidationSceneItem> = {},
): No5ValidationSceneItem => ({
  id: 'no5',
  kind: 'hidden_connector',
  position,
  rotation: [0, 0, 0],
  width: 42,
  height: 12.6,
  thickness: 4.2,
  accessoryProfileSize: '3030',
  attachedProfileIds: ['carrier', 'branch'],
  attachmentKey: `${node.jointKey}:SLOT-5:FACE-A`,
  ...overrides,
});

const validConnector = connector([...correctedOrigin] as [number, number, number]);
const validReport = validateNo5HiddenConnector({
  node,
  connector: validConnector,
  items: [...baseItems, validConnector],
});
assert.equal(validReport.ruleVersion, NO5_VALIDATION_RULE_VERSION);
assert.equal(validReport.connectorId, 'no5');
assert.equal(validReport.jointKey, node.jointKey);
assert.equal(validReport.status, 'pass');
assert.equal(validReport.manufacturingReady, true);
assert.equal(validReport.installationReady, true);
assert.equal(validReport.slotChecks.every((entry) => entry.status === 'pass'), true);
assert.equal(validReport.installationChecks.every((entry) => entry.status === 'pass'), true);
assert.equal(validReport.toolAccessRays.length, 2);
assert.match(validReport.geometrySignature, /^no5g1-[0-9a-f]{8}-[0-9a-f]{8}$/);
assert.deepEqual(validReport.validationParameters.toolEvidence, []);
assert.equal(inspectNo5ValidationCurrentness({
  report: validReport,
  connector: validConnector,
  items: [...baseItems, validConnector],
}).current, true, 'a freshly generated report must reproduce against the unchanged scene');
assert.equal(inspectNo5ValidationCurrentness({
  report: JSON.parse(JSON.stringify(validReport)),
  connector: JSON.parse(JSON.stringify(validConnector)),
  items: JSON.parse(JSON.stringify([...baseItems, validConnector])),
}).current, true, 'a signed report must remain reproducible after a normal JSON export/import round trip');

const oldUnsignedReport = { ...validReport } as Record<string, unknown>;
delete oldUnsignedReport.geometrySignature;
assert.equal(inspectNo5ValidationCurrentness({
  report: oldUnsignedReport,
  connector: validConnector,
  items: [...baseItems, validConnector],
}).reason, 'signature_missing', 'legacy imported reports must not be treated as current evidence');

const tamperedReport = structuredClone(validReport) as unknown as {
  geometrySignature: string;
  toolAccessRays: Array<{ originMm: number[] }>;
};
tamperedReport.toolAccessRays[0].originMm[0] += 1;
assert.equal(inspectNo5ValidationCurrentness({
  report: tamperedReport,
  connector: validConnector,
  items: [...baseItems, validConnector],
}).reason, 'report_content_mismatch', 'editing signed ray content must invalidate the report');

const movedConnector = { ...validConnector, position: [correctedOrigin[0] + 1, correctedOrigin[1], correctedOrigin[2]] };
const movedCurrentness = inspectNo5ValidationCurrentness({
  report: validReport,
  connector: movedConnector,
  items: [...baseItems, movedConnector],
});
assert.equal(movedCurrentness.current, false);
assert.equal(movedCurrentness.reason, 'signature_mismatch', 'moving the connector must stale its old geometry report');

const farUnrelatedPart = profile('far-unrelated-profile', [5000, 5000, 5000], [0, 0, 0], 100);
assert.equal(inspectNo5ValidationCurrentness({
  report: validReport,
  connector: validConnector,
  items: [...baseItems, validConnector, farUnrelatedPart],
}).current, true, 'an unrelated distant part must not invalidate an unchanged validation outcome');
assert.deepEqual(
  validReport.toolAccessRays.map((ray) => ({
    fastenerIndex: ray.fastenerIndex,
    originMm: ray.originMm,
    direction: ray.direction,
    requiredLengthMm: ray.requiredLengthMm,
    radiusMm: ray.radiusMm,
    clearanceConfirmed: ray.clearanceConfirmed,
    evidenceStatus: ray.evidenceStatus,
    sourceEvidenceKey: ray.sourceEvidenceKey,
  })),
  [
    {
      fastenerIndex: 0,
      originMm: [18.06, 0, 15.2],
      direction: [0, 0, 1],
      requiredLengthMm: 80,
      radiusMm: 12,
      clearanceConfirmed: true,
      evidenceStatus: 'derived_by_validator',
      sourceEvidenceKey: NO5_VALIDATION_RULE_VERSION,
    },
    {
      fastenerIndex: 1,
      originMm: [0, 18.06, 15.2],
      direction: [0, 0, 1],
      requiredLengthMm: 80,
      radiusMm: 12,
      clearanceConfirmed: true,
      evidenceStatus: 'derived_by_validator',
      sourceEvidenceKey: NO5_VALIDATION_RULE_VERSION,
    },
  ],
  'each physical socket must emit its own normalized world-space access ray',
);

const oldUncentredConnector = connector([0, 15, 13.1]);
const uncentredReport = validateNo5HiddenConnector({
  node,
  connector: oldUncentredConnector,
  items: [...baseItems, oldUncentredConnector],
});
assert.equal(uncentredReport.status, 'block');
assert.equal(uncentredReport.manufacturingReady, false);
assert.equal(
  uncentredReport.slotChecks.filter((entry) => entry.code.includes('SLOT_CENTERLINE')).every((entry) => entry.status === 'block'),
  true,
  'the former contact-centred candidate must not be mistaken for a slot-centred casting',
);

const offsetBranch = profile('branch', [0, 515, 2], [0, 0, 90]);
const nonCoplanarReport = validateNo5HiddenConnector({
  node,
  connector: validConnector,
  items: [carrier, offsetBranch, validConnector],
});
assert.equal(
  nonCoplanarReport.slotChecks.find((entry) => entry.code === 'NO5_COMMON_SLOT_PLANE')?.status,
  'block',
  'one casting must not bridge two non-coplanar slot faces',
);

const toolBlocker = profile('tool-blocker', [18, 0, 55], [0, 0, 0], 30);
const blockedToolReport = validateNo5HiddenConnector({
  node,
  connector: validConnector,
  items: [...baseItems, validConnector, toolBlocker],
});
assert.equal(blockedToolReport.status, 'block');
assert.equal(blockedToolReport.installationReady, false);
assert.equal(blockedToolReport.toolAccessRays[0].clear, false);
assert.equal(blockedToolReport.toolAccessRays[0].blockedByIds.includes('tool-blocker'), true);
assert.equal(
  blockedToolReport.installationChecks.find((entry) => entry.code === 'NO5_TOOL_ACCESS_1')?.status,
  'block',
  'a blocker inside a derived 80 x R12 mm corridor is a hard installation stop',
);

// A source-mesh handle/support must obstruct the same tool corridor as native
// geometry. Its local bounds need not be centred on the component origin.
const importedBlocker: No5ValidationSceneItem = {
  id: 'source-handle-obstacle', kind: 'imported_component',
  position: [28, -30, 55], rotation: [0, 0, 90],
  installBeforeIds: [validConnector.id],
  sourceMesh: { boundsMm: { min: [15, -5, -15], max: [45, 25, 15] } },
};
const importedBlockerReport = validateNo5HiddenConnector({
  node, connector: validConnector, items: [...baseItems, validConnector, importedBlocker],
});
assert.equal(importedBlockerReport.toolAccessRays[0].clear, false);
assert.equal(importedBlockerReport.toolAccessRays[0].blockedByIds.includes(importedBlocker.id), true,
  'rotated source-mesh local bounds must include their offset centre');
assert.equal(inspectNo5ValidationCurrentness({
  report: validReport, connector: validConnector, items: [...baseItems, validConnector, importedBlocker],
}).current, false, 'adding source hardware in a tool corridor invalidates an earlier clear report');

const screwAt = (y: number): No5ValidationSceneItem => ({
  id: 'other-joint-screw', kind: 'screw', position: [18, y, 13], rotation: [0, 0, 0],
  width: 10, height: 45, screwHead: 'socket_cylinder', accessoryProfileSize: '3030',
});
const shaftCrossing = validateNo5HiddenConnector({ node, connector: validConnector,
  items: [...baseItems, validConnector, screwAt(30)] });
assert.ok(shaftCrossing.issues.some(issue => issue.partIds.includes('other-joint-screw')),
  'a shaft extending 45 mm behind its head seat must obstruct the No.5 casting');
const screwBelow = validateNo5HiddenConnector({ node, connector: validConnector,
  items: [...baseItems, validConnector, screwAt(-25)] });
assert.equal(screwBelow.status, 'pass',
  'a screw wholly below the connector cannot create a false centred-box collision');

const importedLegacyConnector = connector([...correctedOrigin] as [number, number, number], {
  accessoryProfileSize: undefined,
  attachmentKey: node.jointKey,
});
const legacyReport = validateNo5HiddenConnector({
  node,
  connector: importedLegacyConnector,
  items: [...baseItems, importedLegacyConnector],
});
assert.equal(legacyReport.status, 'review');
assert.equal(legacyReport.installationReady, false);
assert.equal(legacyReport.toolAccessRays.every((ray) => ray.evidenceStatus === 'screening_only'), true);
assert.equal(legacyReport.toolAccessRays.every((ray) => ray.clearanceConfirmed === false), true);
assert.equal(
  legacyReport.installationChecks.filter((entry) => entry.code.includes('PATH')).every((entry) => entry.status === 'review'),
  true,
  'missing/legacy placement identity must not inherit validator-derived authority',
);

const catalogEvidenceReport = validateNo5HiddenConnector({
  node,
  connector: validConnector,
  items: [...baseItems, validConnector],
  toolEvidence: [
    {
      fastenerIndex: 0,
      requiredLengthMm: 70,
      radiusMm: 10,
      clearanceConfirmed: true,
      sourceEvidenceKey: 'tool.catalog.hex-key-v2',
    },
    {
      fastenerIndex: 1,
      requiredLengthMm: 70,
      radiusMm: 10,
      clearanceConfirmed: true,
      sourceEvidenceKey: 'tool.catalog.hex-key-v2',
    },
  ],
});
assert.equal(catalogEvidenceReport.status, 'pass');
assert.equal(catalogEvidenceReport.toolAccessRays.every((ray) => ray.evidenceStatus === 'confirmed'), true);
assert.equal(catalogEvidenceReport.toolAccessRays.every((ray) => ray.requiredLengthMm === 70), true);
assert.equal(catalogEvidenceReport.validationParameters.toolEvidence.length, 2);
assert.equal(inspectNo5ValidationCurrentness({
  report: catalogEvidenceReport,
  connector: validConnector,
  items: [...baseItems, validConnector],
}).current, true, 'catalog-confirmed dimensions must reproduce without being replaced by diagnostic defaults');

const carrier2020 = profile('carrier-2020', [0, 0, 0], [0, 0, 0], 1000, '2020');
const branch2020 = profile('branch-2020', [0, 510, 0], [0, 0, 90], 1000, '2020');
const node2020 = scanPhysicalConnectionNodes([carrier2020, branch2020] as ConnectionDecisionSceneItem[])[0];
assert.ok(node2020, 'authoritative solver should resolve the 2020 fixture');
const origin2020 = getNo5SlotCenteredOriginMm(
  [0, 10, 8.8],
  [0, 0, 0],
  '2020',
  [carrier2020, branch2020],
);
assert.deepEqual(origin2020, [-4.2, -4.2, 8.8]);
const connector2020: No5ValidationSceneItem = {
  id: 'no5-2020',
  kind: 'hidden_connector',
  position: origin2020,
  rotation: [0, 0, 0],
  width: 28,
  height: 8.4,
  thickness: 2.8,
  accessoryProfileSize: '2020',
  attachedProfileIds: ['carrier-2020', 'branch-2020'],
  attachmentKey: `${node2020.jointKey}:SLOT-5:FACE-A`,
};
const report2020 = validateNo5HiddenConnector({
  node: node2020,
  connector: connector2020,
  items: [carrier2020, branch2020, connector2020],
});
assert.equal(report2020.status, 'pass');
assert.equal(report2020.manufacturingReady, true);
assert.equal(report2020.installationReady, true);
assert.deepEqual(report2020.toolAccessRays.map((ray) => ray.originMm), [
  [12.04, 0, 10.2],
  [0, 12.04, 10.2],
]);

const negativeFeedBlocker = profile('feed-blocker-negative', [-250, 0, 13.1], [0, 0, 90], 100);
const positiveFeedBlocker = profile('feed-blocker-positive', [250, 0, 13.1], [0, 0, 90], 100);
const blockedFeedReport = validateNo5HiddenConnector({
  node,
  connector: validConnector,
  items: [...baseItems, validConnector, negativeFeedBlocker, positiveFeedBlocker],
});
assert.equal(
  blockedFeedReport.installationChecks.find((entry) => entry.code === 'NO5_CARRIER_SLOT_FEED_PATH')?.status,
  'block',
  'both blocked carrier ends must prevent validator-derived installation approval',
);
assert.equal(blockedFeedReport.installationReady, false);

console.log('No.5 hidden-connector slot, tool-access and installation-path validation passed.');
