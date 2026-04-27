from datetime import datetime

from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.models.user import Order, User, db
from app.payment_settings import get_payment_settings, is_payment_configured

payment_bp = Blueprint('payments', __name__, url_prefix='/api/payments')


def _is_paid_status(status: str) -> bool:
    return status in ('confirmed', 'shipped', 'delivered')


def _build_alipay_client():
    settings = get_payment_settings()
    conf = settings.get('alipay', {})

    try:
        from alipay import AliPay  # type: ignore
    except Exception:
        return None, 'python-alipay-sdk is not installed'

    if not (conf.get('app_id') and conf.get('private_key') and conf.get('public_key')):
        return None, 'Alipay credentials are not configured'

    try:
        client = AliPay(
            appid=conf.get('app_id'),
            app_notify_url=conf.get('notify_url') or None,
            app_private_key_string=conf.get('private_key'),
            alipay_public_key_string=conf.get('public_key'),
            sign_type='RSA2',
            debug=bool(conf.get('debug', False)),
        )
        return client, None
    except Exception as exc:
        return None, str(exc)


def _mark_order_paid(order: Order, method: str, transaction_no: str = ''):
    order.payment_method = method
    order.payment_transaction_no = transaction_no or order.payment_transaction_no
    order.status = 'confirmed'
    order.paid_at = datetime.utcnow()
    order.updated_at = datetime.utcnow()


@payment_bp.route('/config', methods=['GET'])
@jwt_required()
def get_payment_config():
    """Return payment-process page config without exposing secret keys."""
    settings = get_payment_settings()

    return jsonify({
        'merchant_display_name': settings.get('merchant_display_name'),
        'manual_confirmation': settings.get('manual_confirmation', True),
        'wechat_contact': settings.get('wechat_contact', ''),
        'alipay_effective': {
            'gateway_url': (settings.get('alipay', {}) or {}).get('gateway_url', ''),
            'notify_url': (settings.get('alipay', {}) or {}).get('notify_url', ''),
            'return_url': (settings.get('alipay', {}) or {}).get('return_url', ''),
            'public_site_base': settings.get('public_site_base', ''),
        },
        'methods': {
            'alipay': {
                'enabled': True,
                'configured': is_payment_configured('alipay'),
                'display_name': 'Alipay',
                'qr_image_url': settings.get('alipay_qr_image_url') or '/images/alipay-qr.jpg',
                'web_pay_enabled': is_payment_configured('alipay'),
            },
            'wechat_pay': {
                'enabled': True,
                'configured': is_payment_configured('wechat_pay'),
                'display_name': 'WeChat Pay',
                'qr_image_url': settings.get('wechat_qr_image_url') or '/images/wechatpay-qr.png',
            },
        },
    }), 200


@payment_bp.route('/orders/<order_id>/alipay/create', methods=['POST'])
@jwt_required()
def create_alipay_page_payment(order_id):
    """Create real Alipay page payment URL for an order."""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    if order.user_id != current_user_id and not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403

    if _is_paid_status(order.status):
        return jsonify({'error': 'Order already paid'}), 400

    alipay_client, client_error = _build_alipay_client()
    if not alipay_client:
        return jsonify({'error': client_error or 'Alipay initialization failed'}), 500

    settings = get_payment_settings()
    alipay_conf = settings.get('alipay', {})

    public_site_base = str(settings.get('public_site_base') or '').strip()
    default_base = public_site_base or request.url_root.rstrip('/')

    notify_url = alipay_conf.get('notify_url') or f"{default_base}/api/payments/alipay/notify"
    return_url = alipay_conf.get('return_url') or f"{default_base}/api/payments/alipay/return"
    amount = round(float(order.total_amount or 0), 2)
    out_trade_no = order.order_number or order.id
    subject = f"Mengkaile Order {out_trade_no}"

    try:
        order_string = alipay_client.api_alipay_trade_page_pay(
            out_trade_no=out_trade_no,
            total_amount=f'{amount:.2f}',
            subject=subject,
            return_url=return_url,
            notify_url=notify_url,
        )
        gateway_url = (alipay_conf.get('gateway_url') or 'https://openapi.alipay.com/gateway.do').strip()
        pay_url = f"{gateway_url}?{order_string}"

        order.payment_method = 'alipay'
        order.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'order_id': order.id,
            'out_trade_no': out_trade_no,
            'pay_url': pay_url,
        }), 200
    except Exception as exc:
        db.session.rollback()
        current_app.logger.exception('Failed to create Alipay payment URL')
        return jsonify({'error': str(exc)}), 500


