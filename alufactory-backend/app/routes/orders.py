from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models.user import db, User, Cart, CartItem, Order, OrderItem, Profile, SystemSetting, FrameOption
import uuid
import os
import base64

order_bp = Blueprint('orders', __name__, url_prefix='/api/orders')


def _shared_board_default(product_type):
    if product_type == 'CABINET_DOOR':
        return {
            'board_width_mm': 2450,
            'board_height_mm': 1240,
            'min_gap_mm': 5,
            'group_factor': 1,
            'thickness_options': [2],
            'thickness_price_map': {'2': 700},
        }
    return {
        'board_width_mm': 2450,
        'board_height_mm': 1240,
        'min_gap_mm': 5,
        'group_factor': 1,
        'thickness_options': [1, 2, 3, 4, 5],
        'thickness_price_map': {'1': 780, '2': 1080, '3': 1380, '4': 1680, '5': 1980},
    }


def _get_shared_board_settings(product_type):
    key = f'shared_board_{product_type.lower()}_settings'
    row = SystemSetting.query.filter_by(key=key).first()
    defaults = _shared_board_default(product_type)
    if not row:
        return defaults

    value = row.value or {}
    merged = dict(defaults)
    merged.update(value)
    return merged

@order_bp.route('', methods=['GET'])
@jwt_required()
def get_orders():
    """Get orders for current user or all orders if admin"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user.is_admin:
        orders = Order.query.all()
    else:
        orders = Order.query.filter_by(user_id=current_user_id).all()
    
    return jsonify({
        'orders': [order.to_dict() for order in orders]
    }), 200


@order_bp.route('/<order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    """Get single order"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    
    if order.user_id != current_user_id and not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify(order.to_dict()), 200


@order_bp.route('', methods=['POST'])
@jwt_required()
def create_order():
    """Create a new order from cart"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    # Validation
    required_fields = ['items', 'recipient_name', 'phone', 'province', 'address_detail', 'total_amount']
    if not data or not all(k in data for k in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        # Generate order number
        order_number = f"ORD{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{str(uuid.uuid4())[:8].upper()}"
        
        order = Order(
            order_number=order_number,
            user_id=current_user_id,
            recipient_name=data['recipient_name'],
            phone=data['phone'],
            province=data['province'],
            address_detail=data['address_detail'],
            subtotal=data.get('subtotal', 0),
            shipping_fee=data.get('shipping_fee', 0),
            total_amount=data['total_amount'],
            status='pending',
            memo=data.get('memo')
        )
        
        # Add items to order
        for item_data in data['items']:
            order_item = OrderItem(
                product_id=item_data.get('product_id'),
                product_name=item_data.get('product_name'),
                product_type=item_data.get('product_type'),
                quantity=item_data.get('quantity', 1),
                unit_price=item_data.get('unit_price', 0),
                total_price=item_data.get('total_price', 0),
                config=item_data.get('config')
            )
            order.items.append(order_item)
        
        db.session.add(order)
        db.session.commit()
        
        return jsonify({
            'message': 'Order created successfully',
            'order': order.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@order_bp.route('/<order_id>', methods=['PUT'])
@jwt_required()
def update_order(order_id):
    """Update order status (admin only)"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    
    data = request.get_json()
    
    try:
        if 'status' in data:
            order.status = data['status']
            
            # Update timestamps based on status
            if data['status'] == 'shipped':
                order.shipped_at = datetime.utcnow()
            elif data['status'] == 'delivered':
                order.delivered_at = datetime.utcnow()
            elif data['status'] == 'cancelled':
                order.cancelled_at = datetime.utcnow()
        
        if 'tracking_number' in data:
            order.tracking_number = data['tracking_number']
        
        if 'memo' in data:
            order.memo = data['memo']
        
        order.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Order updated successfully',
            'order': order.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@order_bp.route('/<order_id>', methods=['DELETE'])
