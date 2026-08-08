import { CartItem, ProductType } from '../types';

interface ScrewReference {
  linkedProfileId?: string;
  linkedHoleId?: string;
}

export interface DiyScrewCartSummaryRow {
  profileModel: string;
  profileSize: string;
  screwHead: string;
  screwLengthMm: number | null;
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
  const lines = (Array.isArray(config.lines) ? config.lines : [])
    .map((line: any) => ({
      id: String(line?.id || ''),
      code: String(line?.code || ''),
      imageKey: String(line?.imageKey || ''),
      name: String(line?.name || ''),
      unitPrice: Number(line?.unitPrice || 0),
    }))
    .sort((a: any, b: any) => `${a.id}:${a.code}`.localeCompare(`${b.id}:${b.code}`));

  return JSON.stringify({
    productId: item.product.id,
    profileSize: config.profileSize || config.size || config.variantId || '',
    linkedProfileVariantId: config.linkedProfileVariantId || '',
    colorMode: config.colorMode || '',
    colorId: config.colorId || '',
    screwHead: config.screwHead || '',
    screwLengthMm: screwLengthFromConfig(config),
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

export const summarizeDiyScrewCartItems = (cart: CartItem[]): DiyScrewCartSummaryRow[] => (
  groupDiyScrewCartItems(cart).flatMap((item) => {
    if (!isDiyScrewAccessory(item)) return [];
    const config = (item.config || {}) as any;
    const lines = Array.isArray(config.lines) ? config.lines : [];
    const quantity = lines.reduce((sum: number, line: any) => sum + Math.max(0, Number(line?.quantity || 0)), 0)
      || Math.max(0, Number(config.totalQuantity || 0));
    if (quantity <= 0) return [];
    return [{
      profileModel: String(config.linkedProfileVariantId || config.profileSize || config.size || config.variantId || '-'),
      profileSize: String(config.profileSize || config.size || config.variantId || '-'),
      screwHead: String(config.screwHead || ''),
      screwLengthMm: screwLengthFromConfig(config),
      colorId: String(config.colorId || ''),
      colorName: String(config.colorName || ''),
      quantity,
      totalPrice: Number(item.totalPrice || config.unitTotal || 0),
    }];
  })
);

export const hasDiyScrewCartItems = (cart: CartItem[]) => summarizeDiyScrewCartItems(cart).length > 0;
