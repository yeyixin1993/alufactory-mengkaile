/**
 * Additive extension seam for the DIY designer.
 *
 * This registry deliberately does not replace the existing scene-kind switches,
 * renderers, pricing tables, order adapters, or manufacturing validators.  It
 * records how a future extension is expected to connect to those systems so
 * that each consumer can be migrated independently without silently changing
 * today's production behaviour.
 */

export type DesignerExtensionStatus = 'draft' | 'verified' | 'production';
export type DesignerExtensionEntityType = 'material' | 'accessory' | 'connection';

export interface DesignerExtensionNames {
  readonly 'zh-CN': string;
  readonly en: string;
  readonly ja?: string;
}

export type LegacyMappingSource = 'scene_item' | 'material_id' | 'connection_mode' | 'order_item';
export type LegacyMappingValue = string | number | boolean | null;

export interface LegacyKindMapping {
  readonly source: LegacyMappingSource;
  readonly kind: string;
  readonly when?: Readonly<Record<string, LegacyMappingValue>>;
}

export interface DesignerIntegrationKeys {
  /** Existing or future renderer adapter. `null` means deliberately not wired. */
  readonly rendererKey: string | null;
  /** Pricing adapter only; this registry never stores a price. */
  readonly pricingKey: string | null;
  readonly pricingStatus: 'connected' | 'pending_verification' | 'not_applicable';
  readonly orderKey: string | null;
  readonly validatorKey: string | null;
}

export interface ProfileCompatibility {
  readonly mode: 'exact' | 'series' | 'pending_verification' | 'not_applicable';
  /** Exact variant IDs or series IDs according to `mode`. */
  readonly values: readonly string[];
}

export type InstallationPhase =
  | 'preflight'
  | 'frame'
  | 'connection'
  | 'panel'
  | 'shaft'
  | 'slide'
  | 'closure'
  | 'final';

export type InstallationEntryDirection =
  | 'profile_end'
  | 'face_normal'
  | 'slot_normal'
  | 'shaft_axis'
  | 'panel_normal'
  | 'slide_axis'
  | 'not_applicable';

export interface InstallationMetadata {
  readonly phase: InstallationPhase;
  /** Stable tool capability IDs, not human-language tool guesses. */
  readonly requiredToolKeys: readonly string[];
  readonly entryDirections: readonly InstallationEntryDirection[];
  /** `null` is mandatory until a physical/catalog clearance is confirmed. */
  readonly minimumClearanceMm: number | null;
  readonly clearanceStatus: 'confirmed' | 'derived_by_validator' | 'pending_verification' | 'not_applicable';
  /** Optional extension-level ordering dependencies. */
  readonly installAfterExtensionIds?: readonly string[];
}

export interface DesignerExtensionBase {
  readonly id: string;
  readonly names: DesignerExtensionNames;
  readonly status: DesignerExtensionStatus;
  readonly legacyMappings: readonly LegacyKindMapping[];
  readonly integration: DesignerIntegrationKeys;
  readonly compatibleProfiles: ProfileCompatibility;
  readonly installation: InstallationMetadata;
  readonly evidenceKeys?: readonly string[];
}

export interface MaterialExtension extends DesignerExtensionBase {
  readonly entityType: 'material';
  readonly materialFamily: 'metal' | 'acrylic' | 'wood_based' | 'other';
}

export interface AccessoryExtension extends DesignerExtensionBase {
  readonly entityType: 'accessory';
  readonly accessoryFamily:
    | 'linear_shaft'
    | 'shaft_support'
    | 'drawer_slide'
    | 'connector'
    | 'fastener'
    | 'other';
}

export interface ConnectionRuleDeclaration {
  readonly method: 'placed_accessory' | 'drill_tap_fastener';
  readonly topology: 'perpendicular_profile_joint' | 'end_to_side_profile_joint';
  readonly memberCount: Readonly<{ min: number; max: number }>;
  readonly requiresPhysicalContact: boolean;
  readonly requiresPerpendicularAxes: boolean;
  readonly profileMatch: 'same_exact_variant' | 'same_series';
  readonly exclusiveGroup: string;
  readonly idempotencyKeyStrategy: 'physical_joint';
  /** Every ID here must resolve to an accessory entry in the merged registry. */
  readonly accessoryIds: readonly string[];
  readonly machining:
    | Readonly<{
      kind: 'none';
    }>
    | Readonly<{
      kind: 'countersunk_through_plus_end_tap';
      requiresLinkedFastener: true;
    }>;
}

export interface ConnectionExtension extends DesignerExtensionBase {
  readonly entityType: 'connection';
  readonly connectionRule: ConnectionRuleDeclaration;
}

export type DesignerExtension = MaterialExtension | AccessoryExtension | ConnectionExtension;

