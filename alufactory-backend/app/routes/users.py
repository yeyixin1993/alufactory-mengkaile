from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models.user import db, User, Address
import uuid

user_bp = Blueprint('users', __name__, url_prefix='/api/users')

@user_bp.route('/<user_id>', methods=['GET'])
@jwt_required()
def get_user(user_id):
    """Get user details"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    # Check if user is admin or viewing their own profile
    if not current_user or (current_user_id != user_id and not current_user.is_admin):
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'user': user.to_dict(),
        'addresses': [addr.to_dict() for addr in user.addresses]
    }), 200


@user_bp.route('/<user_id>', methods=['PUT'])
@jwt_required()
def update_user(user_id):
    """Update user profile"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    # Check permissions
    if current_user_id != user_id and not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    try:
        if 'full_name' in data:
            user.full_name = data['full_name']
        if 'email' in data:
            user.email = data['email']
        
        # Only admin can update membership and status
        if current_user.is_admin:
            if 'membership_level' in data:
                user.membership_level = data['membership_level']
            if 'is_active' in data:
                user.is_active = data['is_active']
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/<user_id>/addresses', methods=['GET'])
@jwt_required()
def get_user_addresses(user_id):
    """Get user addresses"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if current_user_id != user_id and not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'addresses': [addr.to_dict() for addr in user.addresses]
    }), 200


@user_bp.route('/<user_id>/addresses', methods=['POST'])
@jwt_required()
def add_user_address(user_id):
    """Add address to user"""
    current_user_id = get_jwt_identity()
    
    if current_user_id != user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    if not data or not all(k in data for k in ['recipient_name', 'phone', 'province', 'detail']):
        return jsonify({'error': 'Missing required fields'}), 400
    
    try:
        address = Address(
            user_id=user_id,
            recipient_name=data['recipient_name'],
            phone=data['phone'],
            province=data['province'],
            detail=data['detail'],
            is_default=data.get('is_default', False)
        )
        
        # If this is the default, unset other defaults
        if address.is_default:
            Address.query.filter_by(user_id=user_id, is_default=True).update({'is_default': False})
        
        db.session.add(address)
        db.session.commit()
        
        return jsonify({
            'message': 'Address added successfully',
            'address': address.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/addresses/<address_id>', methods=['PUT'])
@jwt_required()
def update_address(address_id):
    """Update user address"""
    current_user_id = get_jwt_identity()
    
    address = Address.query.get(address_id)
    if not address:
        return jsonify({'error': 'Address not found'}), 404
    
    if address.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    try:
        if 'recipient_name' in data:
            address.recipient_name = data['recipient_name']
        if 'phone' in data:
            address.phone = data['phone']
        if 'province' in data:
            address.province = data['province']
        if 'detail' in data:
            address.detail = data['detail']
        if 'is_default' in data:
            address.is_default = data['is_default']
            if address.is_default:
                Address.query.filter_by(user_id=address.user_id, is_default=True).update({'is_default': False})
        
        address.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Address updated successfully',
            'address': address.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@user_bp.route('/addresses/<address_id>', methods=['DELETE'])
@jwt_required()
def delete_address(address_id):
    """Delete user address"""
    current_user_id = get_jwt_identity()
    
    address = Address.query.get(address_id)
    if not address:
        return jsonify({'error': 'Address not found'}), 404
    
    if address.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        db.session.delete(address)
        db.session.commit()
        
        return jsonify({'message': 'Address deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
