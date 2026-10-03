import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildStoolTemplateFromAsset, type StoolSourceAsset } from '../utils/parametricStool';
import { normalizeDesignItems, completeStoolConnectionSystem } from '../components/DIYDesigner';
import { rekeyImportedDesignItems } from '../utils/designerImportRemap';
import { reviewStoolAssembly } from '../utils/stoolAssemblyReview';

const asset = JSON.parse(fs.readFileSync('public/models/stool/source-v1.json', 'utf8')) as StoolSourceAsset;
const originalAsset = JSON.stringify(asset);
let baseline: ReturnType<typeof normalizeDesignItems> = [];
for (const parameters of [
  { widthMm: 360, depthMm: 360, heightMm: 500 },
  { widthMm: 481, depthMm: 427, heightMm: 637 },
]) {
  const completed = completeStoolConnectionSystem(normalizeDesignItems(buildStoolTemplateFromAsset(parameters, asset).items));
  assert.equal(completed.check.valid, true, 'Frame-node checks remain separate from full assembly completeness');
  const items = completed.items;
  const before = JSON.stringify(items);
  const review = reviewStoolAssembly(items);
  assert.equal(review.applicable, true);
  assert.equal(review.complete, false, 'Source contact never claims verified fastening');
  assert.equal(review.assemblies.length, 1);
  const assembly = review.assemblies[0];
  assert.deepEqual(assembly.profileComponents.map((group) => group.length), [24, 4, 4]);
  assert.deepEqual(assembly.geometricBridgeComponents.map((group) => group.length), [32]);
  assert.equal(assembly.supportCount, 16);
  assert.equal(assembly.missingSupportCount, 0);
  assert.equal(assembly.unmatchedMountCount, 0);
  assert.equal(review.totals.matchedMounts, 32);
  assert.equal(review.totals.candidateScrews, 32);
  assert.equal(review.totals.candidateNuts, 32);
  assert.equal(assembly.supports.filter((support) => support.tier === 'lower_fixed_to_middle').length, 8);
  assert.equal(assembly.supports.filter((support) => support.tier === 'upper_middle_to_seat').length, 8);
  for (const support of assembly.supports) {
    assert.equal(new Set(support.matchedProfileIds).size, 2);
    assert.equal(support.candidateFastener.supplierSku, null);
    assert.equal(support.candidateNut.supplierSku, null);
    assert.equal(support.fasteningStatus, 'unverified');
    support.holes.forEach((hole) => {
      assert.equal(hole.matchStatus, 'matched');
      assert.equal(hole.plateThicknessMm, 4);
      assert.equal(hole.diameterMm, 6.5);
      assert.ok(assembly.profileIds.includes(hole.profileId!));
    });
  }
  assert.equal(assembly.installationSteps.length, 4);
  assert.equal(JSON.stringify(items), before, 'Review cannot change geometry, IDs, holes, links or source records');
  if (parameters.widthMm === 360) baseline = items;
}

const add = (offset: number, seed: string) => rekeyImportedDesignItems(baseline, () => seed)
  .map((item) => ({ ...item, position: [item.position[0] + offset, item.position[1], item.position[2]] }));
const first = add(1500, 'review-first'); const second = add(-1500, 'review-second');
const combined = reviewStoolAssembly([...baseline, ...first, ...second]);
assert.equal(combined.assemblies.length, 3);
assert.equal(combined.totals.supports, 48);
assert.equal(combined.totals.matchedMounts, 96);
for (const assembly of combined.assemblies) {
  assert.deepEqual(assembly.geometricBridgeComponents.map((component) => component.length), [32]);
  for (const support of assembly.supports) assert.ok(support.matchedProfileIds.every((id) => assembly.profileIds.includes(id)), 'No cross-assembly bridge');
}
// Even coincident copies must use their own re-keyed scope, never another stool.
const coincident = reviewStoolAssembly([...baseline, ...add(0, 'overlap')]);
assert.equal(coincident.assemblies.length, 2);
assert.ok(coincident.assemblies.every((assembly) => assembly.unmatchedMountCount === 0
  && assembly.supports.every((support) => support.matchedProfileIds.every((id) => assembly.profileIds.includes(id)))));

