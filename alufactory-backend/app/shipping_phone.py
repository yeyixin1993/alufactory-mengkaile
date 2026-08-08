import re


SHIPPING_PHONE_PATTERN = re.compile(r'^1\d{10}(?:-\d{4})?$')
SHIPPING_PHONE_ERROR = 'Phone must be 11 digits, optionally followed by a dash and 4-digit virtual number'


def normalize_shipping_phone(value) -> str:
    """Return the canonical shipping-phone form used in addresses and orders."""
    phone = str(value or '').strip()
    for separator in ('‐', '‑', '‒', '–', '—', '―', '－'):
        phone = phone.replace(separator, '-')
    return ''.join(phone.split())


def validate_shipping_phone(value) -> str:
    phone = normalize_shipping_phone(value)
    if not SHIPPING_PHONE_PATTERN.fullmatch(phone):
        raise ValueError(SHIPPING_PHONE_ERROR)
    return phone