@jwt_required()
def delete_order(order_id):
    """Delete order (admin only)"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    if order.user_id != current_user_id and not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    try:
        db.session.delete(order)
        db.session.commit()
        
        return jsonify({'message': 'Order deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@order_bp.route('/<order_id>/pdf', methods=['POST'])
@jwt_required()
def upload_order_pdf(order_id):
    """Upload order PDF (stores to instance/order_pdfs and associates with user profile)"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)

    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    if order.user_id != current_user_id and not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403

    data = request.get_json() or {}
    pdf_base64 = data.get('pdf_base64')
    pdf_filename = data.get('pdf_filename') or f"{order.order_number}.pdf"

    if not pdf_base64:
        return jsonify({'error': 'Missing pdf_base64'}), 400

    # Strip data URI prefix if present
    if isinstance(pdf_base64, str) and ',' in pdf_base64:
        pdf_base64 = pdf_base64.split(',', 1)[1]

    try:
        pdf_bytes = base64.b64decode(pdf_base64)
    except Exception:
        return jsonify({'error': 'Invalid PDF data'}), 400

    try:
        # Save to database first (critical for cloud environments)
        profile = Profile.query.filter_by(user_id=order.user_id).first()
        if not profile:
            profile = Profile(user_id=order.user_id)
            db.session.add(profile)

        profile.pdf_filename = pdf_filename
        profile.pdf_base64 = pdf_base64
        profile.updated_at = datetime.utcnow()

        # Try to save to file system (optional, may fail in cloud)
        pdf_path = None
        try:
            pdf_dir = os.path.join(current_app.instance_path, 'order_pdfs')
            os.makedirs(pdf_dir, exist_ok=True)
            pdf_path = os.path.join(pdf_dir, f"{order.id}.pdf")
            with open(pdf_path, 'wb') as f:
                f.write(pdf_bytes)
            profile.pdf_path = pdf_path
        except Exception as file_error:
            # File write failed (common in cloud), but continue with DB save
            current_app.logger.warning(f"Failed to save PDF to file system: {file_error}")
            profile.pdf_path = None

        db.session.commit()

        return jsonify({'message': 'PDF uploaded', 'pdf_filename': pdf_filename}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@order_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_order_stats():
    """Get order statistics (admin only)"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    total_orders = Order.query.count()
    pending_orders = Order.query.filter_by(status='pending').count()
    shipped_orders = Order.query.filter_by(status='shipped').count()
    delivered_orders = Order.query.filter_by(status='delivered').count()
    
    total_revenue = db.session.query(db.func.sum(Order.total_amount)).scalar() or 0
    
    return jsonify({
        'total_orders': total_orders,
        'pending': pending_orders,
        'shipped': shipped_orders,
        'delivered': delivered_orders,
        'total_revenue': float(total_revenue)
    }), 200


@order_bp.route('/shared-board/settings', methods=['GET'])
def get_shared_board_settings():
    product_type = request.args.get('product_type', 'PEGBOARD').upper()
    if product_type not in ['PEGBOARD', 'CABINET_DOOR']:
        return jsonify({'error': 'Invalid product_type'}), 400

    return jsonify(_get_shared_board_settings(product_type)), 200


@order_bp.route('/shared-board/reservations', methods=['GET'])
def get_shared_board_reservations():
    product_type = request.args.get('product_type', 'PEGBOARD').upper()
    if product_type not in ['PEGBOARD', 'CABINET_DOOR']:
        return jsonify({'error': 'Invalid product_type'}), 400

    order_items = (
        OrderItem.query
        .join(Order, Order.id == OrderItem.order_id)
        .filter(OrderItem.product_type == product_type)
        .filter(Order.status != 'cancelled')
        .all()
    )

    reservations = []
    for item in order_items:
        config = item.config or {}
        pieces = config.get('pieces', []) if isinstance(config, dict) else []
        for piece in pieces:
            if not isinstance(piece, dict):
                continue
            if all(k in piece for k in ['x', 'y', 'width', 'height']):
                reservations.append({
                    'order_item_id': item.id,
                    'x': piece['x'],
                    'y': piece['y'],
                    'width': piece['width'],
                    'height': piece['height'],
                })

    return jsonify({'reservations': reservations}), 200


@order_bp.route('/frame/options', methods=['GET'])
def get_frame_options():
    rows = FrameOption.query.filter_by(is_active=True).order_by(FrameOption.created_at.desc()).all()
    return jsonify({'options': [row.to_dict() for row in rows]}), 200
