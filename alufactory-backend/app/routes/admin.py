from flask import Blueprint, request, jsonify, Response, current_app, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models.user import db, User, Order, Profile
import uuid
import base64
import os

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

def admin_required(f):
    """Decorator to check if user is admin"""
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)
        
        if not current_user or not current_user.is_admin:
            return jsonify({'error': 'Admin access required'}), 403
        
        return f(*args, **kwargs)
    
    decorated_function.__name__ = f.__name__
    return decorated_function


@admin_bp.route('/users', methods=['GET'])
@admin_required
def get_all_users():
    """Get all users (admin only)"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    
    users_paginated = User.query.paginate(page=page, per_page=per_page)
    
    return jsonify({
        'users': [user.to_dict() for user in users_paginated.items],
        'total': users_paginated.total,
        'pages': users_paginated.pages,
        'current_page': page
    }), 200


@admin_bp.route('/users/<user_id>/activate', methods=['POST'])
@admin_required
def activate_user(user_id):
    """Activate user account"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    try:
        user.is_active = True
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'User activated',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<user_id>/deactivate', methods=['POST'])
@admin_required
def deactivate_user(user_id):
    """Deactivate user account"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    try:
        user.is_active = False
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'User deactivated',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<user_id>/promote', methods=['POST'])
@admin_required
def promote_user(user_id):
    """Promote user to admin"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    try:
        user.is_admin = True
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'User promoted to admin',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<user_id>/membership', methods=['PUT'])
@admin_required
def update_membership(user_id):
    """Update user membership level"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    membership_level = data.get('membership_level')
    
    if membership_level not in ['standard', 'vip', 'vip_plus']:
        return jsonify({'error': 'Invalid membership level'}), 400
    
    try:
        user.membership_level = membership_level
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Membership updated',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<user_id>/reset-password', methods=['POST'])
@admin_required
def reset_user_password(user_id):
    """Reset user password"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    new_password = data.get('new_password', '123456')
    
    try:
        user.set_password(new_password)
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Password reset successfully',
            'user': user.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/create', methods=['POST'])
