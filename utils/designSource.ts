import type { DesignSourceChannel, DesignSourceInfo, Language } from '../types';

const KNOWN_CHANNELS = new Set<DesignSourceChannel>([
  'sketchup_plugin',
  'parametric_template',
  'maycad_scene',
  'production_xlsx',
  'designer_json',
  'system_order',
  'manual_designer',
  'external_json',
  'mixed',
  'legacy_unspecified',
]);

const KNOWN_VERIFICATIONS = new Set<DesignSourceInfo['verification']>([
  'local',
  'self_declared',
  'legacy_inferred',
  'server_verified',
]);

const cleanText = (value: unknown, maxLength = 240) => {
  const text = String(value || '').trim();
  return text ? text.slice(0, maxLength) : undefined;
};

const makeDocumentId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const uniqueChannels = (values: unknown[]): DesignSourceChannel[] => {
  const result: DesignSourceChannel[] = [];
  values.forEach((value) => {
    const channel = String(value || '') as DesignSourceChannel;
    if (!KNOWN_CHANNELS.has(channel) || channel === 'mixed' || result.includes(channel)) return;
    result.push(channel);
  });
  return result.length ? result : ['legacy_unspecified'];
};

const DEFAULT_PRODUCERS: Record<DesignSourceChannel, string> = {
  sketchup_plugin: 'mengkaile.sketchup.exporter',
  parametric_template: 'mengkaile.parametric-template',
  maycad_scene: 'maycad.scene-import',
  production_xlsx: 'mengkaile.production-xlsx',
  designer_json: 'mengkaile.diy-designer',
  system_order: 'mengkaile.order-json',
  manual_designer: 'mengkaile.diy-designer',
  external_json: 'external.json',
  mixed: 'mengkaile.mixed-design',
  legacy_unspecified: 'legacy.unspecified',
};

export const createDesignSourceInfo = (
  channel: DesignSourceChannel,
  details: Partial<DesignSourceInfo> = {},
): DesignSourceInfo => {
  const containedChannels = uniqueChannels([
    ...(Array.isArray(details.containedChannels) ? details.containedChannels : []),
    channel,
  ]);
  return {
    schemaVersion: 1,
    channel,
    producerId: cleanText(details.producerId, 120) || DEFAULT_PRODUCERS[channel],
    producerVersion: cleanText(details.producerVersion, 40),
    documentId: cleanText(details.documentId, 120) || makeDocumentId(),
    modelName: cleanText(details.modelName, 180),
    exportedAt: cleanText(details.exportedAt, 48),
    importedAt: cleanText(details.importedAt, 48),
    sourceSummary: cleanText(details.sourceSummary, 400),
    warningsCount: Number.isFinite(Number(details.warningsCount))
      ? Math.max(0, Math.round(Number(details.warningsCount)))
      : undefined,
    containedChannels,
    verification: KNOWN_VERIFICATIONS.has(details.verification as DesignSourceInfo['verification'])
      ? details.verification as DesignSourceInfo['verification']
      : 'local',
  };
};

export const normalizeDesignSourceInfo = (value: unknown): DesignSourceInfo | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const channel = String(source.channel || '') as DesignSourceChannel;
  if (!KNOWN_CHANNELS.has(channel)) return null;
  return createDesignSourceInfo(channel, {
    producerId: source.producerId as string,
    producerVersion: (source.producerVersion || source.exporterVersion) as string,
    documentId: (source.documentId || source.exportId) as string,
    modelName: (source.modelName || source.sourceFileName) as string,
    exportedAt: source.exportedAt as string,
    importedAt: source.importedAt as string,
    sourceSummary: (source.sourceSummary || source.summary) as string,
    warningsCount: source.warningsCount as number,
    containedChannels: uniqueChannels(Array.isArray(source.containedChannels) ? source.containedChannels : [channel]),
    verification: source.verification as DesignSourceInfo['verification'],
  });
};

const sourceFromItemConfigs = (items: unknown): DesignSourceInfo | null => {
  if (!Array.isArray(items)) return null;
  const sources = items
    .map((item) => normalizeDesignSourceInfo((item as any)?.config?.designSource))
    .filter((source): source is DesignSourceInfo => Boolean(source));
  if (!sources.length) return null;
  return sources.slice(1).reduce((current, source) => mergeDesignSourceInfo(current, source), sources[0]);
};