// Save a two-stool document, then append the entire document repeatedly. Each
// prior namespace must survive as its own new namespace, even at the same pose.
let savedPair = [...baseline, ...add(0, 'saved-pair')];
for (let pass = 0; pass < 2; pass += 1) {
  const beforePair = JSON.stringify(savedPair);
  const appendedPair = rekeyImportedDesignItems(savedPair, () => `saved-pair-pass-${pass}`);
  const pairReview = reviewStoolAssembly(appendedPair);
  assert.equal(pairReview.assemblies.length, 2, 'A whole-document append must preserve both prior stool scopes');
  assert.equal(pairReview.totals.supports, 32);
  assert.equal(pairReview.totals.expectedSupports, 32);
  assert.equal(pairReview.totals.matchedMounts, 64);
  assert.equal(pairReview.totals.candidateScrews, 64);
  assert.equal(pairReview.totals.candidateNuts, 64);
  for (const assembly of pairReview.assemblies) {
    assert.deepEqual(assembly.profileComponents.map((component) => component.length), [24, 4, 4]);
    assert.deepEqual(assembly.geometricBridgeComponents.map((component) => component.length), [32]);
    assert.equal(assembly.unmatchedMountCount, 0);
    assert.ok(assembly.supports.every((support) => support.matchedProfileIds
      .every((id) => assembly.profileIds.includes(id))), 'Re-appended coincident stools cannot cross-connect');
  }
  const previousIds = new Set(savedPair.map((item) => item.id));
  const idMap = new Map(savedPair.map((item, index) => [item.id, appendedPair[index].id]));
  const appendedById = new Map(appendedPair.map((item) => [item.id, item]));
  appendedPair.forEach((item, index) => {
    const old = savedPair[index];
    assert.ok(!previousIds.has(item.id));
    assert.deepEqual(item.position, old.position);
    assert.deepEqual(item.rotation, old.rotation);
    assert.equal(item.sourceMesh, old.sourceMesh, 'Re-keying preserves immutable source geometry and provenance');
    for (const field of ['attachedProfileIds', 'installBeforeIds', 'installAfterIds'] as const) {
      if (old[field]) assert.deepEqual(item[field], old[field]!.map((id) => idMap.get(id) || id));
    }
    if (old.linkedProfileId) assert.equal(item.linkedProfileId, idMap.get(old.linkedProfileId));
    if (old.linkedHoleId) assert.ok(appendedById.get(item.linkedProfileId!)?.holes
      ?.some((hole) => hole.id === item.linkedHoleId), 'Linked screws retain their re-keyed owner hole');
  });
  const together = reviewStoolAssembly([...savedPair, ...appendedPair]);
  assert.equal(together.assemblies.length, 4, 'The existing document and appended document retain four independent stools');
  assert.equal(together.totals.matchedMounts, 128);
  assert.equal(JSON.stringify(savedPair), beforePair, 'Whole-document append cannot mutate the saved pair');
  savedPair = appendedPair;
}

const target = baseline.find((item) => item.id === 'parametric-stool-stool-seat-front')!;
const moved = baseline.map((item) => item.id === target.id ? { ...item, position: [item.position[0], item.position[1] + 10, item.position[2]] } : item);
assert.equal(reviewStoolAssembly(moved).totals.unmatchedMounts, 2, 'Moving a parent destroys its two real mating faces');
assert.equal(reviewStoolAssembly(baseline.filter((item) => item.id !== target.id)).totals.unmatchedMounts, 2, 'Deleted parent cannot remain attached by stale IDs');
const support = baseline.find((item) => item.sourceMesh?.source.instancePath === 'root/instances-5/instances-2')!;
assert.equal(reviewStoolAssembly(baseline.filter((item) => item.id !== support.id)).totals.missingSupports, 1, 'Removed source bracket is reported');
const foreignParent = [...baseline.filter((item) => item.id !== target.id), ...add(0, 'foreign')];
assert.equal(reviewStoolAssembly(foreignParent).assemblies.find((group) => group.scopeId === 'parametric-stool-original')!.unmatchedMountCount, 2,
  'A coincident foreign parent must not silently replace a missing local member');
const changedSupport = baseline.map((item) => item.id !== support.id ? item : {
  ...item, sourceMesh: { ...item.sourceMesh!, indices: [] },
});
assert.ok(reviewStoolAssembly(changedSupport).assemblies[0].supports.find((item) => item.itemId === support.id)!
  .holes.every((hole) => hole.matchStatus === 'source_geometry_changed'));
const allRemoved = baseline.filter((item) => item.sourceMesh?.source.semanticType !== 'fixed_support');
assert.equal(reviewStoolAssembly(allRemoved).totals.missingSupports, 16);
assert.equal(reviewStoolAssembly([]).applicable, false);
assert.equal(JSON.stringify(asset), originalAsset, 'Source asset remains unchanged');
console.log('Stool assembly review passed: default/asymmetric geometry, 32 measured mounts, 3 frame components versus one planned bridge graph, re-keyed/overlapping scopes and repeated whole-document appends, moved/deleted parents, missing/changed support and no false fastening completion.');