export interface DesignerExtensionPack {
  readonly id: string;
  readonly version: string;
  readonly names: DesignerExtensionNames;
  readonly status: DesignerExtensionStatus;
  readonly materials?: readonly MaterialExtension[];
  readonly accessories?: readonly AccessoryExtension[];
  readonly connections?: readonly ConnectionExtension[];
}

export type RegisteredDesignerExtension<T extends DesignerExtension = DesignerExtension> = T & {
  readonly packId: string;
};

export interface DesignerExtensionRegistrySnapshot {
  readonly revision: number;
  readonly packs: readonly Readonly<{
    id: string;
    version: string;
    names: DesignerExtensionNames;
    status: DesignerExtensionStatus;
  }>[];
  readonly materials: readonly RegisteredDesignerExtension<MaterialExtension>[];
  readonly accessories: readonly RegisteredDesignerExtension<AccessoryExtension>[];
  readonly connections: readonly RegisteredDesignerExtension<ConnectionExtension>[];
}

export type DesignerExtensionRegistryErrorCode =
  | 'INVALID_PACK'
  | 'INVALID_EXTENSION'
  | 'DUPLICATE_PACK_ID'
  | 'DUPLICATE_EXTENSION_ID'
  | 'DUPLICATE_LEGACY_MAPPING'
  | 'UNKNOWN_REFERENCE'
  | 'REFERENCE_TYPE_MISMATCH'
  | 'MISSING_PRODUCTION_VALIDATOR'
  | 'INSTALLATION_DEPENDENCY_CYCLE';

export class DesignerExtensionRegistryError extends Error {
  readonly code: DesignerExtensionRegistryErrorCode;

  constructor(code: DesignerExtensionRegistryErrorCode, message: string) {
    super(message);
    this.name = 'DesignerExtensionRegistryError';
    this.code = code;
  }
}

const STABLE_ID = /^[a-z0-9]+(?:[._-][a-z0-9]+)+$/;
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/;
const INSTALLATION_PHASES = new Set<InstallationPhase>([
  'preflight', 'frame', 'connection', 'panel', 'shaft', 'slide', 'closure', 'final',
]);
const INSTALLATION_ENTRY_DIRECTIONS = new Set<InstallationEntryDirection>([
  'profile_end', 'face_normal', 'slot_normal', 'shaft_axis', 'panel_normal', 'slide_axis', 'not_applicable',
]);
const INSTALLATION_CLEARANCE_STATES = new Set<InstallationMetadata['clearanceStatus']>([
  'confirmed', 'derived_by_validator', 'pending_verification', 'not_applicable',
]);
const MATERIAL_FAMILIES = new Set<MaterialExtension['materialFamily']>(['metal', 'acrylic', 'wood_based', 'other']);
const ACCESSORY_FAMILIES = new Set<AccessoryExtension['accessoryFamily']>([
  'linear_shaft', 'shaft_support', 'drawer_slide', 'connector', 'fastener', 'other',
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const clonePlain = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((entry) => clonePlain(entry)) as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, clonePlain(entry)]),
    ) as T;
  }
  return value;
};

const deepFreeze = <T>(value: T): Readonly<T> => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value as Record<string, unknown>).forEach((entry) => deepFreeze(entry));
  return value;
};

const assertStableId = (
  value: unknown,
  label: string,
  code: DesignerExtensionRegistryErrorCode,
) => {
  if (typeof value !== 'string' || !STABLE_ID.test(value)) {
    throw new DesignerExtensionRegistryError(code, `${label} must be a stable namespaced ID.`);
  }
};

const assertNames = (
  names: unknown,
  label: string,
  code: DesignerExtensionRegistryErrorCode,
) => {
  if (
    !isPlainObject(names)
    || typeof names['zh-CN'] !== 'string'
    || !names['zh-CN'].trim()
    || typeof names.en !== 'string'
    || !names.en.trim()
    || (names.ja !== undefined && (typeof names.ja !== 'string' || !names.ja.trim()))
  ) {
    throw new DesignerExtensionRegistryError(code, `${label} requires non-empty zh-CN/en names.`);
  }
};

