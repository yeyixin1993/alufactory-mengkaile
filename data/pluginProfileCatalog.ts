/** Exact profile-size and slot-cell labels found in the installed Aluformula SketchUp plugin catalog. */
export interface PluginProfileCatalogRecord {
  readonly id: '3060' | '6060' | '30120';
  readonly name: string;
  readonly crossSectionMm: readonly [number, number];
  readonly cells: readonly [number, number];
  readonly slotsPerSide: Readonly<{ A: number; B: number; C: number; D: number }>;
  readonly nominalSlotCount: number;
  /** Plugin field is a bore label only; it does not establish tapping/thread spec. */
  readonly boreDiameterMm: 5.2;
  readonly boreStatus: 'plugin_catalog_observation';
  readonly wallThicknessMm: null;
  readonly source: string;
}

export const PLUGIN_PROFILE_CATALOG: readonly PluginProfileCatalogRecord[] = [
  {
    id: '3060', name: '3060 六槽标准型', crossSectionMm: [30, 60], cells: [1, 2],
    slotsPerSide: { A: 1, B: 2, C: 1, D: 2 }, nominalSlotCount: 6,
    boreDiameterMm: 5.2, boreStatus: 'plugin_catalog_observation', wallThicknessMm: null,
    source: 'SketchUp Aluformula plugin catalog.json · 30 series · cells 1×2',
  },
  {
    id: '6060', name: '6060 八槽标准型', crossSectionMm: [60, 60], cells: [2, 2],
    slotsPerSide: { A: 2, B: 2, C: 2, D: 2 }, nominalSlotCount: 8,
    boreDiameterMm: 5.2, boreStatus: 'plugin_catalog_observation', wallThicknessMm: null,
    source: 'SketchUp Aluformula plugin catalog.json · 30 series · cells 2×2',
  },
  {
    id: '30120', name: '30120 十槽标准型', crossSectionMm: [30, 120], cells: [1, 4],
    slotsPerSide: { A: 1, B: 4, C: 1, D: 4 }, nominalSlotCount: 10,
    boreDiameterMm: 5.2, boreStatus: 'plugin_catalog_observation', wallThicknessMm: null,
    source: 'SketchUp Aluformula plugin catalog.json · 30 series · cells 1×4',
  },
] as const;

export const getPluginProfileRecord = (id: string) => PLUGIN_PROFILE_CATALOG.find((entry) => entry.id === id) || null;
