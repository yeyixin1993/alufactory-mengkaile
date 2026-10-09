import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildDesignDocument,
  buildProductionData,
  completeStoolConnectionSystem,
  decideDesignerReleaseGate,
  inspectDesignerManufacturingPrecheck,
  normalizeDesignItems,
} from '../components/DIYDesigner';
import { createDesignSourceInfo } from '../utils/designSource';
import { buildMaterialList } from '../utils/materialList';
import { buildStoolTemplateFromAsset, type StoolSourceAsset } from '../utils/parametricStool';
import { materializeStoolSupportFasteners } from '../utils/stoolAssemblyReview';

/**
 * The release gate, as the buttons actually read it.
 *
 * The document-level regressions freeze *what a design is*. This one freezes
 * *what an action does about it*: a computed failure still stops an order, a
 * known-unverified statement is read and accepted exactly once, and an
 * acceptance is void as soon as the statements on screen change. Without this,
 * the gate could be correct in the JSON and still refuse every click.
 */

const asset = JSON.parse(fs.readFileSync('public/models/stool/source-v1.json', 'utf8')) as StoolSourceAsset;
const provenance = createDesignSourceInfo('parametric_template', { modelName: '复古边几凳（放行门禁回归）' });

// --- 1. a design with no release question goes straight through ----------------
const plainItems = normalizeDesignItems([{
  id: 'gate-profile-1', kind: 'profile', position: [0, 0, 0], rotation: [0, 0, 0],
  variantId: '2020', length: 500, quantity: 1,
} as never]);
const plainRelease = inspectDesignerManufacturingPrecheck(plainItems);
assert.equal(plainRelease.applies, false);
assert.equal(plainRelease.valid, true);
assert.deepEqual(plainRelease.issues, []);
assert.deepEqual(decideDesignerReleaseGate(plainRelease, null), { action: 'proceed' });
assert.equal('production' in buildDesignDocument(plainItems, 'cn', provenance), true,
  'An ordinary design still ships its production projection');

// --- 2. the fitted 凳子: nothing is wrong, three things are unverified ---------
const fitted = completeStoolConnectionSystem(normalizeDesignItems(
  buildStoolTemplateFromAsset({ widthMm: 360, depthMm: 360, heightMm: 500 }, asset).items,
)).items;
const release = inspectDesignerManufacturingPrecheck(fitted);
assert.equal(release.applies, true);
assert.deepEqual(release.blocking, [], 'A placed 16-support stool has no computed failure');
assert.equal(release.valid, true);
assert.deepEqual(release.scopes.sort(), ['parametric_stool_draft', 'source_mesh_draft']);
// The production hold, the source-part hold and the tier-fastener hold.
assert.equal(release.advisories.length, 3);
assert.deepEqual(release.issues, release.advisories, 'Nothing blocks, so the single list is all advisory');
assert.ok(release.advisories.join(' ').includes('实物安装验证'));

// Before acceptance the action must ask, not refuse.
assert.deepEqual(decideDesignerReleaseGate(release, null), { action: 'acknowledge' });
const draft = buildDesignDocument(fitted, 'cn', provenance);
assert.equal(draft.productionRelease.status, 'requires_acknowledgement');
assert.equal('production' in draft, false, 'An unaccepted design carries no production projection');

// --- 3. accepting the exact statements releases it ----------------------------
const acknowledgement = { advisories: release.advisories, acknowledgedAt: '2026-10-03T00:00:00.000Z' };
assert.deepEqual(decideDesignerReleaseGate(release, acknowledgement), { action: 'proceed', acknowledgement });
const accepted = buildDesignDocument(fitted, 'cn', provenance, null, { manufacturingAcknowledgement: acknowledgement });
assert.equal(accepted.productionRelease.status, 'acknowledged');
assert.equal(accepted.productionRelease.acknowledgedAt, acknowledgement.acknowledgedAt);
assert.deepEqual(accepted.productionRelease.acknowledgedAdvisories, release.advisories);
assert.ok('production' in accepted, 'An accepted design ships its production projection');