const assertOptionalKey = (value: unknown, label: string) => {
  if (value !== null && (typeof value !== 'string' || !STABLE_ID.test(value))) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${label} must be null or a stable key.`);
  }
};

const assertUniqueStrings = (values: readonly string[], label: string) => {
  const seen = new Set<string>();
  values.forEach((value) => {
    if (typeof value !== 'string' || !value.trim()) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${label} contains an empty value.`);
    }
    if (seen.has(value)) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${label} contains duplicate value ${value}.`);
    }
    seen.add(value);
  });
};

const assertExtension = (extension: DesignerExtension) => {
  assertStableId(extension.id, 'Extension ID', 'INVALID_EXTENSION');
  assertNames(extension.names, `Extension ${extension.id}`, 'INVALID_EXTENSION');
  if (!['draft', 'verified', 'production'].includes(extension.status)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid status.`);
  }
  if (!['material', 'accessory', 'connection'].includes(extension.entityType)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid entity type.`);
  }
  if (!Array.isArray(extension.legacyMappings)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} legacyMappings must be an array.`);
  }
  extension.legacyMappings.forEach((mapping) => {
    if (
      !mapping
      || !['scene_item', 'material_id', 'connection_mode', 'order_item'].includes(mapping.source)
      || typeof mapping.kind !== 'string'
      || !mapping.kind.trim()
      || (mapping.when !== undefined && !isPlainObject(mapping.when))
    ) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid legacy mapping.`);
    }
  });

  if (!extension.integration || !isPlainObject(extension.integration)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} requires integration keys.`);
  }
  assertOptionalKey(extension.integration.rendererKey, `${extension.id}.rendererKey`);
  assertOptionalKey(extension.integration.pricingKey, `${extension.id}.pricingKey`);
  assertOptionalKey(extension.integration.orderKey, `${extension.id}.orderKey`);
  assertOptionalKey(extension.integration.validatorKey, `${extension.id}.validatorKey`);
  if (!['connected', 'pending_verification', 'not_applicable'].includes(extension.integration.pricingStatus)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid pricing status.`);
  }
  if (extension.integration.pricingStatus === 'connected' && !extension.integration.pricingKey) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} connected pricing requires pricingKey.`);
  }

  const compatibility = extension.compatibleProfiles;
  if (!compatibility || !Array.isArray(compatibility.values)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} requires profile compatibility.`);
  }
  if (!['exact', 'series', 'pending_verification', 'not_applicable'].includes(compatibility.mode)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid profile mode.`);
  }
  assertUniqueStrings(compatibility.values, `${extension.id}.compatibleProfiles`);
  if ((compatibility.mode === 'exact' || compatibility.mode === 'series') && compatibility.values.length === 0) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} requires compatible profile values.`);
  }
  if (compatibility.mode === 'not_applicable' && compatibility.values.length > 0) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} not-applicable profiles must be empty.`);
  }

  const installation = extension.installation;
  if (!installation || !Array.isArray(installation.requiredToolKeys) || !Array.isArray(installation.entryDirections)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} requires installation metadata.`);
  }
  installation.requiredToolKeys.forEach((toolKey) => assertStableId(
    toolKey,
    `${extension.id} tool key`,
    'INVALID_EXTENSION',
  ));
  assertUniqueStrings(installation.requiredToolKeys, `${extension.id}.requiredToolKeys`);
  assertUniqueStrings(installation.entryDirections, `${extension.id}.entryDirections`);
  if (!INSTALLATION_PHASES.has(installation.phase)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid installation phase.`);
  }
  if (installation.entryDirections.some((direction) => !INSTALLATION_ENTRY_DIRECTIONS.has(direction))) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid installation entry direction.`);
  }
  if (installation.entryDirections.includes('not_applicable') && installation.entryDirections.length > 1) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} cannot mix not_applicable with physical entry directions.`);
  }
  if (!INSTALLATION_CLEARANCE_STATES.has(installation.clearanceStatus)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid clearance status.`);
  }
  if (installation.installAfterExtensionIds !== undefined) {
    if (!Array.isArray(installation.installAfterExtensionIds)) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id}.installAfterExtensionIds must be an array.`);
    }
    assertUniqueStrings(installation.installAfterExtensionIds, `${extension.id}.installAfterExtensionIds`);
    installation.installAfterExtensionIds.forEach((referenceId) => assertStableId(
      referenceId,
      `${extension.id} install dependency`,
      'INVALID_EXTENSION',
    ));
  }
  if (
    installation.minimumClearanceMm !== null
    && (!Number.isFinite(installation.minimumClearanceMm) || installation.minimumClearanceMm < 0)
  ) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has invalid clearance.`);
  }
  if (installation.clearanceStatus === 'confirmed' && installation.minimumClearanceMm === null) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} confirmed clearance requires millimetres.`);
  }
  if (installation.minimumClearanceMm !== null && installation.clearanceStatus === 'pending_verification') {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} pending clearance cannot claim millimetres.`);
  }
  if (installation.clearanceStatus === 'not_applicable' && installation.minimumClearanceMm !== null) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} not-applicable clearance must be null.`);
  }

  if (extension.entityType === 'material' && !MATERIAL_FAMILIES.has(extension.materialFamily)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid material family.`);
  }
  if (extension.entityType === 'accessory' && !ACCESSORY_FAMILIES.has(extension.accessoryFamily)) {
    throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid accessory family.`);
  }

  if (extension.entityType === 'connection') {
    const rule = extension.connectionRule;
    if (!rule || !Array.isArray(rule.accessoryIds)) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} requires a connection rule.`);
    }
    if (!['placed_accessory', 'drill_tap_fastener'].includes(rule.method)) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid connection method.`);
    }
    if (!['perpendicular_profile_joint', 'end_to_side_profile_joint'].includes(rule.topology)) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid connection topology.`);
    }
    if (!['same_exact_variant', 'same_series'].includes(rule.profileMatch)) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid profile-match rule.`);
    }
    if (rule.idempotencyKeyStrategy !== 'physical_joint') {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid idempotency strategy.`);
    }
    if (typeof rule.requiresPhysicalContact !== 'boolean' || typeof rule.requiresPerpendicularAxes !== 'boolean') {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} requires explicit boolean geometry constraints.`);
    }
    if (
      !Number.isInteger(rule.memberCount?.min)
      || !Number.isInteger(rule.memberCount?.max)
      || rule.memberCount.min < 2
      || rule.memberCount.max < rule.memberCount.min
    ) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has invalid member-count rules.`);
    }
    assertStableId(rule.exclusiveGroup, `${extension.id} exclusive group`, 'INVALID_EXTENSION');
    assertUniqueStrings(rule.accessoryIds, `${extension.id}.accessoryIds`);
    if (rule.method === 'placed_accessory' && rule.accessoryIds.length === 0) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} accessory method requires an accessory.`);
    }
    if (rule.method === 'drill_tap_fastener' && rule.accessoryIds.length > 0) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} drill/tap method cannot consume an accessory.`);
    }
    if (!rule.machining || !['none', 'countersunk_through_plus_end_tap'].includes(rule.machining.kind)) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} has an invalid machining declaration.`);
    }
    if (
      rule.method === 'placed_accessory' && rule.machining.kind !== 'none'
      || rule.method === 'drill_tap_fastener'
        && (rule.machining.kind !== 'countersunk_through_plus_end_tap'
          || rule.machining.requiresLinkedFastener !== true)
    ) {
      throw new DesignerExtensionRegistryError('INVALID_EXTENSION', `${extension.id} connection method and machining declaration disagree.`);
    }
    if (extension.status === 'production' && !extension.integration.validatorKey) {
      throw new DesignerExtensionRegistryError(
        'MISSING_PRODUCTION_VALIDATOR',
        `Production connection ${extension.id} requires validatorKey.`,
      );
    }
  }
};

