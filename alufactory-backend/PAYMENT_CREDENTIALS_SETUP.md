# Payment Credentials Setup (ECS)

## 1) Create local credentials file (not committed)

Copy:

- `payment_credentials.example.py`

to:

- `payment_credentials_local.py`

Then paste your real values:

- Alipay: `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`, etc.
- WeChat Pay: `WECHAT_APP_ID`, `WECHAT_MCH_ID`, `WECHAT_API_V3_KEY`, etc.

For Alipay callback URL generation, set one of:

- `ALIPAY_PUBLIC_BASE_URL=https://your-domain.com` (recommended)
- or ensure root `.env` has `VITE_API_URL=https://your-domain.com/api`

Then backend auto-derives:

- notify: `https://your-domain.com/api/payments/alipay/notify`
- return: `https://your-domain.com/api/payments/alipay/return`

## 2) Keep secrets out of Git

`.gitignore` already includes:

- `alufactory-backend/payment_credentials_local.py`
- common key files (`*.pem` etc.)

## 3) Deploy to Alibaba ECS manually

Upload `payment_credentials_local.py` to the backend folder on ECS:

- `alufactory-backend/payment_credentials_local.py`

Restart backend service after upload.

## 4) Frontend payment page

Frontend reads payment display config from API:

- `GET /api/payments/config`

Payment success call:

- `POST /api/payments/orders/<order_id>/process`

When this endpoint succeeds, order status is updated to `confirmed` (shown as `已付款` in Chinese UI).
