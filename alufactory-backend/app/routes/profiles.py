from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from app.models.user import db, User, Profile
import uuid
import base64

profile_bp = Blueprint('profiles', __name__, url_prefix='/api/profiles')


@profile_bp.route('', methods=['GET'])
@jwt_required()
def get_user_profiles():
    """Get all profiles for current user"""
    current_user_id = get_jwt_identity()
    
    profiles = Profile.query.filter_by(user_id=current_user_id).all()
    
    return jsonify({
        'profiles': [profile.to_dict() for profile in profiles]
    }), 200


@profile_bp.route('/<profile_id>', methods=['GET'])
@jwt_required()
def get_profile(profile_id):
    """Get profile details"""
    current_user_id = get_jwt_identity()
    current_user = User.query.get(current_user_id)
    
    profile = Profile.query.get(profile_id)
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404
    
    # Check permissions - user owns it or is admin
    if profile.user_id != current_user_id and not current_user.is_admin:
        return jsonify({'error': 'Unauthorized'}), 403
    
    return jsonify({
        'profile': profile.to_dict(include_pdf_data=True)
    }), 200


@profile_bp.route('', methods=['POST'])
@jwt_required()
def create_profile():
    """Create a new profile with address and PDF"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    if not data or not data.get('profile_name'):
        return jsonify({'error': 'Missing profile_name'}), 400
    
    try:
        # Create new profile
        profile = Profile(
            user_id=current_user_id,
            profile_name=data.get('profile_name'),
            profile_data=data.get('profile_data', {}),
            address_recipient_name=data.get('address', {}).get('recipient_name'),
            address_phone=data.get('address', {}).get('phone'),
            address_province=data.get('address', {}).get('province'),
            address_detail=data.get('address', {}).get('detail'),
        )
        
        # Handle PDF if provided (base64 encoded)
        if 'pdf_base64' in data:
            profile.pdf_base64 = data['pdf_base64']
            profile.pdf_filename = data.get('pdf_filename', f"profile_{profile.id}.pdf")
        
        db.session.add(profile)
        db.session.commit()
        
        return jsonify({
            'message': 'Profile created successfully',
            'profile': profile.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@profile_bp.route('/<profile_id>', methods=['PUT'])
@jwt_required()
def update_profile(profile_id):
    """Update profile with address and PDF"""
    current_user_id = get_jwt_identity()
    
    profile = Profile.query.get(profile_id)
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404
    
    if profile.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.get_json()
    
    try:
        if 'profile_name' in data:
            profile.profile_name = data['profile_name']
        
        if 'profile_data' in data:
            profile.profile_data = data['profile_data']
        
        # Update address
        if 'address' in data:
            addr = data['address']
            profile.address_recipient_name = addr.get('recipient_name', profile.address_recipient_name)
            profile.address_phone = addr.get('phone', profile.address_phone)
            profile.address_province = addr.get('province', profile.address_province)
            profile.address_detail = addr.get('detail', profile.address_detail)
        
        # Update PDF if provided
        if 'pdf_base64' in data:
            profile.pdf_base64 = data['pdf_base64']
            profile.pdf_filename = data.get('pdf_filename', f"profile_{profile.id}.pdf")
        
        profile.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'profile': profile.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@profile_bp.route('/<profile_id>', methods=['DELETE'])
@jwt_required()
def delete_profile(profile_id):
    """Delete profile"""
    current_user_id = get_jwt_identity()
    
    profile = Profile.query.get(profile_id)
    if not profile:
        return jsonify({'error': 'Profile not found'}), 404
    
    if profile.user_id != current_user_id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        db.session.delete(profile)
        db.session.commit()
        
        return jsonify({'message': 'Profile deleted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
