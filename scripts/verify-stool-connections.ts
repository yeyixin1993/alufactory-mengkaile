import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Box3, Euler, Vector3 } from 'three';
import { buildStoolTemplateFromAsset, buildStoolSourceTemplateFromAsset, STOOL_BASELINE, type StoolSourceAsset } from '../utils/parametricStool';
import { STOOL_CONTINUOUS_WIDTH_RAIL_IDS } from '../utils/stoolConnections';
import { normalizeDesignItems, completeStoolConnectionSystem, inspectGuidedConnectionSystem,
  synchronizeDesignerSceneItems, inspectDesignerManufacturingPrecheck, buildDesignDocument } from '../components/DIYDesigner';
import { scanPhysicalConnectionNodes } from '../utils/connectionDecisionEngine';
import { createDesignSourceInfo } from '../utils/designSource';
import { rekeyImportedDesignItems } from '../utils/designerImportRemap';
import type { No5ValidationReport } from '../utils/no5HiddenConnectorValidation';

const asset = JSON.parse(fs.readFileSync('public/models/stool/source-v1.json', 'utf8')) as StoolSourceAsset;
const originalAsset = JSON.stringify(asset);
const near = (actual: number, expected: number, label: string) =>
  assert.ok(Math.abs(actual - expected) <= 0.002, `${label}: ${actual} != ${expected}`);
const euler = (rotation: readonly number[]) => new Euler(rotation[0] * Math.PI / 180,
  rotation[1] * Math.PI / 180, rotation[2] * Math.PI / 180, 'XYZ');
const axisOf = (item: { rotation: readonly number[] }, axis = 0) =>
  new Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0).applyEuler(euler(item.rotation));
const failures: string[] = [];
const reports: Record<string, unknown>[] = [];
const writeArtifacts = process.argv.includes('--write-artifacts');
const artifactDirectory = process.argv.find(argument => argument.startsWith('--output-dir='))?.slice('--output-dir='.length)
  || 'outputs/stool-product-20260930';
