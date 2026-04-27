import os
from urllib.parse import urlparse


def _as_bool(value):
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


def _load_local_file_values():
    """
    Load local payment credentials from payment_credentials_local.py.
    This file is intended to be git-ignored and manually deployed on ECS.
    """
    try:
        import payment_credentials_local as local_creds  # type: ignore
    except Exception:
        # Backward compatibility: user may have used dotted filename payment_credentials.local.py
        try:
            import importlib.util
            file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'payment_credentials.local.py')
            if os.path.exists(file_path):
                spec = importlib.util.spec_from_file_location('payment_credentials_local_compat', file_path)
                if spec and spec.loader:
                    compat_module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(compat_module)
                    local_creds = compat_module
                else:
                    return {}
            else:
                return {}
        except Exception:
            return {}

    return {
        'ALIPAY_APP_ID': getattr(local_creds, 'ALIPAY_APP_ID', ''),
        'ALIPAY_PRIVATE_KEY': getattr(local_creds, 'ALIPAY_PRIVATE_KEY', ''),
        'ALIPAY_PUBLIC_KEY': getattr(local_creds, 'ALIPAY_PUBLIC_KEY', ''),
        'ALIPAY_NOTIFY_URL': getattr(local_creds, 'ALIPAY_NOTIFY_URL', ''),
        'ALIPAY_RETURN_URL': getattr(local_creds, 'ALIPAY_RETURN_URL', ''),
        'ALIPAY_GATEWAY_URL': getattr(local_creds, 'ALIPAY_GATEWAY_URL', ''),
        'ALIPAY_DEBUG': getattr(local_creds, 'ALIPAY_DEBUG', False),
        'WECHAT_APP_ID': getattr(local_creds, 'WECHAT_APP_ID', ''),
        'WECHAT_MCH_ID': getattr(local_creds, 'WECHAT_MCH_ID', ''),
        'WECHAT_API_V3_KEY': getattr(local_creds, 'WECHAT_API_V3_KEY', ''),
        'WECHAT_PRIVATE_KEY_PATH': getattr(local_creds, 'WECHAT_PRIVATE_KEY_PATH', ''),
        'WECHAT_CERT_SERIAL_NO': getattr(local_creds, 'WECHAT_CERT_SERIAL_NO', ''),
        'WECHAT_NOTIFY_URL': getattr(local_creds, 'WECHAT_NOTIFY_URL', ''),
        'MERCHANT_DISPLAY_NAME': getattr(local_creds, 'MERCHANT_DISPLAY_NAME', ''),
        'ALIPAY_QR_IMAGE_URL': getattr(local_creds, 'ALIPAY_QR_IMAGE_URL', ''),
        'WECHAT_QR_IMAGE_URL': getattr(local_creds, 'WECHAT_QR_IMAGE_URL', ''),
        'WECHAT_CONTACT': getattr(local_creds, 'WECHAT_CONTACT', ''),
        'PAYMENT_MANUAL_CONFIRMATION': getattr(local_creds, 'PAYMENT_MANUAL_CONFIRMATION', True),
        'PAYMENT_SUCCESS_REDIRECT': getattr(local_creds, 'PAYMENT_SUCCESS_REDIRECT', ''),
        'ALIPAY_PUBLIC_BASE_URL': getattr(local_creds, 'ALIPAY_PUBLIC_BASE_URL', ''),
    }


def _derive_public_site_base(local_values):
    """
    Priority:
    1) ALIPAY_PUBLIC_BASE_URL (recommended)
    2) VITE_API_URL (strip trailing /api)
    3) empty string
    """
    raw = ''
    local_base = local_values.get('ALIPAY_PUBLIC_BASE_URL')
    if isinstance(local_base, str) and local_base.strip():
        raw = local_base.strip()
    else:
        raw = str(os.getenv('ALIPAY_PUBLIC_BASE_URL', '')).strip() or str(os.getenv('VITE_API_URL', '')).strip()

    if not raw:
        return ''

    try:
        parsed = urlparse(raw)
        if parsed.scheme and parsed.netloc:
            base = f"{parsed.scheme}://{parsed.netloc}"
            return base.rstrip('/')
    except Exception:
        pass

    return raw.rstrip('/').replace('/api', '')