export const designSourceFromDocument = (
  document: any,
  fallbackChannel: DesignSourceChannel = 'designer_json',
  fallbackDetails: Partial<DesignSourceInfo> = {},
): DesignSourceInfo => {
  const canonical = normalizeDesignSourceInfo(
    document?.provenance || document?.designSource || document?.sourceInfo,
  );
  if (canonical) {
    return createDesignSourceInfo(canonical.channel, {
      ...canonical,
      importedAt: new Date().toISOString(),
      sourceSummary: canonical.sourceSummary || document?.sourceSummary,
      warningsCount: canonical.warningsCount
        ?? (Array.isArray(document?.warnings) ? document.warnings.length : undefined),
    });
  }

  const orderSource = sourceFromItemConfigs(document?.order_json?.items || document?.items);
  if (orderSource) {
    return createDesignSourceInfo(orderSource.channel, {
      ...orderSource,
      importedAt: new Date().toISOString(),
    });
  }

  const legacy = document?.source;
  if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
    const isMengkaileSketchUp = String(legacy.exporter || '') === 'MengkaileJsonExporter'
      || String(legacy.exporter || '') === 'AluminumProfileSplitter'
      || String(legacy.producerId || '') === 'mengkaile.sketchup.exporter'
      || String(legacy.producerId || '') === 'lona.aluminum-profile-splitter';
    const channel: DesignSourceChannel = isMengkaileSketchUp ? 'sketchup_plugin' : fallbackChannel;
    return createDesignSourceInfo(channel, {
      producerId: isMengkaileSketchUp
        ? cleanText(legacy.producerId, 120) || (String(legacy.exporter || '') === 'AluminumProfileSplitter'
          ? 'lona.aluminum-profile-splitter'
          : 'mengkaile.sketchup.exporter')
        : fallbackDetails.producerId,
      producerVersion: legacy.exporterVersion,
      documentId: legacy.documentId || legacy.exportId,
      modelName: legacy.modelName,
      exportedAt: document?.savedAt || document?.exportedAt,
      importedAt: new Date().toISOString(),
      sourceSummary: document?.sourceSummary,
      warningsCount: Array.isArray(document?.warnings) ? document.warnings.length : undefined,
      verification: 'legacy_inferred',
      containedChannels: [channel],
    });
  }

  if (
    document?.format === 'mengkaile-diy'
    && /SketchUp/i.test(String(document?.sourceSummary || ''))
  ) {
    return createDesignSourceInfo('sketchup_plugin', {
      producerId: 'lona.aluminum-profile-splitter',
      modelName: fallbackDetails.modelName,
      exportedAt: document?.savedAt || document?.exportedAt,
      importedAt: new Date().toISOString(),
      sourceSummary: document?.sourceSummary,
      warningsCount: Array.isArray(document?.warnings) ? document.warnings.length : undefined,
      verification: 'legacy_inferred',
      containedChannels: ['sketchup_plugin'],
    });
  }

  return createDesignSourceInfo(fallbackChannel, {
    ...fallbackDetails,
    importedAt: new Date().toISOString(),
  });
};

export const mergeDesignSourceInfo = (
  existing: DesignSourceInfo,
  incoming: DesignSourceInfo,
): DesignSourceInfo => {
  if (existing.documentId === incoming.documentId) return incoming;
  const containedChannels = uniqueChannels([
    ...existing.containedChannels,
    existing.channel,
    ...incoming.containedChannels,
    incoming.channel,
  ]);
  return createDesignSourceInfo('mixed', {
    producerId: 'mengkaile.mixed-design',
    documentId: makeDocumentId(),
    importedAt: new Date().toISOString(),
    sourceSummary: [existing.modelName || existing.sourceSummary, incoming.modelName || incoming.sourceSummary]
      .filter(Boolean)
      .join(' + '),
    containedChannels,
    verification: existing.verification === 'server_verified' && incoming.verification === 'server_verified'
      ? 'server_verified'
      : 'local',
  });
};

const LABELS: Record<Language, Record<DesignSourceChannel, string>> = {
  cn: {
    sketchup_plugin: 'SketchUp 萌开了插件',
    parametric_template: '参数化产品模板',
    maycad_scene: 'MayCAD 场景',
    production_xlsx: '生产 Excel',
    designer_json: '设计器 JSON',
    system_order: '系统订单 JSON',
    manual_designer: '设计器手工创建',
    external_json: '外部 JSON',
    mixed: '多来源组合设计',
    legacy_unspecified: '旧数据（来源未记录）',
  },
  en: {
    sketchup_plugin: 'SketchUp Mengkaile plugin',
    parametric_template: 'Parametric product template',
    maycad_scene: 'MayCAD scene',
    production_xlsx: 'Production Excel',
    designer_json: 'Designer JSON',
    system_order: 'System order JSON',
    manual_designer: 'Created in designer',
    external_json: 'External JSON',
    mixed: 'Mixed-source design',
    legacy_unspecified: 'Legacy data (unattributed)',
  },
  jp: {
    sketchup_plugin: 'SketchUp 萌開了プラグイン',
    parametric_template: 'パラメトリック製品テンプレート',
    maycad_scene: 'MayCAD シーン',
    production_xlsx: '生産 Excel',
    designer_json: 'デザイナー JSON',
    system_order: 'システム注文 JSON',
    manual_designer: 'デザイナーで作成',
    external_json: '外部 JSON',
    mixed: '複数ソースの設計',
    legacy_unspecified: '旧データ（出所未記録）',
  },
};

export const getDesignSourceLabel = (source: DesignSourceInfo | null | undefined, language: Language) => (
  source ? LABELS[language][source.channel] : LABELS[language].legacy_unspecified
);
