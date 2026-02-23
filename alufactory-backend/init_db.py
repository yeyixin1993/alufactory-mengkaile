#!/usr/bin/env python
"""
Database initialization script
Run this to create tables and add initial data
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

from app import create_app
from app.models.user import db, User

def init_db():
    """Initialize database"""
    app = create_app()
    
    with app.app_context():
        # Create all tables
        db.create_all()
        print("✓ Database tables created")
        
        # Add initial admin user if not exists
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            admin = User(
                username='admin',
                phone='13916813579',
                email='admin@alufactory.com',
                full_name='Administrator',
                is_admin=True,
                is_active=True,
                membership_level='vip_plus'
            )
            admin.set_password('admin')
            db.session.add(admin)
            db.session.commit()
            print("✓ Initial admin user created (phone: 13916813579, password: admin)")
        
        # Add demo customer
        customer = User.query.filter_by(username='demo_customer').first()
        if not customer:
            customer = User(
                username='demo_customer',
                phone='18888888888',
                email='customer@demo.com',
                full_name='Demo Customer',
                is_active=True,
                membership_level='standard'
            )
            customer.set_password('demo123')
            db.session.add(customer)
            db.session.commit()
            print("✓ Demo customer user created (phone: 18888888888, password: demo123)")
        
        print("\n✓ Database initialization completed successfully!")
        print("\nYou can now start the Flask app with: python run.py")

if __name__ == '__main__':
    init_db()
