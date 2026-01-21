from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models.user import db, User, Cart, CartItem, Order, OrderItem
import uuid

order_bp = Blueprint('orders', __name__, url_prefix='/api/orders')

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
    
    if not current_user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403
    
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    
    try:
        db.session.delete(order)
        db.session.commit()
        
        return jsonify({'message': 'Order deleted successfully'}), 200
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
