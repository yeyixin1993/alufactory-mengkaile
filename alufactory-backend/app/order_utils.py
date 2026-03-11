import re
from datetime import datetime, timedelta, timezone

EAST8_TIMEZONE = timezone(timedelta(hours=8), name='UTC+8')


def to_east8_datetime(value):
    if value is None:
        return None

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)

    return value.astimezone(EAST8_TIMEZONE)


def to_east8_isoformat(value):
    east8_value = to_east8_datetime(value)
    if east8_value is None:
        return None
    return east8_value.isoformat(timespec='seconds')


def sanitize_filename_part(value, fallback='unknown'):
    safe_value = re.sub(r'[\\/:*?"<>|]+', '-', str(value or '').strip())
    safe_value = re.sub(r'\s+', '_', safe_value)
    safe_value = re.sub(r'_+', '_', safe_value)
    safe_value = safe_value.strip('._-')
    return safe_value or fallback


def build_order_pdf_filename(order):
    created_at = to_east8_datetime(getattr(order, 'created_at', None)) or datetime.now(EAST8_TIMEZONE)
    timestamp = created_at.strftime('%Y%m%d_%H%M%S')
    user_label = sanitize_filename_part(
        getattr(order, 'recipient_name', None)
        or getattr(order, 'phone', None)
        or getattr(order, 'user_id', None),
        fallback='guest'
    )
    amount = getattr(order, 'total_amount', 0) or 0
    order_ref = sanitize_filename_part(
        getattr(order, 'order_number', None) or getattr(order, 'id', None),
        fallback='ORDER'
    )
    return f'生产单_{timestamp}_用户_{user_label}_金额_{amount:.2f}_{order_ref}.pdf'
