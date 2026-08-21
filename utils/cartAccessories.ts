import { CartItem, ProductType, ProfileConfig } from '../types';
import { getDiyScrewOrderSpec } from './screwCalculator';
import { getRotationallyCanonicalMachiningKey } from './profileManufacturingEquivalence';

interface ScrewReference {
  linkedProfileId?: string;
  linkedHoleId?: string;
}

export interface DiyScrewCartSummaryRow {
  profileModel: string;
  profileSize: string;
  screwHead: string;
  screwThreadSize: string;
  screwLengthMm: number | null;
  includesElasticFastener: boolean;
  colorId: string;
  colorName: string;
  quantity: number;
  totalPrice: number;
}

const uniqueScrewReferences = (references: ScrewReference[]) => {
  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = `${reference.linkedProfileId || ''}:${reference.linkedHoleId || ''}`;
    if (key === ':' || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const isDiyScrewAccessory = (item: CartItem) => {
  if (item.product.type !== ProductType.ACCESSORY) return false;
  const config = (item.config || {}) as any;
  const lines = Array.isArray(config.lines) ? config.lines : [];
  return Boolean(config.screwHead)
    || lines.some((line: any) => String(line?.id || '').startsWith('diy-') && String(line?.id || '').includes('screw'));
};

const screwLengthFromConfig = (config: any) => {
  const explicit = Number(config?.screwLengthMm || config?.screwLength || 0);
  if (explicit > 0) return explicit;
  const lines = Array.isArray(config?.lines) ? config.lines : [];
  const match = lines.map((line: any) => String(line?.name || ''))
    .join(' ')
    .match(/(\d+(?:\.\d+)?)\s*mm/i);
  return match ? Number(match[1]) : null;
};

const screwGroupKey = (item: CartItem) => {
  const config = (item.config || {}) as any;
  const orderSpec = getDiyScrewOrderSpec(
    config.profileSize || config.size || config.variantId,
    config.screwHead,
    screwLengthFromConfig(config) || 1,
  );
  const lines = (Array.isArray(config.lines) ? config.lines : [])
    .map((line: any) => ({
      id: String(line?.id || ''),
      code: String(line?.code || ''),
      imageKey: String(line?.imageKey || ''),
      unitPrice: Number(line?.unitPrice || 0),
    }))
    .sort((a: any, b: any) => `${a.id}:${a.code}`.localeCompare(`${b.id}:${b.code}`));

  return JSON.stringify({
    productId: item.product.id,
    profileSize: config.profileSize || config.size || config.variantId || '',
    colorMode: config.colorMode || '',
    colorId: config.colorId || '',
    screwHead: config.screwHead || '',
    screwThreadSize: orderSpec.threadSize,
    screwLengthMm: orderSpec.lengthMm,
    lines,
  });
};

const isGroupableDiyAccessory = (item: CartItem) => {
  if (item.product.type !== ProductType.ACCESSORY || isDiyScrewAccessory(item)) return false;
  const config = (item.config || {}) as any;
  const lines = Array.isArray(config.lines) ? config.lines : [];
  if (lines.length !== 1) return false;
  return config.type === 'profile_accessory'
    && Boolean(config.diyPosition || (Array.isArray(config.diyPositions) && config.diyPositions.length));
};

const accessoryGroupKey = (item: CartItem) => {
  const config = (item.config || {}) as any;
  const lines = (Array.isArray(config.lines) ? config.lines : []).map((line: any) => ({
    id: String(line?.id || ''),
    code: String(line?.code || ''),
    imageKey: String(line?.imageKey || ''),
    name: String(line?.name || ''),
    unitPrice: Number(line?.unitPrice || 0),
  }));
  return JSON.stringify({
    productId: item.product.id,
    type: config.type || '',
    profileSize: config.profileSize || config.size || config.variantId || '',
    colorMode: config.colorMode || '',
    colorId: config.colorId || '',
    finish: config.finish || '',
    accessoryLengthMm: Number(config.accessoryLengthMm || 0),
    accessoryWidthMm: Number(config.accessoryWidthMm || 0),
    accessoryHeightMm: Number(config.accessoryHeightMm || 0),
    accessoryThreadSize: String(config.accessoryThreadSize || ''),
    hasBrake: Boolean(config.hasBrake),
    lines,
  });
};

const appendVectorValues = (existing: any, incoming: any, singularKey: string, pluralKey: string) => [
  ...(Array.isArray(existing?.[pluralKey]) ? existing[pluralKey] : (existing?.[singularKey] ? [existing[singularKey]] : [])),
  ...(Array.isArray(incoming?.[pluralKey]) ? incoming[pluralKey] : (incoming?.[singularKey] ? [incoming[singularKey]] : [])),
];

const mergeAccessoryRows = (existing: CartItem, incoming: CartItem): CartItem => {
  const existingConfig = (existing.config || {}) as any;
  const incomingConfig = (incoming.config || {}) as any;
  const existingLines = Array.isArray(existingConfig.lines) ? existingConfig.lines : [];
  const incomingLines = Array.isArray(incomingConfig.lines) ? incomingConfig.lines : [];
  const nextLines = existingLines.map((line: any) => {
    const addition = incomingLines.find((candidate: any) => (
      String(candidate?.id || '') === String(line?.id || '')
      && String(candidate?.code || '') === String(line?.code || '')
      && String(candidate?.name || '') === String(line?.name || '')
      && Number(candidate?.unitPrice || 0) === Number(line?.unitPrice || 0)
    ));
    if (!addition) return line;
    const quantity = Number(line.quantity || 0) + Number(addition.quantity || 0);
    return {
      ...line,
      quantity,
      subtotal: Number((Number(line.subtotal || 0) + Number(addition.subtotal || 0)).toFixed(2)),
      isBulk: quantity >= 20,
    };
  });
  const nextQuantities = { ...(existingConfig.quantities || {}) };
  Object.entries(incomingConfig.quantities || {}).forEach(([id, quantity]) => {
    nextQuantities[id] = Number(nextQuantities[id] || 0) + Number(quantity || 0);
  });
  const remarks = [...new Set([
    ...(Array.isArray(existingConfig.remarks) ? existingConfig.remarks : []),
    existingConfig.remark,
    ...(Array.isArray(incomingConfig.remarks) ? incomingConfig.remarks : []),
    incomingConfig.remark,
  ].map((value) => String(value || '').trim()).filter(Boolean))];

  return {
    ...existing,
    totalPrice: Number((Number(existing.totalPrice || 0) + Number(incoming.totalPrice || 0)).toFixed(2)),
    config: {
      ...existingConfig,
      totalQuantity: Number(existingConfig.totalQuantity || 0) + Number(incomingConfig.totalQuantity || 0),
      unitTotal: Number((
        Number(existingConfig.unitTotal || existing.totalPrice || 0)
        + Number(incomingConfig.unitTotal || incoming.totalPrice || 0)
      ).toFixed(2)),
      lines: nextLines,
      quantities: nextQuantities,
      diyPositions: appendVectorValues(existingConfig, incomingConfig, 'diyPosition', 'diyPositions'),
      diyRotations: appendVectorValues(existingConfig, incomingConfig, 'diyRotation', 'diyRotations'),
      attachedProfileIds: [...new Set([
        ...(existingConfig.attachedProfileIds || []),
        ...(incomingConfig.attachedProfileIds || []),
      ])],
      attachmentKeys: [...new Set([
        ...(existingConfig.attachmentKeys || []),
        existingConfig.attachmentKey,
        ...(incomingConfig.attachmentKeys || []),
        incomingConfig.attachmentKey,
      ].filter(Boolean))],
      remarks,
      remark: remarks.length === 1 ? remarks[0] : undefined,
    },
  };
};

const getScrewReferences = (config: any): ScrewReference[] => {
  const existing = Array.isArray(config?.linkedScrewRefs) ? config.linkedScrewRefs : [];
  const singular = config?.linkedProfileId || config?.linkedHoleId
    ? [{ linkedProfileId: config.linkedProfileId, linkedHoleId: config.linkedHoleId }]
    : [];
  return uniqueScrewReferences([...existing, ...singular]);
};

/**
 * Consolidates automatically generated DIY screws into one accessory row per
 * series/head/length/color/price combination. Linked hole references are
 * retained so production data can still trace every physical screw back to
 * the design. Customer-adjusted quantities remain authoritative.
 */
export const groupDiyScrewCartItems = (cart: CartItem[]): CartItem[] => {
  const result: CartItem[] = [];
  const groupedIndex = new Map<string, number>();

  cart.forEach((item) => {
    if (!isDiyScrewAccessory(item)) {
      result.push(item);
      return;
    }

    const key = screwGroupKey(item);
    const existingIndex = groupedIndex.get(key);
    const config = (item.config || {}) as any;
    const itemLines = Array.isArray(config.lines) ? config.lines : [];

    if (existingIndex === undefined) {
      const linkedScrewRefs = getScrewReferences(config);
      result.push({
        ...item,
        quantity: 1,
        config: {
          ...config,
          lines: itemLines.map((line: any) => ({ ...line })),
          quantities: { ...(config.quantities || {}) },
          linkedScrewRefs,
          diyPositions: config.diyPosition ? [config.diyPosition] : (config.diyPositions || []),
          diyRotations: config.diyRotation ? [config.diyRotation] : (config.diyRotations || []),
        },
      });
      groupedIndex.set(key, result.length - 1);
      return;
    }

    const existing = result[existingIndex];
    const existingConfig = (existing.config || {}) as any;
    const nextLines = (Array.isArray(existingConfig.lines) ? existingConfig.lines : []).map((line: any) => {
      const addition = itemLines.find((candidate: any) => (
        String(candidate?.id || '') === String(line?.id || '')
        && String(candidate?.code || '') === String(line?.code || '')
      ));
      if (!addition) return line;
      return {
        ...line,
        quantity: Number(line.quantity || 0) + Number(addition.quantity || 0),
        subtotal: Number((Number(line.subtotal || 0) + Number(addition.subtotal || 0)).toFixed(2)),
        isBulk: Number(line.quantity || 0) + Number(addition.quantity || 0) >= 20,
      };
    });
    const nextQuantities = { ...(existingConfig.quantities || {}) };
    Object.entries(config.quantities || {}).forEach(([id, quantity]) => {
      nextQuantities[id] = Number(nextQuantities[id] || 0) + Number(quantity || 0);
    });

    result[existingIndex] = {
      ...existing,
      totalPrice: Number((Number(existing.totalPrice || 0) + Number(item.totalPrice || 0)).toFixed(2)),
      config: {
        ...existingConfig,
        totalQuantity: Number(existingConfig.totalQuantity || 0) + Number(config.totalQuantity || 0),
        unitTotal: Number((Number(existingConfig.unitTotal || existing.totalPrice || 0) + Number(config.unitTotal || item.totalPrice || 0)).toFixed(2)),
        lines: nextLines,
        quantities: nextQuantities,
        linkedScrewRefs: uniqueScrewReferences([...getScrewReferences(existingConfig), ...getScrewReferences(config)]),
        diyPositions: [
          ...(Array.isArray(existingConfig.diyPositions) ? existingConfig.diyPositions : []),
          ...(config.diyPosition ? [config.diyPosition] : (config.diyPositions || [])),
        ],
        diyRotations: [
          ...(Array.isArray(existingConfig.diyRotations) ? existingConfig.diyRotations : []),
          ...(config.diyRotation ? [config.diyRotation] : (config.diyRotations || [])),
        ],
      },
    };
  });

  return result;
};

/**
 * Compacts every identical designer accessory specification after screw
 * grouping. Scene transforms and manufacturing remarks remain available in
 * arrays, while customer/PDF BOM surfaces receive one row per specification.
 */
export const groupDiyAccessoryCartItems = (cart: CartItem[]): CartItem[] => {
  const screwGrouped = groupDiyScrewCartItems(cart);
  const result: CartItem[] = [];
  const groupedIndex = new Map<string, number>();

  screwGrouped.forEach((item) => {
    if (!isGroupableDiyAccessory(item)) {
      result.push(item);
      return;
    }
    const key = accessoryGroupKey(item);
    const existingIndex = groupedIndex.get(key);
    const config = (item.config || {}) as any;
    if (existingIndex === undefined) {
      result.push({
        ...item,
        quantity: 1,
        config: {
          ...config,
          lines: (config.lines || []).map((line: any) => ({ ...line })),
          quantities: { ...(config.quantities || {}) },
          diyPositions: appendVectorValues({}, config, 'diyPosition', 'diyPositions'),
          diyRotations: appendVectorValues({}, config, 'diyRotation', 'diyRotations'),
          remarks: [String(config.remark || '').trim()].filter(Boolean),
        },
      });
      groupedIndex.set(key, result.length - 1);
      return;
    }
    result[existingIndex] = mergeAccessoryRows(result[existingIndex], item);
  });

  return result;
};

/**
 * Physical manufacturing signature used by customer/PDF display grouping.
 * Scene location and location-only remarks intentionally do not split rows;
 * the original cart items still retain those details for JSON/Excel exports.
 * Confirmed cross-section symmetries may also make two machining signatures
 * equivalent after rolling the complete profile around its length axis.
 */
export const getProfileManufacturingGroupKey = (item: CartItem) => {
  if (item.product.type !== ProductType.PROFILE) return `non-profile:${item.id}`;
  const config = (item.config || {}) as ProfileConfig;
  return JSON.stringify({
    productId: item.product.id,
    variantId: config.variantId || '',
    length: Number(config.length || 0),
    finish: config.finish || '',
    colorId: config.colorId || '',
    unitPrice: Number(config.unitPrice ?? (Number(item.totalPrice || 0) / Math.max(1, Number(item.quantity || 0)))),
    labelService: Boolean(config.labelService),
    machining: getRotationallyCanonicalMachiningKey({
      variantId: config.variantId,
      holes: config.holes,
      tapping: config.tapping,
      miterCut: config.miterCut,
    }),
  });
};

const mergeProfileDisplayRows = (existing: CartItem, incoming: CartItem): CartItem => {
  const existingConfig = (existing.config || {}) as ProfileConfig & { remarks?: string[] };
  const incomingConfig = (incoming.config || {}) as ProfileConfig & { remarks?: string[] };
  const remarks = [...new Set([
    ...(Array.isArray(existingConfig.remarks) ? existingConfig.remarks : []),
    existingConfig.remark,
    ...(Array.isArray(incomingConfig.remarks) ? incomingConfig.remarks : []),
    incomingConfig.remark,
  ].map((value) => String(value || '').trim()).filter(Boolean))];

  return {
    ...existing,
    quantity: Number(existing.quantity || 0) + Number(incoming.quantity || 0),
    totalPrice: Number((Number(existing.totalPrice || 0) + Number(incoming.totalPrice || 0)).toFixed(2)),
    config: {
      ...existingConfig,
      remarks,
      // A shared remark remains printable. Different position-only remarks are
      // kept in the derived row but omitted from the compact PDF card.
      remark: remarks.length === 1 ? remarks[0] : undefined,
    },
  };
};

export const groupIdenticalProfileCartItems = (cart: CartItem[]): CartItem[] => {
  const result: CartItem[] = [];
  const groupedIndex = new Map<string, number>();

  cart.forEach((item) => {
    if (item.product.type !== ProductType.PROFILE) {
      result.push(item);
      return;
    }
    const key = getProfileManufacturingGroupKey(item);
    const existingIndex = groupedIndex.get(key);
    if (existingIndex === undefined) {
      const config = (item.config || {}) as ProfileConfig;
      result.push({
        ...item,
        config: {
          ...config,
          holes: Array.isArray(config.holes) ? config.holes.map((hole) => ({ ...hole })) : [],
          tapping: {
            left: Array.isArray(config.tapping?.left) ? [...config.tapping.left] : [],
            right: Array.isArray(config.tapping?.right) ? [...config.tapping.right] : [],
          },
          remarks: [String(config.remark || '').trim()].filter(Boolean),
        },
      });
      groupedIndex.set(key, result.length - 1);
      return;
    }
    result[existingIndex] = mergeProfileDisplayRows(result[existingIndex], item);
  });

  return result;
};

const FACTORY_PANEL_TYPES = new Set<ProductType>([
  ProductType.ALUMINUM_PLATE,
  ProductType.PEGBOARD,
  ProductType.MARINE_BOARD,
  ProductType.CABINET_DOOR,
]);

const normalizedNumberList = (value: unknown) => (
  Array.isArray(value) ? value.map((entry) => Number(entry || 0)) : []
);

/**
 * Physical cutting/finishing signature for panels and cabinet-door leaves.
 * Designer positions and attachment ids are intentionally excluded because
 * this key is used only by the final factory-sheet/PDF display projection.
 */
export const getFactoryPanelManufacturingGroupKey = (item: CartItem) => {
  const config = (item.config || {}) as any;
  if (!FACTORY_PANEL_TYPES.has(item.product.type) && !config.cabinetDoor) {
    return `non-panel:${item.id}`;
  }

  return JSON.stringify({
    productType: item.product.type,
    productId: item.product.id,
    cabinetDoor: Boolean(config.cabinetDoor),
    doorMaterial: String(config.doorMaterial || ''),
    width: Number(config.width || 0),
    height: Number(config.height || 0),
    thickness: Number(config.thickness || 0),
    colorId: String(config.colorId || ''),
    pegHolePattern: String(config.pegHolePattern || ''),
    marineSpecId: String(config.marineSpecId || ''),
    doorOverlay: String(config.doorOverlay || ''),
    openingSide: String(config.openingSide || ''),
    marginMm: Number(config.marginMm || 0),
    hingeSide: String(config.hingeSide || ''),
    hingePositionsMm: normalizedNumberList(config.hingePositionsMm || config.hingePositions),
    hingeCount: Number(config.hingeCount || 0),
    hingeUnitPrice: Number(config.hingeUnitPrice || 0),
    frameThicknessMm: Number(config.frameThicknessMm || 0),
    unitRate: Number(config.unitRate || 0),
    unitPrice: Number(config.unitPrice ?? (Number(item.totalPrice || 0) / Math.max(1, Number(item.quantity || 0)))),
  });
};

const mergeFactoryPanelDisplayRows = (existing: CartItem, incoming: CartItem): CartItem => {
  const existingConfig = (existing.config || {}) as any;
  const incomingConfig = (incoming.config || {}) as any;
  const remarks = [...new Set([
    ...(Array.isArray(existingConfig.remarks) ? existingConfig.remarks : []),
    existingConfig.remark,
    ...(Array.isArray(incomingConfig.remarks) ? incomingConfig.remarks : []),
    incomingConfig.remark,
  ].map((value) => String(value || '').trim()).filter(Boolean))];
  return {
    ...existing,
    quantity: Number(existing.quantity || 0) + Number(incoming.quantity || 0),
    totalPrice: Number((Number(existing.totalPrice || 0) + Number(incoming.totalPrice || 0)).toFixed(2)),
    config: {
      ...existingConfig,
      diyPositions: appendVectorValues(existingConfig, incomingConfig, 'diyPosition', 'diyPositions'),
      diyRotations: appendVectorValues(existingConfig, incomingConfig, 'diyRotation', 'diyRotations'),
      remarks,
      // Keep every installation/location note in the derived PDF row, but do
      // not print one arbitrary note when multiple identical panels merge.
      remark: remarks.length === 1 ? remarks[0] : undefined,
    },
  };
};

export const groupIdenticalFactoryPanelCartItems = (cart: CartItem[]): CartItem[] => {
  const result: CartItem[] = [];
  const groupedIndex = new Map<string, number>();

  cart.forEach((item) => {
    const config = (item.config || {}) as any;
    if (!FACTORY_PANEL_TYPES.has(item.product.type) && !config.cabinetDoor) {
      result.push(item);
      return;
    }
    const key = getFactoryPanelManufacturingGroupKey(item);
    const existingIndex = groupedIndex.get(key);
    if (existingIndex === undefined) {
      result.push({
        ...item,
        config: {
          ...config,
          diyPositions: appendVectorValues({}, config, 'diyPosition', 'diyPositions'),
          diyRotations: appendVectorValues({}, config, 'diyRotation', 'diyRotations'),
          remarks: String(config.remark || '').trim() ? [String(config.remark).trim()] : [],
        },
      });
      groupedIndex.set(key, result.length - 1);
      return;
    }
    result[existingIndex] = mergeFactoryPanelDisplayRows(result[existingIndex], item);
  });

  return result;
};

/** Compact display rows for the designer-derived factory sheet/PDF only. */
export const groupFactoryDisplayCartItems = (cart: CartItem[]): CartItem[] => (
  groupIdenticalFactoryPanelCartItems(
    groupIdenticalProfileCartItems(groupDiyAccessoryCartItems(cart)),
  )
);

export const summarizeDiyScrewCartItems = (cart: CartItem[]): DiyScrewCartSummaryRow[] => (
  groupDiyScrewCartItems(cart).flatMap((item) => {
    if (!isDiyScrewAccessory(item)) return [];
    const config = (item.config || {}) as any;
    const lines = Array.isArray(config.lines) ? config.lines : [];
    const quantity = lines.reduce((sum: number, line: any) => sum + Math.max(0, Number(line?.quantity || 0)), 0)
      || Math.max(0, Number(config.totalQuantity || 0));
    if (quantity <= 0) return [];
    const orderSpec = getDiyScrewOrderSpec(
      config.profileSize || config.size || config.variantId,
      config.screwHead,
      screwLengthFromConfig(config) || 1,
    );
    return [{
      profileModel: String(config.profileSize || config.size || config.variantId || '-'),
      profileSize: String(config.profileSize || config.size || config.variantId || '-'),
      screwHead: String(config.screwHead || ''),
      screwThreadSize: orderSpec.threadSize,
      screwLengthMm: orderSpec.lengthMm,
      includesElasticFastener: Boolean(orderSpec.includesElasticFastener),
      colorId: String(config.colorId || ''),
      colorName: String(config.colorName || ''),
      quantity,
      totalPrice: Number(item.totalPrice || config.unitTotal || 0),
    }];
  })
);

export const hasDiyScrewCartItems = (cart: CartItem[]) => summarizeDiyScrewCartItems(cart).length > 0;
