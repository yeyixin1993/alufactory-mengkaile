#!/usr/bin/env python3
"""
Quick setup guide for MySQL connection
"""

print("""
╔════════════════════════════════════════════════════════╗
║     MySQL Connection Setup Guide                       ║
╚════════════════════════════════════════════════════════╝

❌ ERROR: Cannot connect to MySQL database
    Access denied for user 'root'@'localhost'

This means one of these is wrong:
1. MySQL is not running
2. Username is wrong (should be 'root')
3. Password is wrong
4. Database doesn't exist

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 SOLUTION: Follow these steps:

1. VERIFY MYSQL IS RUNNING
   - Open "Services" on Windows (Win+R → services.msc)
   - Look for "MySQL80" or similar
   - Status should be "Started"
   - If stopped, right-click → Start

2. FIND YOUR MYSQL CREDENTIALS
   When you installed MySQL, you chose:
   - Username (usually: root)
   - Password (you set this)
   
   Default is often:
   - Username: root
   - Password: root

3. CREATE THE DATABASE
   Open Command Prompt and run:
   
   mysql -u root -p
   (enter your password when prompted)
   
   Then run in MySQL:
   CREATE DATABASE alufactory_db CHARACTER SET utf8mb4;
   EXIT;

4. UPDATE .env FILE
   Edit: alufactory-backend/.env
   
   Line with DATABASE_URL:
   DATABASE_URL=mysql+pymysql://root:YOUR_PASSWORD@localhost:3306/alufactory_db
   
   Replace YOUR_PASSWORD with your actual MySQL password

5. TRY AGAIN
   python init_db.py

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 HOW TO FIND YOUR MYSQL PASSWORD:

If you forgot:
1. Open: C:\\Program Files\\MySQL\\MySQL Server 8.0\\
2. Look at installation notes
3. Or reinstall MySQL (uninstall → reinstall → remember password!)

Common defaults to try:
- root (no password) → DATABASE_URL=mysql+pymysql://root:@localhost:3306/alufactory_db
- root/root → DATABASE_URL=mysql+pymysql://root:root@localhost:3306/alufactory_db
- root/password → DATABASE_URL=mysql+pymysql://root:password@localhost:3306/alufactory_db

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ ONCE YOU'VE DONE ABOVE:

1. Open .env file and update DATABASE_URL
2. Run: python init_db.py
3. Run: python run.py
4. Frontend: npm run dev

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")

# Try to provide more helpful info
try:
    import pymysql
    print("✅ PyMySQL installed")
    
    # Try without password
    try:
        conn = pymysql.connect(host='localhost', user='root', password='')
        print("✅ Can connect as root with NO password")
        print("   → Use: DATABASE_URL=mysql+pymysql://root:@localhost:3306/alufactory_db")
        conn.close()
    except:
        pass
    
    # Try with password 'root'
    try:
        conn = pymysql.connect(host='localhost', user='root', password='root')
        print("✅ Can connect as root with password 'root'")
        print("   → Use: DATABASE_URL=mysql+pymysql://root:root@localhost:3306/alufactory_db")
        
        # Try to create database
        cursor = conn.cursor()
        cursor.execute("CREATE DATABASE IF NOT EXISTS alufactory_db CHARACTER SET utf8mb4")
        print("✅ Database 'alufactory_db' created!")
        conn.close()
    except Exception as e:
        print(f"⚠️ Cannot connect with password 'root': {e}")
    
except Exception as e:
    print(f"Error: {e}")