const mappingsOverlap = (left: LegacyKindMapping, right: LegacyKindMapping) => {
  if (left.source !== right.source || left.kind !== right.kind) return false;
  const leftWhen = left.when || {};
  const rightWhen = right.when || {};
  const sharedKeys = Object.keys(leftWhen).filter((key) => Object.prototype.hasOwnProperty.call(rightWhen, key));
  return !sharedKeys.some((key) => leftWhen[key] !== rightWhen[key]);
};

const assertAcyclicInstallDependencies = (entries: readonly RegisteredDesignerExtension[]) => {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string, trail: string[]) => {
    if (visiting.has(id)) {
      const cycleStart = trail.indexOf(id);
      const cycle = [...trail.slice(Math.max(0, cycleStart)), id];
      throw new DesignerExtensionRegistryError(
        'INSTALLATION_DEPENDENCY_CYCLE',
        `Installation dependencies contain a cycle: ${cycle.join(' -> ')}.`,
      );
    }
    if (visited.has(id)) return;
    visiting.add(id);
    const entry = byId.get(id);
    (entry?.installation.installAfterExtensionIds || []).forEach((dependencyId) => {
      if (byId.has(dependencyId)) visit(dependencyId, [...trail, id]);
    });
    visiting.delete(id);
    visited.add(id);
  };
  entries.forEach((entry) => visit(entry.id, []));
};

export class DesignerExtensionRegistry {
  private revision = 0;
  private readonly packs = new Map<string, DesignerExtensionPack>();

