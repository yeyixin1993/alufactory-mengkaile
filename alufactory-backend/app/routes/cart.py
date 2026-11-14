from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models.user import db, User, Cart, CartItem
import uuid

cart_bp = Blueprint('cart', __name__, url_prefix='/api/cart')

@cart_bp.route('', methods=['GET'])
@jwt_required()
def get_cart():
    """Get user cart"""
    current_user_id = get_jwt_identity()
    
    cart = Cart.query.filter_by(user_id=current_user_id).first()
    if not cart:
        # Create new cart if doesn't exist
        cart = Cart(user_id=current_user_id)
        db.session.add(cart)
        db.session.commit()
    
    return jsonify(cart.to_dict()), 200


@cart_bp.route('/items', methods=['POST'])
@jwt_required()
def add_to_cart():
    """Add item to cart"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not all(k in data for k in ['product_id', 'product_name', 'product_type', 'quantity', 'unit_price']):
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        cart = Cart.query.filter_by(user_id=current_user_id).first()
        if not cart:
            cart = Cart(user_id=current_user_id)
            db.session.add(cart)
            db.session.flush()
        
        # Check if item already exists
        existing_item = CartItem.query.filter_by(
            cart_id=cart.id,
            product_id=data['product_id']
        ).first()
        
        if existing_item:
            # Update quantity if item exists
            existing_item.quantity += data.get('quantity', 1)
            existing_item.total_price = existing_item.unit_price * existing_item.quantity
        else:
            # Create new cart item
            cart_item = CartItem(
                cart_id=cart.id,
                product_id=data['product_id'],
                product_name=data['product_name'],
                product_type=data['product_type'],
                quantity=data.get('quantity', 1),
                unit_price=data['unit_price'],
                total_price=data['unit_price'] * data.get('quantity', 1),
                config=data.get('config')
            )
            cart.items.append(cart_item)
        
        cart.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Item added to cart',
            'cart': cart.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@cart_bp.route('/items/<item_id>', methods=['PUT'])
@jwt_required()
def update_cart_item(item_id):
    """Update cart item"""
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    cart_item = CartItem.query.get(item_id)
    if not cart_item:
        return jsonify({'error': 'Cart item not found'}), 404
    
    # Verify ownership
    cart = Cart.query.get(cart_item.cart_id)
    if cart.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        if 'quantity' in data:
            cart_item.quantity = max(1, data['quantity'])
            cart_item.total_price = cart_item.unit_price * cart_item.quantity
        
        if 'config' in data:
            cart_item.config = data['config']
        
        cart_item.updated_at = datetime.utcnow()
        cart.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Cart item updated',
            'item': cart_item.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@cart_bp.route('/items/<item_id>', methods=['DELETE'])
@jwt_required()
def remove_from_cart(item_id):
    """Remove item from cart"""
    current_user_id = get_jwt_identity()
    
    cart_item = CartItem.query.get(item_id)
    if not cart_item:
        return jsonify({'error': 'Cart item not found'}), 404
    
    # Verify ownership
    cart = Cart.query.get(cart_item.cart_id)
    if cart.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        db.session.delete(cart_item)
        cart.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Item removed from cart',
            'cart': cart.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@cart_bp.route('/clear', methods=['POST'])
@jwt_required()
def clear_cart():
    """Clear entire cart"""
    current_user_id = get_jwt_identity()
    
    try:
        cart = Cart.query.filter_by(user_id=current_user_id).first()
        if cart:
            CartItem.query.filter_by(cart_id=cart.id).delete()
            cart.updated_at = datetime.utcnow()
            db.session.commit()
        
        return jsonify({
            'message': 'Cart cleared',
            'cart': cart.to_dict() if cart else {'items': [], 'total_price': 0}
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@cart_bp.route('/sync', methods=['PUT'])
@jwt_required()
def sync_cart():
    """Atomically replace a user's cart, never add another copy of a snapshot."""
    current_user_id = get_jwt_identity()
    data = request.get_json() or {}
    if not isinstance(data, dict):
        return jsonify({'error': 'Request must be an object'}), 400
    items = data.get('items', [])

    if not isinstance(items, list):
        return jsonify({'error': 'items must be an array'}), 400

    # Validate and normalize the complete snapshot before any delete/insert.
    # An invalid later line must not leave a partially replaced transaction.
    normalized_items = []
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            return jsonify({'error': f'Invalid item at index {idx}'}), 400

        product_id = str(item.get('product_id') or '').strip()
        product_name = str(item.get('product_name') or product_id).strip()
        product_type = str(item.get('product_type') or 'PROFILE').strip()
        if not product_id:
            return jsonify({'error': f'Missing product_id at index {idx}'}), 400
        try:
            quantity = max(1, int(item.get('quantity', 1) or 1))
        except (TypeError, ValueError, OverflowError):
            return jsonify({'error': f'Invalid quantity at index {idx}'}), 400

        try:
            unit_price = float(item.get('unit_price', 0))
        except (TypeError, ValueError):
            unit_price = 0.0
        config = item.get('config')
        if unit_price <= 0 and isinstance(config, dict):
            try:
                unit_price = float(config.get('unitPrice', 0))
            except (TypeError, ValueError):
                unit_price = 0.0
        if unit_price < 0:
            unit_price = 0.0
        normalized_items.append({
            'product_id': product_id,
            'product_name': product_name,
            'product_type': product_type,
            'quantity': quantity,
            'unit_price': unit_price,
            'total_price': round(unit_price * quantity, 4),
            'config': config,
        })

    try:
        # MySQL/PostgreSQL serialize concurrent syncs for the same account.
        # Lock the parent first so the first cart creation is protected too.
        # SQLite ignores FOR UPDATE and already serializes database writers.
        owner = db.session.query(User.id).filter_by(id=current_user_id).with_for_update().first()
        if owner is None:
            return jsonify({'error': 'User not found'}), 404
        cart = Cart.query.filter_by(user_id=current_user_id).with_for_update().first()
        if not cart:
            cart = Cart(user_id=current_user_id)
            db.session.add(cart)
            db.session.flush()

        CartItem.query.filter_by(cart_id=cart.id).delete(synchronize_session=False)
        for item in normalized_items:
            db.session.add(CartItem(cart_id=cart.id, **item))

        cart.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({
            'message': 'Cart synced',
            'cart': cart.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