@payment_bp.route('/alipay/notify', methods=['POST'])
def alipay_notify():
    """Alipay async callback: verify signature and mark order as paid."""
    data = request.form.to_dict(flat=True) or {}
    sign = data.pop('sign', None)
    data.pop('sign_type', None)

    if not sign:
        return Response('failure', mimetype='text/plain')

    alipay_client, client_error = _build_alipay_client()
    if not alipay_client:
        current_app.logger.error(f'Alipay notify client init failed: {client_error}')
        return Response('failure', mimetype='text/plain')

    try:
        verified = alipay_client.verify(data, sign)
    except Exception:
        verified = False

    if not verified:
        return Response('failure', mimetype='text/plain')

    trade_status = str(data.get('trade_status') or '')
    if trade_status not in ('TRADE_SUCCESS', 'TRADE_FINISHED'):
        return Response('success', mimetype='text/plain')

    out_trade_no = str(data.get('out_trade_no') or '').strip()
    trade_no = str(data.get('trade_no') or '').strip()
    if not out_trade_no:
        return Response('failure', mimetype='text/plain')

    order = Order.query.filter_by(order_number=out_trade_no).first() or Order.query.get(out_trade_no)
    if not order:
        return Response('failure', mimetype='text/plain')

    try:
        if not _is_paid_status(order.status):
            _mark_order_paid(order, method='alipay', transaction_no=trade_no)
            db.session.commit()
        return Response('success', mimetype='text/plain')
    except Exception:
        db.session.rollback()
        return Response('failure', mimetype='text/plain')


@payment_bp.route('/alipay/return', methods=['GET'])
def alipay_return():
    """Alipay sync return page. User-facing result page after browser redirect."""
    args = request.args.to_dict(flat=True) or {}
    sign = args.pop('sign', None)
    args.pop('sign_type', None)
    out_trade_no = str(args.get('out_trade_no') or '').strip()

    alipay_client, client_error = _build_alipay_client()
    verified = False
    if alipay_client and sign:
        try:
            verified = alipay_client.verify(args, sign)
        except Exception:
            verified = False

    if not verified:
        html = """
        <html><body style='font-family:Arial;padding:24px;'>
        <h3>Payment verification failed</h3>
        <p>Please return to payment page and check order status.</p>
        </body></html>
        """
        return Response(html, mimetype='text/html')

    order = Order.query.filter_by(order_number=out_trade_no).first() or Order.query.get(out_trade_no)
    if order and not _is_paid_status(order.status):
        try:
            _mark_order_paid(order, method='alipay', transaction_no=str(args.get('trade_no') or '').strip())
            db.session.commit()
        except Exception:
            db.session.rollback()

    settings = get_payment_settings()
    redirect_target = settings.get('payment_success_redirect') or '/#/history'
    html = f"""
    <html>
      <body style='font-family:Arial;padding:24px;'>
        <h3>Payment callback received</h3>
        <p>You can return to order history.</p>
        <script>
          try {{
            if (window.opener && !window.opener.closed) {{
              window.opener.postMessage({{ type: 'ALIPAY_RETURN', outTradeNo: '{out_trade_no}' }}, '*');
            }}
          }} catch (e) {{}}
          setTimeout(function() {{ window.location.href = '{redirect_target}'; }}, 800);
        </script>
      </body>
    </html>
    """
    return Response(html, mimetype='text/html')


@payment_bp.route('/orders/<order_id>/process', methods=['POST'])
@jwt_required()
def process_order_payment(order_id):
    """
    Temporary payment process endpoint.
    Marks order as paid (confirmed) after payment success on payment page.
    """
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    if not current_user:
        return jsonify({'error': 'User not found'}), 404

    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    if order.user_id != current_user_id and not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    method = str(data.get('payment_method') or '').strip().lower()
    if method not in ('alipay', 'wechat_pay'):
        return jsonify({'error': 'Unsupported payment method'}), 400

    transaction_no = str(data.get('transaction_no') or '').strip()

    try:
        _mark_order_paid(order, method=method, transaction_no=transaction_no)

        db.session.commit()

        return jsonify({
            'message': 'Payment processed and order marked as paid',
            'order': order.to_dict(),
        }), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({'error': str(exc)}), 500