def _normalize_pem_key(value, is_private=False):
    raw = str(value or '').strip()
    if not raw:
        return ''

    # Remove accidental wrapping quotes and normalize newlines
    raw = raw.strip('"').strip("'").replace('\\n', '\n').replace('\r\n', '\n')

    # Already PEM
    if '-----BEGIN' in raw and '-----END' in raw:
        return raw

    # Convert bare base64 body to PEM
    compact = ''.join(raw.split())
    if not compact:
        return ''

    header = '-----BEGIN PRIVATE KEY-----' if is_private else '-----BEGIN PUBLIC KEY-----'
    footer = '-----END PRIVATE KEY-----' if is_private else '-----END PUBLIC KEY-----'
    body = '\n'.join(compact[i:i + 64] for i in range(0, len(compact), 64))
    return f'{header}\n{body}\n{footer}'


def get_payment_settings():
    local_values = _load_local_file_values()
    public_site_base = _derive_public_site_base(local_values)

    def read(key, default=''):
        from_local = local_values.get(key)
        if isinstance(from_local, str) and from_local.strip() != '':
            return from_local.strip()
        if from_local not in (None, '') and not isinstance(from_local, str):
            return from_local
        return os.getenv(key, default)

    manual_confirmation = local_values.get('PAYMENT_MANUAL_CONFIRMATION', None)
    if manual_confirmation is None:
        manual_confirmation = _as_bool(os.getenv('PAYMENT_MANUAL_CONFIRMATION', '1'))

    return {
        # Sensitive fields (never exposed by API)
        'alipay': {
            'app_id': read('ALIPAY_APP_ID', ''),
            'private_key': _normalize_pem_key(read('ALIPAY_PRIVATE_KEY', ''), is_private=True),
            'public_key': _normalize_pem_key(read('ALIPAY_PUBLIC_KEY', ''), is_private=False),
            'notify_url': read('ALIPAY_NOTIFY_URL', ''),
            'return_url': read('ALIPAY_RETURN_URL', ''),
            'gateway_url': read('ALIPAY_GATEWAY_URL', 'https://openapi.alipay.com/gateway.do'),
            'debug': _as_bool(read('ALIPAY_DEBUG', '0')),
        },
        'wechat_pay': {
            'app_id': read('WECHAT_APP_ID', ''),
            'mch_id': read('WECHAT_MCH_ID', ''),
            'api_v3_key': read('WECHAT_API_V3_KEY', ''),
            'private_key_path': read('WECHAT_PRIVATE_KEY_PATH', ''),
            'cert_serial_no': read('WECHAT_CERT_SERIAL_NO', ''),
            'notify_url': read('WECHAT_NOTIFY_URL', ''),
        },

        # Display/public fields for payment page
        'merchant_display_name': read('MERCHANT_DISPLAY_NAME', '上海暖橙黄信息科技有限公司'),
        'alipay_qr_image_url': read('ALIPAY_QR_IMAGE_URL', '/images/alipay-qr.jpg'),
        'wechat_qr_image_url': read('WECHAT_QR_IMAGE_URL', '/images/wechatpay-qr.png'),
        'wechat_contact': read('WECHAT_CONTACT', '19821200413'),
        'manual_confirmation': bool(manual_confirmation),
        'payment_success_redirect': read('PAYMENT_SUCCESS_REDIRECT', '/#/history'),
        'public_site_base': public_site_base,
    }


def is_payment_configured(method: str) -> bool:
    settings = get_payment_settings()
    if method == 'alipay':
        conf = settings.get('alipay', {})
        return bool(conf.get('app_id') and conf.get('private_key') and conf.get('public_key'))
    if method == 'wechat_pay':
        conf = settings.get('wechat_pay', {})
        return bool(conf.get('app_id') and conf.get('mch_id') and conf.get('api_v3_key'))
    return False
