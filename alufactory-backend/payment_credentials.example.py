"""
Payment credentials template.

1) Copy this file to: payment_credentials_local.py
2) Fill in real values on your server (Alibaba ECS)
3) Keep payment_credentials_local.py out of Git
"""

# ===== Alipay =====
ALIPAY_APP_ID = ''
ALIPAY_PRIVATE_KEY = '''
-----BEGIN PRIVATE KEY-----
PASTE_ALIPAY_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----
'''.strip()
ALIPAY_PUBLIC_KEY = '''
-----BEGIN PUBLIC KEY-----
PASTE_ALIPAY_PUBLIC_KEY_HERE
-----END PUBLIC KEY-----
'''.strip()
ALIPAY_NOTIFY_URL = ''
ALIPAY_RETURN_URL = ''
ALIPAY_PUBLIC_BASE_URL = ''  # e.g. https://mengkaile.top (used to auto-build notify/return when above are empty)
ALIPAY_GATEWAY_URL = 'https://openapi.alipay.com/gateway.do'  # sandbox: https://openapi-sandbox.dl.alipaydev.com/gateway.do
ALIPAY_DEBUG = False

# ===== WeChat Pay =====
WECHAT_APP_ID = ''
WECHAT_MCH_ID = ''
WECHAT_API_V3_KEY = ''
WECHAT_PRIVATE_KEY_PATH = ''
WECHAT_CERT_SERIAL_NO = ''
WECHAT_NOTIFY_URL = ''

# ===== Public display config for payment page =====
MERCHANT_DISPLAY_NAME = '上海暖橙黄信息科技有限公司'
ALIPAY_QR_IMAGE_URL = '/images/alipay-qr.jpg'
WECHAT_QR_IMAGE_URL = '/images/wechatpay-qr.png'
WECHAT_CONTACT = '19821200413'

# True: payment page supports manual confirmation flow
PAYMENT_MANUAL_CONFIRMATION = True

# Optional redirect path after successful payment callback page
PAYMENT_SUCCESS_REDIRECT = '/#/history'
