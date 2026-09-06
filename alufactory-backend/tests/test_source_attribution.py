from app.source_attribution import build_source_statistics, summarize_order_source
from app.order_snapshot import fingerprint_order_json


class Item:
    def __init__(self, quantity, config):
        self.quantity = quantity
        self.config = config


class Order:
    def __init__(self, items):
        self.items = items


def test_plugin_source_survives_order_item_config_and_is_counted():
    plugin_source = {
        'schemaVersion': 1,
        'channel': 'sketchup_plugin',
        'producerId': 'mengkaile.sketchup.exporter',
        'producerVersion': '1.1.0',
        'documentId': 'export-001',
        'containedChannels': ['sketchup_plugin'],
        'verification': 'self_declared',
    }
    order = Order([
        Item(2, {'variantId': '3030', 'designSource': plugin_source}),
        Item(3, {'type': 'profile_accessory', 'designSource': plugin_source}),
    ])

    source = summarize_order_source(order)
    assert source['channel'] == 'sketchup_plugin'
    assert source['item_quantity'] == 5
    assert source['verification'] == 'self_declared'

    statistics = build_source_statistics([order, Order([Item(1, {})])])
    assert statistics['attributed_order_count'] == 1
    assert statistics['sketchup_plugin_order_count'] == 1
    assert statistics['server_verified_order_count'] == 0
    assert statistics['breakdown'] == [
        {
            'channel': 'legacy_unspecified',
            'label': '旧数据（来源未记录）',
            'order_count': 1,
            'item_quantity': 1,
        },
        {
            'channel': 'sketchup_plugin',
            'label': 'SketchUp 萌开了插件',
            'order_count': 1,
            'item_quantity': 5,
        },
    ]


def test_mixed_source_keeps_plugin_attribution():
    mixed_source = {
        'channel': 'mixed',
        'producerId': 'mengkaile.mixed-design',
        'documentId': 'mixed-001',
        'containedChannels': ['sketchup_plugin', 'manual_designer'],
        'verification': 'local',
    }
    statistics = build_source_statistics([
        Order([Item(4, {'designSource': mixed_source})]),
    ])
    assert statistics['sketchup_plugin_order_count'] == 1
    assert statistics['breakdown'][0]['channel'] == 'mixed'


def test_tagged_and_legacy_rows_are_reported_as_mixed():
    plugin_source = {
        'channel': 'sketchup_plugin',
        'producerId': 'mengkaile.sketchup.exporter',
        'documentId': 'export-002',
        'containedChannels': ['sketchup_plugin'],
        'verification': 'self_declared',
    }
    source = summarize_order_source(Order([
        Item(1, {'designSource': plugin_source}),
        Item(2, {}),
    ]))
    assert source['channel'] == 'mixed'
    assert source['contained_channels'] == ['sketchup_plugin', 'legacy_unspecified']


def test_provenance_is_preserved_but_ignored_by_duplicate_fingerprint():
    first = {
        'items': [{'product_id': '3030', 'config': {
            'length': 800,
            'designSource': {'channel': 'sketchup_plugin', 'documentId': 'export-a'},
        }}],
    }
    second = {
        'items': [{'product_id': '3030', 'config': {
            'length': 800,
            'designSource': {'channel': 'sketchup_plugin', 'documentId': 'export-b'},
        }}],
    }
    assert fingerprint_order_json(first) == fingerprint_order_json(second)
    assert first['items'][0]['config']['designSource']['documentId'] == 'export-a'
