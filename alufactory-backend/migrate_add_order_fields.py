#!/usr/bin/env python
"""
Migration script to add address_id and admin_memo columns to orders table.
Run this once after deploying the new code.

Usage:
  python migrate_add_order_fields.py
"""

import os
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.models.user import db

def migrate():
    app = create_app()
    with app.app_context():
        from sqlalchemy import text, inspect
        
        inspector = inspect(db.engine)
        columns = [col['name'] for col in inspector.get_columns('orders')]
        
        if 'address_id' not in columns:
            db.session.execute(text('ALTER TABLE orders ADD COLUMN address_id VARCHAR(36) NULL'))
            print("✓ Added 'address_id' column to orders table")
        else:
            print("• 'address_id' column already exists")
        
        if 'admin_memo' not in columns:
            db.session.execute(text('ALTER TABLE orders ADD COLUMN admin_memo TEXT NULL'))
            print("✓ Added 'admin_memo' column to orders table")
        else:
            print("• 'admin_memo' column already exists")
        
        db.session.commit()
        print("\n✓ Migration complete!")

if __name__ == '__main__':
    migrate()
