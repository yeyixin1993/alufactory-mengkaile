/** Fresh identities for one appended batch; geometry and manufacturing intent are unchanged. */
interface ImportedIdentifiableItem {
  id: string;
  holes?: readonly { id: string }[];
}

const OWNED_PREFIXES = ['display-rack-3-', 'free-frame-', 'guided-frame-', 'industrial-chair-', 'parametric-stool-'] as const;
const ARRAY_REFERENCES = ['attachedProfileIds', 'attachedPartIds', 'installBeforeIds', 'installAfterIds', 'dependsOnPartIds'] as const;
const defaultIdFactory = () => typeof globalThis.crypto?.randomUUID === 'function'
  ? `diy_${globalThis.crypto.randomUUID()}`
  : `diy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

/**
 * Call after structural preflight. Only declared scene-reference fields are rewritten:
 * unknown fields, external IDs, human remarks and catalog IDs are not interpreted as links.
 */
export const rekeyImportedDesignItems = <T extends ImportedIdentifiableItem>(
  source: readonly T[],
  idFactory: () => string = defaultIdFactory,
): T[] => {
  if (!source.length) return [];
  const occupied = new Set(source.flatMap((item) => [item.id, ...(item.holes || []).map((hole) => hole.id)]));
  const seed = idFactory();
  if (typeof seed !== 'string' || !seed.trim()) throw new Error('追加导入未生成有效的新编号，原模型保持不变。');
  // The solver uses ID order to break geometric ties (e.g. the rack carrier).
  // One namespace plus source-ID ranks preserves that order within every scope.
  const itemRanks = new Map([...source].sort((a, b) => a.id.localeCompare(b.id))
    .map((item, index) => [item.id, index]));
  // A saved document can contain several stools from earlier append operations.
  // Preserve those declared namespaces when re-keying the whole document; a
  // single new batch namespace would merge independent assembly reviews. No
  // geometry, position, or source-component name is used to infer membership.
  const stoolScope = (id: string): string | undefined => {
    if (!id.startsWith('parametric-stool-')) return undefined;
    const imported = /^(parametric-stool-import-.+)-part-\d+(?:_\d+)?$/.exec(id);
    if (imported) return imported[1];
    return id.startsWith('parametric-stool-import-')
      ? 'parametric-stool-unresolved-import' : 'parametric-stool-original';
  };
  const stoolScopes = new Map([...new Set(source.map((item) => stoolScope(item.id))
    .filter((scope): scope is string => scope !== undefined))].sort()
    .map((scope, index) => [scope, String(index).padStart(4, '0')]));
  const freshId = (oldId: string, preserveScope: boolean, rank: number) => {
    const prefix = preserveScope ? OWNED_PREFIXES.find((candidate) => oldId.startsWith(candidate)) || '' : '';
    const oldStoolScope = preserveScope ? stoolScope(oldId) : undefined;
    const assemblySuffix = oldStoolScope !== undefined && stoolScopes.size > 1
      ? `-assembly-${stoolScopes.get(oldStoolScope)}` : '';
    const base = `${prefix}import-${seed}${assemblySuffix}-${preserveScope ? 'part' : 'hole'}-${String(rank).padStart(8, '0')}`;
    let candidate = base;
    let suffix = 1;
    while (occupied.has(candidate)) candidate = `${base}_${suffix++}`;
    occupied.add(candidate);
    return candidate;
  };
  const itemIds = new Map(source.map((item) => [item.id, freshId(item.id, true, itemRanks.get(item.id)!)]));
  const holeKey = (itemId: string, holeId: string) => `${itemId}\u0000${holeId}`;
  const holeIds = new Map<string, string>();
  const holeCandidates = new Map<string, string[]>();
  let holeRank = 0;
  source.forEach((item) => {
    (item.holes || []).forEach((hole) => {
      const nextId = freshId(hole.id, false, holeRank++);
      holeIds.set(holeKey(item.id, hole.id), nextId);
      holeCandidates.set(hole.id, [...(holeCandidates.get(hole.id) || []), nextId]);
    });
  });
  // Opaque joint/attachment keys can only rewrite a bare hole ID when it is
  // unambiguous in the imported batch. Explicit linkedProfileId+linkedHoleId
  // references below always use the owner-scoped map.
  const unambiguousHoleIds = new Map([...holeCandidates]
    .flatMap(([oldId, candidates]) => candidates.length === 1 ? [[oldId, candidates[0]] as const] : []));
  const keyIds = new Map([...unambiguousHoleIds, ...itemIds]);
  const sortedKeyIds = [...keyIds.keys()].sort((first, second) => second.length - first.length);
  const newItemIdSet = new Set(itemIds.values());
  const newItemIdsByLength = [...newItemIdSet].sort((a, b) => b.length - a.length);
  const remapId = (value: unknown, ids = itemIds): unknown => typeof value === 'string' ? ids.get(value) ?? value : value;
  const remapHoleId = (value: unknown, ownerItemId?: string): unknown => {
    if (typeof value !== 'string') return value;
    if (ownerItemId) {
      const scoped = holeIds.get(holeKey(ownerItemId, value));
      if (scoped) return scoped;
    }
    return unambiguousHoleIds.get(value) ?? value;
  };
  const remapDependency = (value: unknown): unknown => {
    // The installation reader also accepts { id } records and single-string legacy dependencies.
    if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
      return { ...value, id: remapId(value.id) };
    }
    return remapId(value);
  };

  // One pass and exact colon boundaries avoid p1 corrupting p10, generated IDs being
  // replaced again, and unrelated external IDs merely containing an imported ID.
  const remapKey = (value: unknown): unknown => {
    if (typeof value !== 'string' || !value) return value;
    let mapped = '';
    let offset = 0;
    while (offset < value.length) {
      const match = (offset === 0 || value[offset - 1] === ':')
        ? sortedKeyIds.find((id) => value.startsWith(id, offset) && (offset + id.length === value.length || value[offset + id.length] === ':'))
        : undefined;
      if (match) { mapped += keyIds.get(match); offset += match.length; }
      else { mapped += value[offset]; offset += 1; }
    }
    // Joint keys are based on sorted IDs, not original pair order. A random re-key
    // may reverse that order, so restore the same canonical identity as the solver.
    const pairSeparator = mapped.indexOf(':JOINT:');
    if (pairSeparator >= 0) {
      const first = mapped.slice(0, pairSeparator);
      const rest = mapped.slice(pairSeparator + ':JOINT:'.length);
      const second = newItemIdsByLength
        .find((id) => rest === id || rest.startsWith(`${id}:`));
      if (second && newItemIdSet.has(first)) {
        return [first, second].sort().join(':JOINT:') + rest.slice(second.length);
      }
    }
    for (const suffix of [':CABINET-DOOR', ':FITTED-PANEL', ':TEE-3WAY']) {
      if (mapped.endsWith(suffix)) {
        const ids = mapped.slice(0, -suffix.length).split(':');
        if (ids.every((id) => newItemIdSet.has(id))) return ids.sort().join(':') + suffix;
      }
    }
    return mapped;
  };
  const remapRecord = (record: Record<string, unknown>, newId: string, isHole = false, ownerItemId?: string) => {
    const result: Record<string, unknown> = { ...record, id: newId };
    for (const field of ARRAY_REFERENCES) {
      if (Array.isArray(record[field])) result[field] = record[field].map(remapDependency);
      else if (field in record) result[field] = remapDependency(record[field]);
    }
    if ('linkedProfileId' in record) result.linkedProfileId = remapId(record.linkedProfileId);
    if ('linkedHoleId' in record) {
      const linkedOwner = typeof record.linkedProfileId === 'string' ? record.linkedProfileId : ownerItemId;
      result.linkedHoleId = remapHoleId(record.linkedHoleId, linkedOwner);
    }
    if ('attachmentKey' in record) result.attachmentKey = remapKey(record.attachmentKey);
    if ('jointKey' in record) result.jointKey = remapKey(record.jointKey);
    // Source CAD connection drafts carry explicit scene references and immutable
    // source provenance. Remap only the former; source paths/checksums stay intact.
    if (!isHole && record.importedConnectionDraft && typeof record.importedConnectionDraft === 'object' && !Array.isArray(record.importedConnectionDraft)) {
      const draft = record.importedConnectionDraft as Record<string, unknown>;
      result.importedConnectionDraft = {
        ...draft,
        jointKey: remapKey(draft.jointKey),
        memberIds: Array.isArray(draft.memberIds) ? draft.memberIds.map((id) => remapId(id)) : draft.memberIds,
        memberPoses: Array.isArray(draft.memberPoses) ? draft.memberPoses.map((pose) => pose && typeof pose === 'object' && !Array.isArray(pose)
          ? { ...pose, id: remapId((pose as Record<string, unknown>).id) } : pose) : draft.memberPoses,
        ...(Array.isArray(draft.machining) ? { machining: draft.machining.map((entry) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
          const suggestion = entry as Record<string, unknown>;
          return { ...suggestion, profileId: remapId(suggestion.profileId),
            ...(Array.isArray(suggestion.holes) ? { holes: suggestion.holes.map((hole) => hole && typeof hole === 'object' && !Array.isArray(hole)
              ? { ...hole, ...('jointKey' in hole ? { jointKey: remapKey(hole.jointKey) } : {}) } : hole) } : {}) };
        }) } : {}),
      };
    }
    // Drawer group identity is a declared scene link, not a catalog/SKU field.
    if (!isHole && record.drawerAssembly && typeof record.drawerAssembly === 'object' && !Array.isArray(record.drawerAssembly)) {
      const drawer = record.drawerAssembly as Record<string, unknown>;
      result.drawerAssembly = { ...drawer, groupAnchorId: remapId(drawer.groupAnchorId) };
    }
    // Fitted-panel provenance contains only explicitly declared scene links.
    // Do not recursively rewrite labels, notes, cutout metadata or arbitrary
    // strings merely because they happen to equal an imported item ID.
    if (!isHole && record.fittedPanel && typeof record.fittedPanel === 'object' && !Array.isArray(record.fittedPanel)) {
      const fittedPanel = record.fittedPanel as Record<string, unknown>;
      const remappedFittedPanel: Record<string, unknown> = {
        ...fittedPanel,
        ...('openingKey' in fittedPanel ? { openingKey: remapKey(fittedPanel.openingKey) } : {}),
      };
      for (const field of ['obstacleIds', 'sourceIds'] as const) {
        if (Array.isArray(fittedPanel[field])) {
          remappedFittedPanel[field] = fittedPanel[field].map((value) => remapId(value));
        }
      }
      if (Array.isArray(fittedPanel.cutouts)) {
        remappedFittedPanel.cutouts = fittedPanel.cutouts.map((cutout) => (
          cutout && typeof cutout === 'object' && !Array.isArray(cutout) && 'sourceId' in cutout
            ? { ...cutout, sourceId: remapId((cutout as Record<string, unknown>).sourceId) }
            : cutout
        ));
      }
      result.fittedPanel = remappedFittedPanel;
    }
    if (!isHole && Array.isArray(record.boardCutouts)) {
      result.boardCutouts = record.boardCutouts.map((cutout) => (
        cutout && typeof cutout === 'object' && !Array.isArray(cutout) && 'sourceId' in cutout
          ? { ...cutout, sourceId: remapId((cutout as Record<string, unknown>).sourceId) }
          : cutout
      ));
    }
    if (!isHole && Array.isArray(record.holes)) {
      result.holes = record.holes.map((hole) => remapRecord(
        hole,
        holeIds.get(holeKey(record.id as string, hole.id))!,
        true,
        record.id as string,
      ));
    }
    return result;
  };
  return source.map((item) => remapRecord(item as unknown as Record<string, unknown>, itemIds.get(item.id)!) as unknown as T);
};
