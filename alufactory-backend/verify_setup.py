#!/usr/bin/env python
"""
Quick verification that the system is set up correctly
"""
import os
import sys

print("\n" + "="*70)
print(" ALUFACTORY SYSTEM VERIFICATION")
print("="*70)

# Check Python
print(f"\n✓ Python version: {sys.version}")

# Check dependencies
print("\nChecking dependencies...")
deps = ['flask', 'flask_cors', 'flask_jwt_extended', 'flask_sqlalchemy', 'pymysql', 'python-dotenv']
missing = []
for dep in deps:
    try:
        __import__(dep)
        print(f"  ✓ {dep}")
    except ImportError:
        print(f"  ✗ {dep} - MISSING")
        missing.append(dep)

# Check files
print("\nChecking files...")
files = {
    'app/__init__.py': 'Flask app factory',
    'app/models/user.py': 'Database models',
    'app/routes/auth.py': 'Authentication endpoints',
    'app/routes/users.py': 'User endpoints',
    'app/routes/profiles.py': 'Profile endpoints',
    'app/routes/admin.py': 'Admin endpoints',
    'admin/index.html': 'Admin dashboard',
    'config.py': 'Configuration',
    '.env': 'Environment config',
    'alufactory.db': 'SQLite database'
}

for filepath, desc in files.items():
    if os.path.exists(filepath):
        print(f"  ✓ {filepath:<35} ({desc})")
    else:
        print(f"  ? {filepath:<35} ({desc}) - Will be created on first run")

# Check database
print("\nDatabase Status...")
if os.path.exists('alufactory.db'):
    size = os.path.getsize('alufactory.db')
    print(f"  ✓ SQLite database exists ({size} bytes)")
    
    # Try to read users
    try:
        import sqlite3
        conn = sqlite3.connect('alufactory.db')
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        print(f"  ✓ Database accessible ({count} users in database)")
        
        cursor.execute("SELECT COUNT(*) FROM profiles")
        prof_count = cursor.fetchone()[0]
        print(f"  ✓ Profiles table exists ({prof_count} profiles)")
        
        cursor.execute("SELECT username, phone FROM users LIMIT 5")
        users = cursor.fetchall()
        print(f"\n  Users in system:")
        for username, phone in users:
            print(f"    - {username} ({phone})")
        
        conn.close()
    except Exception as e:
        print(f"  ✗ Database error: {e}")
else:
    print("  ? Database not yet created (will be created on first run)")

# Check environment
print("\nEnvironment Configuration...")
try:
    from dotenv import load_dotenv
    load_dotenv()
    
    db_url = os.getenv('DATABASE_URL')
    flask_env = os.getenv('FLASK_ENV')
    print(f"  ✓ FLASK_ENV: {flask_env}")
    print(f"  ✓ DATABASE_URL: {db_url[:50]}..." if len(str(db_url)) > 50 else f"  ✓ DATABASE_URL: {db_url}")
except Exception as e:
    print(f"  ✗ Environment error: {e}")

# Summary
print("\n" + "="*70)
if missing:
    print(f"⚠  {len(missing)} dependencies missing. Run: pip install -r requirements.txt")
else:
    print("✓ All dependencies installed!")

print("\nNEXT STEPS:")
print("  1. Start backend:  python run_prod.py")
print("  2. Admin dashboard: http://localhost:5000/admin/index.html")
print("  3. Test account: phone=19821200413, password=123456")
print("  4. Admin account: phone=13916813579, password=admin")
print("\n" + "="*70 + "\n")