@admin_required
def create_user():
    """Create a new user manually"""
    data = request.get_json()
    
    # Validation
    if not data or not data.get('username') or not data.get('phone') or not data.get('password'):
        return jsonify({'error': 'Missing required fields: username, phone, password'}), 400
    
    # Check if user already exists
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already exists'}), 409
    
    if User.query.filter_by(phone=data['phone']).first():
        return jsonify({'error': 'Phone number already registered'}), 409
    
    try:
        # Create new user
        user = User(
            username=data['username'],
            phone=data['phone'],
            email=data.get('email'),
            full_name=data.get('full_name', ''),
            membership_level='standard',
            is_active=True
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User created successfully',
            'user': user.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/users/<user_id>/delete', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete user with admin password confirmation"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    if not current_user:
        return jsonify({'error': 'Admin user not found'}), 404
    
    # Get target user
    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Prevent admin from deleting themselves
    if current_user_id == user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400
    
    # Verify admin password
    data = request.get_json()
    admin_password = data.get('admin_password')
    
    if not admin_password:
        return jsonify({'error': 'Admin password is required'}), 400
    
    if not current_user.check_password(admin_password):
        return jsonify({'error': 'Invalid admin password'}), 401
    
    try:
        # Delete the user (cascade will handle related records)
        db.session.delete(target_user)
        db.session.commit()
        
        return jsonify({
            'message': 'User deleted successfully',
            'deleted_user_id': user_id
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/orders', methods=['GET'])
@admin_required
def get_all_orders():
    """Get all orders (admin only)"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    status = request.args.get('status')
    
    query = Order.query
    if status:
        query = query.filter_by(status=status)
    
    orders_paginated = query.order_by(Order.created_at.desc()).paginate(page=page, per_page=per_page)
    
    orders_data = []
    for order in orders_paginated.items:
        order_dict = order.to_dict()
        user = User.query.get(order.user_id)
        profile = Profile.query.filter_by(user_id=order.user_id).first()

        pdf_dir = os.path.join(current_app.instance_path, 'order_pdfs')
        pdf_path = os.path.join(pdf_dir, f"{order.id}.pdf")
        pdf_available = os.path.exists(pdf_path) or bool(profile and profile.pdf_base64)

        order_dict['user'] = {
            'id': user.id if user else None,
            'username': user.username if user else None,
            'phone': user.phone if user else None,
            'full_name': user.full_name if user else None,
        }
        order_dict['customer_phone'] = order.phone
        order_dict['pdf'] = {
            'filename': profile.pdf_filename if profile and profile.pdf_filename else f"{order.order_number}.pdf",
            'available': pdf_available,
            'url': f"/api/admin/orders/{order.id}/pdf" if pdf_available else None
        }

        orders_data.append(order_dict)

    return jsonify({
        'orders': orders_data,
        'total': orders_paginated.total,
        'pages': orders_paginated.pages,
        'current_page': page
    }), 200


@admin_bp.route('/orders/<order_id>/pdf', methods=['GET'])
@admin_required
def get_order_pdf(order_id):
    """Get profile PDF associated with an order's user"""
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404

    pdf_dir = os.path.join(current_app.instance_path, 'order_pdfs')
    pdf_path = os.path.join(pdf_dir, f"{order.id}.pdf")
    if os.path.exists(pdf_path):
        filename = f"{order.order_number}.pdf"
        return send_file(pdf_path, mimetype='application/pdf', as_attachment=False, download_name=filename)

    profile = Profile.query.filter_by(user_id=order.user_id).first()
    if not profile or not profile.pdf_base64:
        return jsonify({'error': 'PDF not found'}), 404

    try:
        pdf_bytes = base64.b64decode(profile.pdf_base64)
    except Exception:
        return jsonify({'error': 'Invalid PDF data'}), 500

    filename = profile.pdf_filename or f"{order.order_number}.pdf"
    return Response(
        pdf_bytes,
        mimetype='application/pdf',
        headers={
            'Content-Disposition': f'inline; filename="{filename}"'
        }
    )


@admin_bp.route('/orders/<order_id>/status', methods=['PUT'])
@admin_required
def update_order_status(order_id):
    """Update order status"""
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    
    data = request.get_json()
    status = data.get('status')
    
    if status not in ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']:
        return jsonify({'error': 'Invalid status'}), 400
    
    try:
        order.status = status
        
        if status == 'shipped':
            order.shipped_at = datetime.utcnow()
        elif status == 'delivered':
            order.delivered_at = datetime.utcnow()
        elif status == 'cancelled':
            order.cancelled_at = datetime.utcnow()
        
        if 'tracking_number' in data:
            order.tracking_number = data['tracking_number']
        
        if 'memo' in data:
            order.memo = data['memo']
        
        order.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Order status updated',
            'order': order.to_dict()
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/statistics', methods=['GET'])
@admin_required
def get_statistics():
    """Get admin dashboard statistics"""
    total_users = User.query.count()
    active_users = User.query.filter_by(is_active=True).count()
    total_orders = Order.query.count()
    pending_orders = Order.query.filter_by(status='pending').count()
    shipped_orders = Order.query.filter_by(status='shipped').count()
    delivered_orders = Order.query.filter_by(status='delivered').count()
    
    total_revenue = db.session.query(db.func.sum(Order.total_amount)).filter(
        Order.status.in_(['confirmed', 'shipped', 'delivered'])
    ).scalar() or 0
    
    return jsonify({
        'total_users': total_users,
        'active_users': active_users,
        'total_orders': total_orders,
        'pending_orders': pending_orders,
        'shipped_orders': shipped_orders,
        'delivered_orders': delivered_orders,
        'total_revenue': float(total_revenue)
    }), 200


@admin_bp.route('/profiles', methods=['GET'])
@admin_required
def get_all_profiles():
    """Get all user profiles (admin only)"""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    user_id = request.args.get('user_id')  # Optional filter by user
    
    query = Profile.query
    if user_id:
        query = query.filter_by(user_id=user_id)
    
    profiles_paginated = query.order_by(Profile.created_at.desc()).paginate(page=page, per_page=per_page)
    
    profiles_data = []
    for profile in profiles_paginated.items:
        user = User.query.get(profile.user_id)
        profile_dict = profile.to_dict()
        profile_dict['user'] = {
            'id': user.id,
            'username': user.username,
            'phone': user.phone,
            'full_name': user.full_name,
        }
        profiles_data.append(profile_dict)
    
    return jsonify({
        'profiles': profiles_data,
        'total': profiles_paginated.total,
        'pages': profiles_paginated.pages,
        'current_page': page
    }), 200


@admin_bp.route('/profiles/<profile_id>', methods=['GET'])
@admin_required
def get_profile_details(profile_id):
    """Get profile details with full data"""
    profile = Profile.query.get(profile_id)
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404
    
    user = User.query.get(profile.user_id)
    profile_dict = profile.to_dict(include_pdf_data=True)
    profile_dict['user'] = {
        'id': user.id,
        'username': user.username,
        'phone': user.phone,
        'full_name': user.full_name,
        'email': user.email,
    }
    
    return jsonify({
        'profile': profile_dict
    }), 200
