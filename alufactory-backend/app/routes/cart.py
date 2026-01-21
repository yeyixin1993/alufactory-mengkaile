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