  register(packInput: DesignerExtensionPack): DesignerExtensionRegistrySnapshot {
    const pack = clonePlain(packInput);
    assertStableId(pack?.id, 'Pack ID', 'INVALID_PACK');
    assertNames(pack?.names, `Pack ${pack?.id || ''}`, 'INVALID_PACK');
    if (!VERSION.test(pack.version || '')) {
      throw new DesignerExtensionRegistryError('INVALID_PACK', `Pack ${pack.id} requires a semantic version.`);
    }
    if (!['draft', 'verified', 'production'].includes(pack.status)) {
      throw new DesignerExtensionRegistryError('INVALID_PACK', `Pack ${pack.id} has an invalid status.`);
    }
    if (this.packs.has(pack.id)) {
      throw new DesignerExtensionRegistryError('DUPLICATE_PACK_ID', `Pack ${pack.id} is already registered.`);
    }

    const incoming = [
      ...(pack.materials || []),
      ...(pack.accessories || []),
      ...(pack.connections || []),
    ];
    incoming.forEach(assertExtension);

    const current = this.getRegisteredEntries();
    const candidate = [
      ...current,
      ...incoming.map((extension) => ({ ...extension, packId: pack.id } as RegisteredDesignerExtension)),
    ];
    const ids = new Set<string>();
    candidate.forEach((extension) => {
      if (ids.has(extension.id)) {
        throw new DesignerExtensionRegistryError(
          'DUPLICATE_EXTENSION_ID',
          `Extension ${extension.id} is already registered; silent override is forbidden.`,
        );
      }
      ids.add(extension.id);
    });

    for (let leftIndex = 0; leftIndex < candidate.length; leftIndex += 1) {
      const left = candidate[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < candidate.length; rightIndex += 1) {
        const right = candidate[rightIndex];
        if (left.legacyMappings.some((leftMapping) => (
          right.legacyMappings.some((rightMapping) => mappingsOverlap(leftMapping, rightMapping))
        ))) {
          throw new DesignerExtensionRegistryError(
            'DUPLICATE_LEGACY_MAPPING',
            `Legacy mappings for ${left.id} and ${right.id} can resolve the same source item.`,
          );
        }
      }
    }

    const byId = new Map(candidate.map((extension) => [extension.id, extension]));
    candidate.forEach((extension) => {
      (extension.installation.installAfterExtensionIds || []).forEach((referenceId) => {
        if (!byId.has(referenceId)) {
          throw new DesignerExtensionRegistryError(
            'UNKNOWN_REFERENCE',
            `${extension.id} references unknown install dependency ${referenceId}.`,
          );
        }
      });
      if (extension.entityType === 'connection') {
        extension.connectionRule.accessoryIds.forEach((referenceId) => {
          const reference = byId.get(referenceId);
          if (!reference) {
            throw new DesignerExtensionRegistryError(
              'UNKNOWN_REFERENCE',
              `${extension.id} references unknown accessory ${referenceId}.`,
            );
          }
          if (reference.entityType !== 'accessory') {
            throw new DesignerExtensionRegistryError(
              'REFERENCE_TYPE_MISMATCH',
              `${extension.id} reference ${referenceId} is not an accessory.`,
            );
          }
        });
      }
    });
    assertAcyclicInstallDependencies(candidate);

    // Commit only after the complete merged registry validates.
    this.packs.set(pack.id, deepFreeze(pack) as DesignerExtensionPack);
    this.revision += 1;
    return this.snapshot();
  }

  snapshot(): DesignerExtensionRegistrySnapshot {
    const packs = [...this.packs.values()].map((pack) => ({
      id: pack.id,
      version: pack.version,
      names: clonePlain(pack.names),
      status: pack.status,
    }));
    const registered = this.getRegisteredEntries();
    const snapshot: DesignerExtensionRegistrySnapshot = {
      revision: this.revision,
      packs,
      materials: registered.filter((entry): entry is RegisteredDesignerExtension<MaterialExtension> => (
        entry.entityType === 'material'
      )),
      accessories: registered.filter((entry): entry is RegisteredDesignerExtension<AccessoryExtension> => (
        entry.entityType === 'accessory'
      )),
      connections: registered.filter((entry): entry is RegisteredDesignerExtension<ConnectionExtension> => (
        entry.entityType === 'connection'
      )),
    };
    return deepFreeze(clonePlain(snapshot)) as DesignerExtensionRegistrySnapshot;
  }

  resolveLegacy(
    source: LegacyMappingSource,
    kind: string,
    attributes: Readonly<Record<string, unknown>> = {},
  ): RegisteredDesignerExtension | undefined {
    const match = this.getRegisteredEntries().find((extension) => extension.legacyMappings.some((mapping) => (
      mapping.source === source
      && mapping.kind === kind
      && Object.entries(mapping.when || {}).every(([key, value]) => attributes[key] === value)
    )));
    return match
      ? deepFreeze(clonePlain(match)) as RegisteredDesignerExtension
      : undefined;
  }

  private getRegisteredEntries(): RegisteredDesignerExtension[] {
    return [...this.packs.values()].flatMap((pack) => [
      ...(pack.materials || []).map((extension) => ({ ...clonePlain(extension), packId: pack.id })),
      ...(pack.accessories || []).map((extension) => ({ ...clonePlain(extension), packId: pack.id })),
      ...(pack.connections || []).map((extension) => ({ ...clonePlain(extension), packId: pack.id })),
    ] as RegisteredDesignerExtension[]);
  }
}

const noConfirmedClearance = (
  phase: InstallationPhase,
  requiredToolKeys: readonly string[],
  entryDirections: readonly InstallationEntryDirection[],
): InstallationMetadata => ({
  phase,
  requiredToolKeys,
  entryDirections,
  minimumClearanceMm: null,
  clearanceStatus: 'pending_verification',
  installAfterExtensionIds: [],
});

