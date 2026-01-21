from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from datetime import datetime
from app.models.user import db, User, Address
import uuid

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user"""
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
            membership_level='standard'
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Create access token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict(),
            'access_token': access_token
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login user"""
    data = request.get_json()
    
    if not data or not data.get('phone') or not data.get('password'):
        return jsonify({'error': 'Missing phone or password'}), 400
    
    user = User.query.filter_by(phone=data['phone']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'error': 'Invalid phone or password'}), 401
    
    if not user.is_active:
        return jsonify({'error': 'Account is inactive'}), 403
    
    try:
        # Update last login
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        # Create access token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'access_token': access_token
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user info"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'user': user.to_dict(),
        'addresses': [addr.to_dict() for addr in user.addresses]
    }), 200


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or not data.get('old_password') or not data.get('new_password'):
        return jsonify({'error': 'Missing old_password or new_password'}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if not user.check_password(data['old_password']):
        return jsonify({'error': 'Old password is incorrect'}), 401
    
    try:
        user.set_password(data['new_password'])
        db.session.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user (client-side token removal)"""
    return jsonify({'message': 'Logout successful'}), 200


@auth_bp.route('/create-test-accounts', methods=['POST'])
def create_test_accounts():
    """Create test accounts - DEVELOPMENT ONLY"""
    try:
        test_accounts = [
            {
                'username': 'testuser',
                'phone': '19821200413',
                'password': '123456',
                'full_name': 'Test User',
                'is_admin': False
            },
            {
                'username': 'admin',
                'phone': '13916813579',
                'password': 'admin',
                'full_name': 'Administrator',
                'is_admin': True
            }
        ]
        
        created_users = []
        
        for account in test_accounts:
            # Check if user already exists
            existing = User.query.filter_by(phone=account['phone']).first()
            if existing:
                created_users.append({
                    'phone': account['phone'],
                    'message': 'User already exists',
                    'id': existing.id
                })
                continue
            
            # Create new user
            user = User(
                username=account['username'],
                phone=account['phone'],
                email=f"{account['username']}@test.com",
                full_name=account['full_name'],
                membership_level='standard',
                is_admin=account['is_admin'],
                is_active=True
            )
            user.set_password(account['password'])
            
            db.session.add(user)
        
        db.session.commit()
        
        # Fetch all created/existing users
        for account in test_accounts:
            user = User.query.filter_by(phone=account['phone']).first()
            created_users.append({
                'phone': account['phone'],
                'username': account['username'],
                'id': user.id,
                'is_admin': user.is_admin
            })
        
        return jsonify({
            'message': 'Test accounts created/verified',
            'users': created_users
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
