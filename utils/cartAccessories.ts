import { CartItem, ProductType } from '../types';

interface ScrewReference {
  linkedProfileId?: string;
  linkedHoleId?: string;
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

const isDiyScrewAccessory = (item: CartItem) => {
  if (item.product.type !== ProductType.ACCESSORY) return false;
  const config = (item.config || {}) as any;
  const lines = Array.isArray(config.lines) ? config.lines : [];
  return Boolean(config.screwHead)
    || lines.some((line: any) => String(line?.id || '').startsWith('diy-') && String(line?.id || '').includes('screw'));
};

const screwGroupKey = (item: CartItem) => {
  const config = (item.config || {}) as any;
  const lines = (Array.isArray(config.lines) ? config.lines : [])
    .map((line: any) => ({
      id: String(line?.id || ''),
      code: String(line?.code || ''),
      imageKey: String(line?.imageKey || ''),
      name: String(line?.name || ''),
      unitPrice: Number(line?.unitPrice || 0),
      isBulk: Boolean(line?.isBulk),
    }))
    .sort((a: any, b: any) => `${a.id}:${a.code}`.localeCompare(`${b.id}:${b.code}`));

  return JSON.stringify({
    productId: item.product.id,
    profileSize: config.profileSize || config.size || config.variantId || '',
    colorMode: config.colorMode || '',
    colorId: config.colorId || '',
    screwHead: config.screwHead || '',
    lines,
  });
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
 * series/head/color/price combination. Linked hole references are retained so
 * production data can still trace every physical screw back to the design.
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
