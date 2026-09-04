import importlib.util
from pathlib import Path


module_path = Path(__file__).resolve().parents[1] / 'alufactory-backend' / 'app' / 'source_attribution.py'
spec = importlib.util.spec_from_file_location('source_attribution_standalone', module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

snapshot_path = Path(__file__).resolve().parents[1] / 'alufactory-backend' / 'app' / 'order_snapshot.py'
snapshot_spec = importlib.util.spec_from_file_location('order_snapshot_standalone', snapshot_path)
snapshot_module = importlib.util.module_from_spec(snapshot_spec)
snapshot_spec.loader.exec_module(snapshot_module)


class Item:
    def __init__(self, quantity, config):
        self.quantity = quantity
        self.config = config


class Order:
    def __init__(self, items):
        self.items = items


plugin_source = {
    'channel': 'sketchup_plugin',
    'producerId': 'mengkaile.sketchup.exporter',
    'documentId': 'plugin-001',
    'containedChannels': ['sketchup_plugin'],
    'verification': 'self_declared',
}
plugin_order = Order([
    Item(2, {'designSource': plugin_source}),
    Item(3, {'designSource': plugin_source}),
])
legacy_order = Order([Item(1, {})])

summary = module.summarize_order_source(plugin_order)
assert summary['channel'] == 'sketchup_plugin'
assert summary['item_quantity'] == 5

statistics = module.build_source_statistics([plugin_order, legacy_order])
assert statistics['sketchup_plugin_order_count'] == 1
assert statistics['attributed_order_count'] == 1
assert statistics['server_verified_order_count'] == 0
assert {row['channel'] for row in statistics['breakdown']} == {
    'sketchup_plugin',
    'legacy_unspecified',
}

partly_tagged = module.summarize_order_source(Order([
    Item(1, {'designSource': plugin_source}),
    Item(1, {}),
]))
assert partly_tagged['channel'] == 'mixed'
assert partly_tagged['contained_channels'] == ['sketchup_plugin', 'legacy_unspecified']

first_snapshot = {
    'items': [{'product_id': '3030', 'config': {'length': 800, 'designSource': plugin_source}}],
}
second_snapshot = {
    'items': [{
        'product_id': '3030',
        'config': {
            'length': 800,
            'designSource': {**plugin_source, 'documentId': 'plugin-002'},
        },
    }],
}
assert snapshot_module.fingerprint_order_json(first_snapshot) == snapshot_module.fingerprint_order_json(second_snapshot)
assert first_snapshot['items'][0]['config']['designSource']['documentId'] == 'plugin-001'

print('Backend source attribution regression checks passed.')
