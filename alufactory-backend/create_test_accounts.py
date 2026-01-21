#!/usr/bin/env python
"""Script to create test accounts"""
import sys
import os

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(__file__))

# Load env first
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.models.user import db, User

def create_test_accounts():
    """Create test accounts"""
    app = create_app()  # Will use FLASK_ENV from .env
    
    with app.app_context():
        # Test accounts
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
        
        print("Creating/updating test accounts...")
        
        # First pass: delete conflicting usernames
        for account in test_accounts:
            existing_user = User.query.filter_by(username=account['username']).first()
            if existing_user and existing_user.phone != account['phone']:
                print(f"  Removing old {account['username']} ({existing_user.phone})")
                db.session.delete(existing_user)
        
        db.session.commit()
        
        # Second pass: create/update users
        for account in test_accounts:
            # Check if user already exists by phone
            existing = User.query.filter_by(phone=account['phone']).first()
            if existing:
                print(f"✓ User {account['phone']} already exists - {existing.username}")
                # Update to admin if needed
                if account['is_admin'] and not existing.is_admin:
                    existing.is_admin = True
                    db.session.commit()
                    print(f"  → Promoted to admin")
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
            print(f"✓ Created user {account['phone']} ({account['username']})")
        
        db.session.commit()
        print("\n✓ Test accounts created/verified successfully!")
        
        # List all users
        users = User.query.all()
        print(f"\nTotal users: {len(users)}")
        for user in users:
            print(f"  - {user.username} ({user.phone}) [Admin: {user.is_admin}]")

if __name__ == '__main__':
    create_test_accounts()
