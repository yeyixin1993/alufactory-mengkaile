from collections import defaultdict


KNOWN_SOURCE_CHANNELS = {
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
}

SOURCE_LABELS = {
    'sketchup_plugin': 'SketchUp 萌开了插件',
    'parametric_template': '参数化产品模板',
    'maycad_scene': 'MayCAD 场景',
    'production_xlsx': '生产 Excel',
    'designer_json': '设计器 JSON',
    'system_order': '系统订单 JSON',
    'manual_designer': '设计器手工创建',
    'external_json': '外部 JSON',
    'mixed': '多来源组合设计',
    'legacy_unspecified': '旧数据（来源未记录）',
}


def _clean_channel(value):
    channel = str(value or '').strip()
    return channel if channel in KNOWN_SOURCE_CHANNELS else None


def normalize_source_info(value):
    """Accept only the small, documented provenance surface from item config."""
    if not isinstance(value, dict):
        return None
    channel = _clean_channel(value.get('channel'))
    if not channel:
        return None
    contained = []
    raw_contained = value.get('containedChannels')
    if not isinstance(raw_contained, list):
        raw_contained = [channel]
    for raw_channel in raw_contained + [channel]:
        normalized = _clean_channel(raw_channel)
        if normalized and normalized != 'mixed' and normalized not in contained:
            contained.append(normalized)
    if not contained:
        contained = ['legacy_unspecified']
    verification = str(value.get('verification') or 'self_declared')
    if verification not in ('local', 'self_declared', 'legacy_inferred', 'server_verified'):
        verification = 'self_declared'
    return {
        'channel': channel,
        'label': SOURCE_LABELS[channel],
        'contained_channels': contained,
        'producer_id': str(value.get('producerId') or '')[:120],
        'producer_version': str(value.get('producerVersion') or '')[:40],
        'document_id': str(value.get('documentId') or '')[:120],
        'model_name': str(value.get('modelName') or '')[:180],
        'verification': verification,
    }


def summarize_order_source(order):
    sources = []
    total_quantity = 0
    for item in list(getattr(order, 'items', []) or []):
        try:
            total_quantity += max(0, int(getattr(item, 'quantity', 0) or 0))
        except (TypeError, ValueError):
            pass
        config = getattr(item, 'config', None)
        source = normalize_source_info(config.get('designSource') if isinstance(config, dict) else None)
        sources.append(source or {
            'channel': 'legacy_unspecified',
            'label': SOURCE_LABELS['legacy_unspecified'],
            'contained_channels': ['legacy_unspecified'],
            'producer_id': '',
            'producer_version': '',
            'document_id': '',
            'model_name': '',
            'verification': 'legacy_inferred',
        })

    if not sources:
        return {
            'channel': 'legacy_unspecified',
            'label': SOURCE_LABELS['legacy_unspecified'],
            'contained_channels': ['legacy_unspecified'],
            'item_quantity': total_quantity,
            'verification': 'legacy_inferred',
        }

    channels = []
    for source in sources:
        for channel in source['contained_channels']:
            if channel not in channels:
                channels.append(channel)
    primary_channels = {source['channel'] for source in sources}
    primary = next(iter(primary_channels)) if len(primary_channels) == 1 else 'mixed'
    if primary == 'mixed' and 'mixed' not in channels:
        # `mixed` is a summary classification; concrete origins remain in
        # contained_channels so plugin-attributed orders are still findable.
        pass
    verification = 'server_verified' if all(
        source['verification'] == 'server_verified' for source in sources
    ) else 'self_declared'
    return {
        'channel': primary,
        'label': SOURCE_LABELS[primary],
        'contained_channels': channels,
        'item_quantity': total_quantity,
        'verification': verification,
    }


def build_source_statistics(orders):
    breakdown = defaultdict(lambda: {'order_count': 0, 'item_quantity': 0})
    attributed_order_count = 0
    sketchup_plugin_order_count = 0
    server_verified_order_count = 0

    for order in list(orders or []):
        source = summarize_order_source(order)
        channel = source['channel']
        breakdown[channel]['order_count'] += 1
        breakdown[channel]['item_quantity'] += source['item_quantity']
        if channel != 'legacy_unspecified':
            attributed_order_count += 1
        if 'sketchup_plugin' in source['contained_channels']:
            sketchup_plugin_order_count += 1
        if source['verification'] == 'server_verified':
            server_verified_order_count += 1

    rows = [
        {
            'channel': channel,
            'label': SOURCE_LABELS[channel],
            'order_count': values['order_count'],
            'item_quantity': values['item_quantity'],
        }
        for channel, values in breakdown.items()
    ]
    rows.sort(key=lambda row: (-row['order_count'], row['channel']))
    return {
        'attributed_order_count': attributed_order_count,
        'sketchup_plugin_order_count': sketchup_plugin_order_count,
        'server_verified_order_count': server_verified_order_count,
        'breakdown': rows,
    }