const integration = (
  rendererKey: string | null,
  pricingKey: string | null,
  pricingStatus: DesignerIntegrationKeys['pricingStatus'],
  orderKey: string | null,
  validatorKey: string | null,
): DesignerIntegrationKeys => ({
  rendererKey,
  pricingKey,
  pricingStatus,
  orderKey,
  validatorKey,
});

const exact3030: ProfileCompatibility = { mode: 'exact', values: ['3030'] };
const exactOrdinarySquare: ProfileCompatibility = { mode: 'exact', values: ['2020', '3030'] };

/**
 * Adapter declarations for data already present in the current designer.
 * No unit prices are copied into this registry.  Catalogs marked pending stay
 * pending until an authoritative price adapter is connected.
 */
export const BUILT_IN_DESIGNER_EXTENSION_PACK: DesignerExtensionPack = {
  id: 'mengkaile.builtin.core_v1',
  version: '1.0.0',
  names: {
    'zh-CN': '现有设计器兼容层',
    en: 'Existing designer compatibility layer',
    ja: '既存デザイナー互換レイヤー',
  },
  status: 'verified',
  materials: [{
    entityType: 'material',
    id: 'mengkaile.material.marine_board',
    names: { 'zh-CN': '海洋板', en: 'Marine board', ja: 'マリンボード' },
    status: 'production',
    materialFamily: 'wood_based',
    legacyMappings: [
      { source: 'scene_item', kind: 'marine_board' },
      { source: 'material_id', kind: 'marine' },
    ],
    integration: integration(
      'legacy.renderer.marine_board',
      'legacy.pricing.marine_board_area',
      'connected',
      'legacy.order.marine_board',
      'legacy.validator.marine_board',
    ),
    compatibleProfiles: { mode: 'not_applicable', values: [] },
    installation: noConfirmedClearance('panel', [], ['panel_normal']),
    evidenceKeys: ['project_knowledge.material.marine_board'],
  }],
  accessories: [
    {
      entityType: 'accessory',
      id: 'mengkaile.accessory.linear_shaft_d8',
      names: { 'zh-CN': 'Φ8直线光轴', en: 'Ø8 linear shaft', ja: 'Φ8リニアシャフト' },
      status: 'verified',
      accessoryFamily: 'linear_shaft',
      legacyMappings: [{ source: 'scene_item', kind: 'shelf_support', when: { shelfSupportType: 'linear_shaft' } }],
      integration: integration(
        'legacy.renderer.shelf_support.linear_shaft',
        null,
        'pending_verification',
        'legacy.order.fixed_display_rack_accessory',
        'legacy.validator.display_rack.linear_shaft',
      ),
      compatibleProfiles: exact3030,
      installation: noConfirmedClearance('shaft', ['tool.hex_key.catalog_matched'], ['shaft_axis']),
      evidenceKeys: ['display_rack_component_catalog.SHAFT_8'],
    },
    {
      entityType: 'accessory',
      id: 'mengkaile.accessory.shaft_support_sk8',
      names: { 'zh-CN': 'SK8单轴支座', en: 'SK8 shaft support', ja: 'SK8シャフトサポート' },
      status: 'verified',
      accessoryFamily: 'shaft_support',
      legacyMappings: [{ source: 'scene_item', kind: 'shelf_support', when: { shelfSupportType: 'shaft_support_sk8' } }],
      integration: integration(
        'legacy.renderer.shelf_support.sk8',
        null,
        'pending_verification',
        'legacy.order.fixed_display_rack_accessory',
        'legacy.validator.display_rack.sk8',
      ),
      compatibleProfiles: exact3030,
      installation: noConfirmedClearance('shaft', ['tool.hex_key.catalog_matched'], ['face_normal', 'shaft_axis']),
      evidenceKeys: ['display_rack_component_catalog.SK8'],
    },
    {
      entityType: 'accessory',
      id: 'mengkaile.accessory.shaft_support_shf8',
      names: { 'zh-CN': 'SHF8法兰式光轴支座', en: 'SHF8 flange shaft support', ja: 'SHF8フランジシャフトサポート' },
      status: 'verified',
      accessoryFamily: 'shaft_support',
      legacyMappings: [{ source: 'scene_item', kind: 'shelf_support', when: { shelfSupportType: 'shaft_support_shf8' } }],
      integration: integration(
        'legacy.renderer.shelf_support.shf8',
        null,
        'pending_verification',
        'legacy.order.fixed_display_rack_accessory',
        'legacy.validator.display_rack.shf8',
      ),
      compatibleProfiles: exact3030,
      installation: noConfirmedClearance('shaft', ['tool.hex_key.catalog_matched'], ['face_normal', 'shaft_axis']),
      evidenceKeys: ['display_rack_component_catalog.SHF8'],
    },
    {
      entityType: 'accessory',
      id: 'mengkaile.accessory.shaft_cross_clamp_d8',
      names: { 'zh-CN': 'Ø8十字／直角交叉固定夹', en: 'Ø8 perpendicular cross clamp', ja: 'Ø8直交クロスクランプ' },
      status: 'draft',
      accessoryFamily: 'shaft_support',
      legacyMappings: [{ source: 'scene_item', kind: 'shelf_support', when: { shelfSupportType: 'shaft_support_cross_d8' } }],
      integration: integration(
        'legacy.renderer.shelf_support.cross_clamp_d8',
        null,
        'not_applicable',
        null,
        null,
      ),
      compatibleProfiles: { mode: 'pending_verification', values: [] },
      installation: noConfirmedClearance('shaft', [], ['shaft_axis']),
      evidenceKeys: ['shaft_reference_library.MODEL_REF_CROSS_CLAMP_D8'],
    },
    {
      entityType: 'accessory',
      id: 'mengkaile.accessory.shaft_collar_d8',
      names: { 'zh-CN': 'Ø8开口止动夹环', en: 'Ø8 split shaft collar', ja: 'Ø8スプリットシャフトカラー' },
      status: 'draft',
      accessoryFamily: 'shaft_support',
      legacyMappings: [{ source: 'scene_item', kind: 'shelf_support', when: { shelfSupportType: 'shaft_support_collar_d8' } }],
      integration: integration(
        'legacy.renderer.shelf_support.shaft_collar_d8',
        null,
        'not_applicable',
        null,
        null,
      ),
      compatibleProfiles: { mode: 'pending_verification', values: [] },
      installation: noConfirmedClearance('shaft', [], ['shaft_axis']),
      evidenceKeys: ['shaft_reference_library.MODEL_REF_COLLAR_D8'],
    },
    {
      entityType: 'accessory',
      id: 'mengkaile.accessory.drawer_slide_pair',
      names: { 'zh-CN': '三节滚珠抽屉滑轨（左右一套）', en: 'Three-section drawer slide pair', ja: '三段引き出しスライド左右セット' },
      status: 'verified',
      accessoryFamily: 'drawer_slide',
      legacyMappings: [{ source: 'scene_item', kind: 'shelf_support', when: { shelfSupportType: 'drawer_slide_pair' } }],
      integration: integration(
        'legacy.renderer.shelf_support.drawer_slide_pair',
        null,
        'pending_verification',
        'legacy.order.fixed_display_rack_accessory',
        'legacy.validator.display_rack.drawer_slide_pair',
      ),
      compatibleProfiles: exact3030,
      installation: noConfirmedClearance('slide', ['tool.fastener_driver.catalog_matched'], ['slide_axis', 'face_normal']),
      evidenceKeys: ['display_rack_component_catalog.DRAWER_SLIDE_PAIR'],
    },
    {
      entityType: 'accessory',
      id: 'mengkaile.accessory.corner_bracket_no1',
      names: { 'zh-CN': '压铸直角角件', en: 'Die-cast right-angle bracket', ja: 'ダイカスト直角ブラケット' },
      status: 'verified',
      accessoryFamily: 'connector',
      legacyMappings: [{ source: 'scene_item', kind: 'connector' }],
      integration: integration(
        'legacy.renderer.connector.corner_no1',
        null,
        'pending_verification',
        'legacy.order.connector.corner_no1',
        'legacy.validator.connector.corner_no1',
      ),
      compatibleProfiles: exactOrdinarySquare,
      installation: noConfirmedClearance('connection', ['tool.hex_key.catalog_matched'], ['face_normal']),
      evidenceKeys: ['project_knowledge.connection.no1'],
    },
    {
      entityType: 'accessory',
      id: 'mengkaile.accessory.hidden_connector_no5',
      names: { 'zh-CN': '隐藏式内置连接件', en: 'Concealed internal connector', ja: '隠し内蔵コネクタ' },
      status: 'verified',
      accessoryFamily: 'connector',
      legacyMappings: [{ source: 'scene_item', kind: 'hidden_connector' }],
      integration: integration(
        'legacy.renderer.connector.hidden_no5',
        null,
        'pending_verification',
        'legacy.order.connector.hidden_no5',
        'legacy.validator.connector.hidden_no5',
      ),
      compatibleProfiles: exactOrdinarySquare,
      installation: noConfirmedClearance('connection', ['tool.hex_key.catalog_matched'], ['slot_normal']),
      evidenceKeys: ['project_knowledge.connection.no5'],
    },
  ],
  connections: [
    {
      entityType: 'connection',
      id: 'mengkaile.connection.corner_bracket',
      names: { 'zh-CN': '角码连接', en: 'Corner-bracket connection', ja: 'コーナーブラケット接続' },
      status: 'verified',
      legacyMappings: [{ source: 'connection_mode', kind: 'corner_bracket' }],
      integration: integration(
        'legacy.renderer.connection.corner_bracket',
        null,
        'not_applicable',
        'legacy.order.connection.corner_bracket',
        'legacy.validator.connection.corner_bracket',
      ),
      compatibleProfiles: exactOrdinarySquare,
      installation: noConfirmedClearance('connection', ['tool.hex_key.catalog_matched'], ['face_normal']),
      evidenceKeys: ['project_knowledge.connection.no1'],
      connectionRule: {
        method: 'placed_accessory',
        topology: 'perpendicular_profile_joint',
        memberCount: { min: 2, max: 2 },
        requiresPhysicalContact: true,
        requiresPerpendicularAxes: true,
        profileMatch: 'same_exact_variant',
        exclusiveGroup: 'mengkaile.connection.primary_joint_method',
        idempotencyKeyStrategy: 'physical_joint',
        accessoryIds: ['mengkaile.accessory.corner_bracket_no1'],
        machining: { kind: 'none' },
      },
    },
    {
      entityType: 'connection',
      id: 'mengkaile.connection.hidden_connector',
      names: { 'zh-CN': '隐藏连接', en: 'Hidden-connector connection', ja: '隠しコネクタ接続' },
      status: 'verified',
      legacyMappings: [{ source: 'connection_mode', kind: 'slot_connector' }],
      integration: integration(
        'legacy.renderer.connection.hidden_connector',
        null,
        'not_applicable',
        'legacy.order.connection.hidden_connector',
        'legacy.validator.connection.hidden_connector',
      ),
      compatibleProfiles: exactOrdinarySquare,
      installation: noConfirmedClearance('connection', ['tool.hex_key.catalog_matched'], ['slot_normal']),
      evidenceKeys: ['project_knowledge.connection.no5'],
      connectionRule: {
        method: 'placed_accessory',
        topology: 'perpendicular_profile_joint',
        memberCount: { min: 2, max: 2 },
        requiresPhysicalContact: true,
        requiresPerpendicularAxes: true,
        profileMatch: 'same_exact_variant',
        exclusiveGroup: 'mengkaile.connection.primary_joint_method',
        idempotencyKeyStrategy: 'physical_joint',
        accessoryIds: ['mengkaile.accessory.hidden_connector_no5'],
        machining: { kind: 'none' },
      },
    },
    {
      entityType: 'connection',
      id: 'mengkaile.connection.drill_tap',
      names: { 'zh-CN': '开孔攻丝连接', en: 'Drill-and-tap connection', ja: '穴あけタップ接続' },
      status: 'verified',
      legacyMappings: [{ source: 'connection_mode', kind: 'drill_tap' }],
      integration: integration(
        'legacy.renderer.connection.drill_tap',
        null,
        'not_applicable',
        'legacy.order.connection.drill_tap',
        'legacy.validator.connection.drill_tap',
      ),
      compatibleProfiles: exactOrdinarySquare,
      installation: noConfirmedClearance('connection', ['tool.hex_key.catalog_matched'], ['face_normal', 'profile_end']),
      evidenceKeys: ['project_knowledge.connection.drill_tap'],
      connectionRule: {
        method: 'drill_tap_fastener',
        topology: 'end_to_side_profile_joint',
        memberCount: { min: 2, max: 2 },
        requiresPhysicalContact: true,
        requiresPerpendicularAxes: true,
        profileMatch: 'same_exact_variant',
        exclusiveGroup: 'mengkaile.connection.primary_joint_method',
        idempotencyKeyStrategy: 'physical_joint',
        accessoryIds: [],
        machining: {
          kind: 'countersunk_through_plus_end_tap',
          requiresLinkedFastener: true,
        },
      },
    },
  ],
};

export const createDesignerExtensionRegistry = (
  packs: readonly DesignerExtensionPack[] = [],
) => {
  const registry = new DesignerExtensionRegistry();
  registry.register(BUILT_IN_DESIGNER_EXTENSION_PACK);
  packs.forEach((pack) => registry.register(pack));
  return registry;
};

const defaultDesignerExtensionRegistry = createDesignerExtensionRegistry();

export const registerDesignerExtensionPack = (pack: DesignerExtensionPack) => (
  defaultDesignerExtensionRegistry.register(pack)
);

export const getDesignerExtensionRegistrySnapshot = () => (
  defaultDesignerExtensionRegistry.snapshot()
);

export const resolveLegacyDesignerExtension = (
  source: LegacyMappingSource,
  kind: string,
  attributes?: Readonly<Record<string, unknown>>,
) => defaultDesignerExtensionRegistry.resolveLegacy(source, kind, attributes);
