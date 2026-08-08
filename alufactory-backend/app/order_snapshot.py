import hashlib
import json


def _number(value):
    try:
        return round(float(value or 0), 6)
    except (TypeError, ValueError):
        return 0


def _json_safe(value):
    try:
        return json.loads(json.dumps(value, ensure_ascii=False, sort_keys=True, default=str))
    except (TypeError, ValueError):
        return str(value or '')


def build_order_json(order):
    """Build the stable order-content JSON used for admin review and duplicate checks."""
    items = []
    for item in list(getattr(order, 'items', []) or []):
        items.append({
            'product_id': str(getattr(item, 'product_id', '') or ''),
            'product_name': str(getattr(item, 'product_name', '') or ''),
            'product_type': str(getattr(item, 'product_type', '') or ''),
            'quantity': int(getattr(item, 'quantity', 0) or 0),
            'unit_price': _number(getattr(item, 'unit_price', 0)),
            'total_price': _number(getattr(item, 'total_price', 0)),
            'config': _json_safe(getattr(item, 'config', None)),
        })

    # Sorting prevents harmless cart-line order changes from hiding a duplicate.
    items.sort(key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(',', ':')))
    return {
        'schema_version': 1,
        'user_id': str(getattr(order, 'user_id', '') or ''),
        'shipping_address': {
            'recipient_name': str(getattr(order, 'recipient_name', '') or ''),
            'phone': str(getattr(order, 'phone', '') or ''),
            'province': str(getattr(order, 'province', '') or ''),
            'address_detail': str(getattr(order, 'address_detail', '') or ''),
        },
        'shipping': {
            'method': str(getattr(order, 'shipping_method', '') or ''),
            'fee': _number(getattr(order, 'shipping_fee', 0)),
            'overlength_fee': _number(getattr(order, 'overlength_fee', 0)),
        },
        'amounts': {
            'subtotal': _number(getattr(order, 'subtotal', 0)),
            'total': _number(getattr(order, 'total_amount', 0)),
        },
        'memo': str(getattr(order, 'memo', '') or ''),
        'items': items,
    }


def fingerprint_order_json(order_json):
    canonical = json.dumps(order_json, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def refresh_order_json(order):
    snapshot = build_order_json(order)
    order.order_json = snapshot
    order.duplicate_fingerprint = fingerprint_order_json(snapshot)
    return snapshot