// --- 4. a partial or newer acceptance is not an acceptance --------------------
assert.deepEqual(
  decideDesignerReleaseGate(release, { ...acknowledgement, advisories: release.advisories.slice(1) }),
  { action: 'acknowledge' },
  'Accepting only some of the statements must not release the rest',
);
assert.deepEqual(
  decideDesignerReleaseGate(release, { ...acknowledgement, advisories: ['已经不存在了的旧声明'] }),
  { action: 'acknowledge' },
  'A stale acceptance cannot cover a statement that appeared later',
);
const partial = buildDesignDocument(fitted, 'cn', provenance, null, {
  manufacturingAcknowledgement: { ...acknowledgement, advisories: release.advisories.slice(1) },
});
assert.equal(partial.productionRelease.status, 'requires_acknowledgement');
assert.equal('production' in partial, false);
// Reopening a saved, accepted document keeps the acceptance, because the
// statements are derived from the design rather than stored with the file.
const reopened = buildDesignDocument(fitted, 'cn', provenance, null, { manufacturingAcknowledgement: acknowledgement });
assert.equal(reopened.productionRelease.status, 'acknowledged');

// --- 5. a real assembly failure always stops the action ------------------------
const brokenSupport = fitted.find((item) => item.sourceMesh?.source.instancePath === 'root/instances-5/instances-1')!;
const broken = fitted.filter((item) => item.id !== brokenSupport.id);
const brokenRelease = inspectDesignerManufacturingPrecheck(broken);
assert.equal(brokenRelease.valid, false);
assert.ok(brokenRelease.blocking.length > 0, 'A missing support is a computed failure');
assert.deepEqual(decideDesignerReleaseGate(brokenRelease, null), { action: 'blocked' },
  'No acceptance may release a design whose model is wrong');
assert.deepEqual(decideDesignerReleaseGate(brokenRelease, acknowledgement), { action: 'blocked' },
  'A blanket acceptance written earlier must not release a later failure');
const brokenDocument = buildDesignDocument(broken, 'cn', provenance, null, { manufacturingAcknowledgement: acknowledgement });
assert.equal(brokenDocument.productionRelease.status, 'blocked');
assert.equal('production' in brokenDocument, false);

// An unidentified source part is a computed failure too: nobody can buy or make
// a part with no purchasing identity. The extra part is added *beside* the
// stool's own parts — reclassifying one of the sixteen brackets would also
// remove it from the support review and muddle two unrelated failures into one.
const unidentified = [...fitted, {
  id: 'gate-unidentified-part-1', kind: 'imported_component', name: '未识别源配件',
  position: [0, 0, 0], rotation: [0, 0, 0], quantity: 1, colorId: 'natural',
  sourceMesh: {
    schemaVersion: 1, coordinateSystem: 'local-mm-y-up', reviewStatus: 'source_geometry_only',
    source: {
      fileSha256: 'a'.repeat(64), instancePath: 'root/gate-unidentified-1',
      semanticType: 'unmapped_source_part', componentName: 'unmapped source part',
    },
    positionsMm: [], normals: [], uvs: [], indices: [], materials: [], groups: [],
    boundsMm: { min: [0, 0, 0], max: [10, 10, 10] },
  },
} as never];
const unidentifiedRelease = inspectDesignerManufacturingPrecheck(unidentified);
assert.equal(unidentifiedRelease.valid, false);
assert.equal(unidentifiedRelease.blocking.length, 1, unidentifiedRelease.blocking.join(' | '));
assert.ok(unidentifiedRelease.blocking[0].includes('未关联编号配件'), unidentifiedRelease.blocking[0]);
assert.ok(unidentifiedRelease.blocking[0].includes('未识别源配件'), 'The unidentifiable part is named in the message');
assert.deepEqual(decideDesignerReleaseGate(unidentifiedRelease, acknowledgement), { action: 'blocked' });

// --- 6. the fasteners the cart charges are the ones the factory sheet lists ---
const fasteners = materializeStoolSupportFasteners(fitted);
assert.equal(fasteners.total, 32);
assert.equal(fasteners.sets, 32);
const factoryRows = buildMaterialList(buildProductionData(fitted, 'cn')).sections
  .flatMap((section) => section.rows)
  .filter((row) => row.partIds.some((id) => id.startsWith('stool-support-fastener-')));
assert.equal(factoryRows.length, 2);
assert.ok(factoryRows.every((row) => row.quantity === 32));

console.log('Designer release gate passed: no question ⇒ proceed, unverified statements ⇒ acknowledge once, computed failure ⇒ blocked whatever was accepted; the acceptance is void when the statements change, and the factory projection is price-free.');