for (const dimensions of [STOOL_BASELINE, { widthMm: 600, depthMm: 600, heightMm: 800 },
  { widthMm: 450, depthMm: 520, heightMm: 650 }, { widthMm: 481, depthMm: 427, heightMm: 637 }]) {
  const label = `${dimensions.widthMm}x${dimensions.depthMm}x${dimensions.heightMm}`;
  const original = buildStoolSourceTemplateFromAsset(dimensions, asset).items;
  const originalById = new Map(original.map(item => [item.id, item]));
  const prepared = buildStoolTemplateFromAsset(dimensions, asset).items;
  assert.equal(prepared.length, 75, `${label} 34 native members and 41 retained source components`);
  assert.equal(prepared.filter(item => item.kind === 'profile').length, 32);
  assert.equal(prepared.filter(item => item.sourceMesh).length, 41);
  assert.ok(prepared.every(item => !['three_way', 'angle_bracket'].includes(item.sourceMesh?.source.semanticType || '')));
  const extended = new Set<string>(STOOL_CONTINUOUS_WIDTH_RAIL_IDS);
  const lengthBefore = original.reduce((sum, item) => sum + (item.kind === 'profile' ? item.length || 0 : 0), 0);
  const lengthAfter = prepared.reduce((sum, item) => sum + (item.kind === 'profile' ? item.length || 0 : 0), 0);
  near(lengthAfter - lengthBefore, 360, `${label} six original corner gaps become continuous rails`);
  prepared.filter(item => item.kind === 'profile').forEach(item => {
    const old = originalById.get(item.id)!;
    near(item.length!, old.length! + (extended.has(item.id) ? 60 : 0), `${label} native cut length ${item.id}`);
    assert.deepEqual(item.position, old.position);
    assert.deepEqual(item.holes, []);
    assert.equal(item.tappingLeft, false);
    assert.equal(item.tappingRight, false);
  });
  // The source blocks contact the retained middle-rail section, not its new ends.
  for (const support of prepared.filter(item => item.sourceMesh?.source.semanticType === 'fixed_support')) {
    const old = originalById.get(support.id)!;
    assert.deepEqual(support.position, old.position);
    assert.deepEqual(support.rotation, old.rotation);
    assert.deepEqual(support.sourceMesh!.positionsMm, old.sourceMesh!.positionsMm);
    if (!/instances-[56]-instances-/.test(support.id)) continue;
    const mesh = support.sourceMesh!;
    const box = new Box3();
    for (let i = 0; i < mesh.positionsMm.length; i += 3) {
      box.expandByPoint(new Vector3(mesh.positionsMm[i], mesh.positionsMm[i + 1], mesh.positionsMm[i + 2])
        .applyEuler(euler(support.rotation)).add(new Vector3(...support.position)));
    }
    const retainedHalfLength = (dimensions.widthMm - 120) / 2;
    assert.ok(box.min.x > -retainedHalfLength && box.max.x < retainedHalfLength,
      `${label} fixed support lies wholly within the original middle-rail length`);
  }
  const items = normalizeDesignItems(prepared);
  const scope = new Set(items.filter(item => item.kind === 'profile').map(item => item.id));
  const nodes = scanPhysicalConnectionNodes(items, { profileIds: scope });
  assert.equal(nodes.length, 48, `${label} real end-face connections`);
  assert.equal(new Set(nodes.flatMap(node => [...node.profileIds])).size, 32);
  assert.equal(nodes.filter(node => node.branchProfileId.includes('decor-divider')).length, 16);
  assert.equal(nodes.filter(node => node.branchProfileId.includes('-leg-')).length, 4);
  assert.ok(nodes.filter(node => node.branchProfileId.includes('-leg-')).every(node =>
    /fixed-top-(front|rear)$/.test(node.carrierProfileId)), 'leg tops bear on the continuous width rails');
  const completed = completeStoolConnectionSystem(items);
  assert.equal(completed.check.scope, 'native_frame_nodes');
  assert.equal(completed.assemblyReview.complete, false, 'frame success never implies complete stool fastening');
  assert.equal(completed.assemblyReview.totals.supports, 16);
  assert.equal(completed.assemblyReview.totals.matchedMounts, 32);
  assert.equal(completed.assemblyReview.totals.candidateScrews, 32);
  assert.equal(completed.assemblyReview.totals.candidateNuts, 32);
  assert.equal(completed.items.length, 123, 'unverified candidates are not fabricated as installed hardware');
  const synchronized = synchronizeDesignerSceneItems(completed.items);
  const inspection = inspectGuidedConnectionSystem(synchronized, scope);
  const hiddenCount = synchronized.filter(item => item.kind === 'hidden_connector').length;
  const holeCount = synchronized.reduce((count, item) => count + (item.kind === 'profile' ? item.holes?.length || 0 : 0), 0);
  console.log(JSON.stringify({ dimensions: label, hiddenCount, holeCount, ...inspection, issues: inspection.issues.slice(0, 2) }));
  if (process.env.STOOL_CONNECTION_DIAGNOSTIC && dimensions === STOOL_BASELINE) {
    for (const item of synchronized.filter(item => item.kind === 'hidden_connector')) {
      const report = item.no5Validation as No5ValidationReport | undefined;
      const blocked = report?.slotChecks.find(check => check.code === 'NO5_CASTING_OBSTRUCTION' && check.status === 'block');
      if (!blocked) continue;
      console.log(JSON.stringify({ joint: item.attachedProfileIds, obstruction: blocked,
        parts: blocked.partIds.map(id => synchronized.find(part => part.id === id)).map(part =>
          part && ({ id: part.id, kind: part.kind, position: part.position, rotation: part.rotation,
            width: part.width, height: part.height, thickness: part.thickness, linkedProfileId: part.linkedProfileId })) }));
    }
  }
  assert.equal(synchronized.filter(item => item.kind === 'connector').length, 0, 'No.1 is never an automatic fallback');
  if (!completed.check.valid || !inspection.valid) { failures.push(`${label}: ${inspection.issues.join('; ')}`); continue; }
  assert.equal(hiddenCount + holeCount, 48);
  assert.equal(synchronized.filter(item => item.kind === 'screw').length, holeCount);
  const internalHoles = synchronized.flatMap(item => (item.holes || [])
    .filter(hole => hole.fastenerSeat === 'internal_slot').map(hole => ({ profile: item, hole })));
  assert.equal(internalHoles.length, 8, 'only the eight obstructing screw heads change seating method');
  for (const { profile, hole } of internalHoles) {
    assert.equal(hole.type, 'through');
    assert.equal(hole.threadSize, 'M8');
    assert.equal(hole.fastenerHead, 'button_socket');
    assert.equal(hole.fastenerLengthMm, 20);
    const screw = synchronized.find(item => item.linkedProfileId === profile.id && item.linkedHoleId === hole.id)!;
    assert.ok(screw.installBeforeIds?.length);
    assert.ok(screw.installBeforeIds!.every(id => synchronized.find(item => item.id === id)?.installAfterIds?.includes(screw.id)),
      'the internal screw must be tightened before its neighboring No.5');
  }
  const finalNodes = scanPhysicalConnectionNodes(synchronized, { profileIds: scope });
  for (const node of finalNodes) {
    assert.equal(node.installedMethods.length, 1, `${label} every node has exactly one method`);
    if (!node.installedMethods.includes('drill_tap')) continue;
    assert.equal(node.installed.drill_tap.occurrenceCount, 1);
    const branch = synchronized.find(item => item.id === node.branchProfileId)!;
    const carrier = synchronized.find(item => item.id === node.carrierProfileId)!;
    const hole = carrier.holes!.find(entry => entry.jointKey === `${node.jointKey}:DRILL-TAP`)!;
    assert.ok(hole, 'the side hole must be on the real carrier');
    assert.ok(node.branchEnd < 0 ? branch.tappingLeft : branch.tappingRight, 'the real receiving end is tapped');
    const branchEnd = new Vector3(...branch.position).addScaledVector(axisOf(branch), branch.length! * node.branchEnd / 2);
    const holeCenter = new Vector3(...carrier.position).addScaledVector(axisOf(carrier), hole.positionMm - carrier.length! / 2);
    const sideNormal = (hole.side === 'A' ? new Vector3(0, 1, 0) : hole.side === 'C' ? new Vector3(0, -1, 0)
      : hole.side === 'B' ? new Vector3(0, 0, 1) : new Vector3(0, 0, -1)).applyEuler(euler(carrier.rotation));
    assert.ok(Number.isInteger(hole.positionMm), `${label} machining station uses whole millimetres`);
    assert.ok(branchEnd.clone().sub(holeCenter).cross(sideNormal).length() <= 0.500001,
      `${label} whole-mm station differs from source contact by at most half a millimetre; draft remains blocked`);
    const screw = synchronized.find(item => item.kind === 'screw' && item.linkedProfileId === carrier.id && item.linkedHoleId === hole.id)!;
    assert.ok(screw, 'one real linked screw is created');
    near(new Vector3(...screw.position).sub(holeCenter).cross(sideNormal).length(), 0,
      `${label} linked screw retains fractional hole station`);
  }
  const again = completeStoolConnectionSystem(synchronized);
  assert.equal(again.check.valid, true);
  assert.equal(again.items.length, synchronized.length, 'completion is idempotent');
  const source = createDesignSourceInfo('parametric_template', { modelName: '复古边几凳' });
  const document = buildDesignDocument(synchronized, 'cn', source);
  assert.ok('productionRelease' in document);
  assert.equal(document.productionRelease.blocking.length, 0,
    'A complete native connection system has no computed assembly failure');
  assert.equal(document.productionRelease.status, 'requires_acknowledgement',
    'Connection completeness never releases the source mechanism/load rating — that statement has to be accepted first');
  assert.equal('production' in document, false, 'An unaccepted design carries no production projection');
  assert.equal(document.stoolAssemblyReview?.totals.mounts, 32, 'editable export includes the recomputed whole-assembly review');
  assert.equal(document.stoolAssemblyReview?.complete, false);
  const accepted = buildDesignDocument(synchronized, 'cn', source, null, {
    manufacturingAcknowledgement: {
      advisories: document.productionRelease.advisories,
      acknowledgedAt: '2026-10-03T00:00:00.000Z',
    },
  });
  assert.equal(accepted.productionRelease.status, 'acknowledged',
    'Accepting the outstanding statements releases the design without claiming they were verified');
  assert.ok('production' in accepted, 'An accepted design ships its production projection');
  const reopened = synchronizeDesignerSceneItems(normalizeDesignItems(JSON.parse(JSON.stringify(document)).items));
  assert.equal(inspectGuidedConnectionSystem(reopened, scope).valid, true, 'saved connections remain valid on reopening');
  assert.ok(inspectDesignerManufacturingPrecheck(reopened).scopes.includes('parametric_stool_draft'));
  for (const connector of synchronized.filter(item => item.kind === 'hidden_connector')) {
    const restored = reopened.find(item => item.id === connector.id)!;
    assert.deepEqual(restored.position, connector.position, 'unchanged No.5 pose survives save/reopen exactly');
    assert.deepEqual(restored.rotation, connector.rotation);
  }
  if (dimensions === STOOL_BASELINE) {
    for (const override of [{ fastenerLengthMm: 30 }, { threadSize: 'M6' as const },
      { type: 'countersunk' as const }, { fastenerDirection: 'outward' as const }]) {
      const target = internalHoles[0];
      const tampered = synchronized.map(item => item.id !== target.profile.id ? item : {
        ...item, holes: item.holes!.map(hole => hole.id === target.hole.id ? { ...hole, ...override } : hole),
      });
      assert.equal(inspectGuidedConnectionSystem(tampered, scope).valid, false,
        `internal-slot validation must reject an incompatible specification ${JSON.stringify(override)}`);
    }
    const appended = synchronizeDesignerSceneItems(normalizeDesignItems(rekeyImportedDesignItems(synchronized, () => 'stool-optimized-append'))
      .map(item => ({ ...item, position: [item.position[0] + 1500, item.position[1], item.position[2]] as [number, number, number] })));
    const appendScope = new Set(appended.filter(item => item.kind === 'profile').map(item => item.id));
    assert.equal(inspectGuidedConnectionSystem(appended, appendScope).valid, true,
      'appending preserves internal-slot rules, machining, No.5 links and installation dependencies after ID remap');
    const combined = buildDesignDocument([...synchronized, ...appended], 'cn', source);
    const reopenedCombined = synchronizeDesignerSceneItems(normalizeDesignItems(JSON.parse(JSON.stringify(combined)).items));
    assert.equal(inspectGuidedConnectionSystem(reopenedCombined).valid, true, 'two separated appended assemblies reopen with 96 unique valid nodes');
    assert.equal(scanPhysicalConnectionNodes(reopenedCombined).length, 96);
    if (writeArtifacts) {
      fs.mkdirSync(artifactDirectory, { recursive: true });
      fs.writeFileSync(`${artifactDirectory}/stool-optimized-360x360x500.json`, JSON.stringify(document));
    }
  }
  reports.push({ dimensions, nativeProfiles: 32, boards: 2, retainedSourceComponents: 41,
    nodes: 48, no5: hiddenCount, directScrews: holeCount, internalSlotM8x20: internalHoles.length,
    cylinderM8x45: holeCount - internalHoles.length, no1: 0, inspection,
    checkScope: completed.check.scope, assemblyReview: completed.assemblyReview,
    holeAndScrewAxisToleranceMm: 0.002, synchronization: 'passed', completionIdempotency: 'passed', saveReopen: 'passed',
    manufacturingRelease: 'requires_acknowledgement', pending: ['原机构与脚轮/板件安装工艺和承载仍需核定，几何通过不代表生产放行，须客户确认后方可下单'] });
}
assert.equal(JSON.stringify(asset), originalAsset, 'connection redesign never mutates the archived source');
assert.deepEqual(failures, []);
if (writeArtifacts) fs.writeFileSync(`${artifactDirectory}/stool-optimized-validation.json`, JSON.stringify({
  schemaVersion: 1, sourceSha256: asset.sourceSha256, testedAt: new Date().toISOString(),
  appendReopen: '96 valid nodes passed', tamperedInternalSlotSpecifications: 'rejected', reports,
}, null, 2));
console.log('Stool connections passed: 48 real nodes, No.5 first, precise drill/tap fallback, stable synchronize/save and retained source mechanism hold.');
