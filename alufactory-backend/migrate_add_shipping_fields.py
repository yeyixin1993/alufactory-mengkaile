"""
Migration script to add shipping_method and overlength_fee columns to orders table.
Run once: python migrate_add_shipping_fields.py
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.models.user import db

app = create_app()

with app.app_context():
    from sqlalchemy import text, inspect
    inspector = inspect(db.engine)
    existing = [col['name'] for col in inspector.get_columns('orders')]

    with db.engine.connect() as conn:
        if 'shipping_method' not in existing:
            conn.execute(text("ALTER TABLE orders ADD COLUMN shipping_method VARCHAR(50)"))
            print("✅ Added shipping_method column")
        else:
            print("⚠️  shipping_method column already exists")

        if 'overlength_fee' not in existing:
            conn.execute(text("ALTER TABLE orders ADD COLUMN overlength_fee FLOAT DEFAULT 0"))
            print("✅ Added overlength_fee column")
        else:
            print("⚠️  overlength_fee column already exists")

        conn.commit()
    print("✅ Migration complete!")
