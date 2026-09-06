import {
  createDesignSourceInfo,
  designSourceFromDocument,
  mergeDesignSourceInfo,
  normalizeDesignSourceInfo,
} from '../utils/designSource';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const canonicalPlugin = designSourceFromDocument({
  provenance: {
    schemaVersion: 1,
    channel: 'sketchup_plugin',
    producerId: 'mengkaile.sketchup.exporter',
    producerVersion: '1.1.0',
    documentId: 'plugin-export-001',
    modelName: '测试模型.skp',
    containedChannels: ['sketchup_plugin'],
    verification: 'self_declared',
  },
});
assert(canonicalPlugin.channel === 'sketchup_plugin', 'canonical plugin source was not recognized');
assert(canonicalPlugin.documentId === 'plugin-export-001', 'plugin document id was not preserved');

const legacyPlugin = designSourceFromDocument({
  savedAt: '2026-09-04T00:00:00Z',
  source: {
    exporter: 'MengkaileJsonExporter',
    exporterVersion: '1.0.0',
    modelName: '旧插件模型.skp',
  },
  warnings: [],
});
assert(legacyPlugin.channel === 'sketchup_plugin', 'legacy plugin JSON compatibility failed');
assert(legacyPlugin.verification === 'legacy_inferred', 'legacy source must remain explicitly inferred');

const legacyFullPlugin = designSourceFromDocument({
  format: 'mengkaile-diy',
  schemaVersion: 2,
  savedAt: '2026-09-04T00:00:00.000Z',
  sourceSummary: '由SketchUp导出：36根型材、22块板件',
  warnings: [],
}, 'designer_json', { modelName: '完整插件旧文件.json' });
assert(legacyFullPlugin.channel === 'sketchup_plugin', 'legacy full plugin JSON source was not inferred');
assert(legacyFullPlugin.producerId === 'lona.aluminum-profile-splitter', 'legacy full plugin producer was not retained');

const actualPluginLegacyBlock = designSourceFromDocument({
  format: 'mengkaile-diy',
  source: {
    exporter: 'AluminumProfileSplitter',
    producerId: 'lona.aluminum-profile-splitter',
    exporterVersion: '2.43.1',
    documentId: 'actual-plugin-001',
  },
});
assert(actualPluginLegacyBlock.channel === 'sketchup_plugin', 'active splitter source block was not recognized');
assert(actualPluginLegacyBlock.producerId === 'lona.aluminum-profile-splitter', 'active splitter producer id was lost');

const mixed = mergeDesignSourceInfo(
  canonicalPlugin,
  createDesignSourceInfo('manual_designer', { documentId: 'manual-001' }),
);
assert(mixed.channel === 'mixed', 'combined designs must be marked mixed');
assert(mixed.containedChannels.includes('sketchup_plugin'), 'mixed design lost plugin attribution');
assert(mixed.containedChannels.includes('manual_designer'), 'mixed design lost manual attribution');

const cartRoundTrip = JSON.parse(JSON.stringify({
  config: { designSource: canonicalPlugin },
}));
const restored = normalizeDesignSourceInfo(cartRoundTrip.config.designSource);
assert(restored?.channel === 'sketchup_plugin', 'cart JSON round trip lost plugin source');
assert(restored?.documentId === 'plugin-export-001', 'cart JSON round trip lost document id');

console.log('Design source chain regression checks passed.');
