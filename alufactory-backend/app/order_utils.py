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
    # Keep filename aligned with original order number format, e.g. ORDxxxxxxxx...
    order_ref = sanitize_filename_part(
        getattr(order, 'order_number', None) or getattr(order, 'id', None),
        fallback='ORDER'
    )
    return f'{order_ref}.pdf'
