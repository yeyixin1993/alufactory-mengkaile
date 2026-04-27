from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import config
from app.models.user import db
from app.routes.auth import auth_bp
from app.routes.users import user_bp
from app.routes.cart import cart_bp
from app.routes.orders import order_bp
from app.routes.admin import admin_bp
from app.routes.profiles import profile_bp
from app.routes.payments import payment_bp
from app.security import init_payload_encryption
import os

def create_app(config_name='development'):
    """Application factory"""
    # Get the base directory of the app
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    admin_dir = os.path.join(base_dir, 'admin')
    
    app = Flask(__name__, static_folder=admin_dir, static_url_path='/admin')
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    init_payload_encryption(app)
    
    # CORS configuration with explicit settings
    CORS(app, 
         resources={r"/*": {
             "origins": "*",
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
             "allow_headers": ["Content-Type", "Authorization"],
             "expose_headers": ["Content-Type", "Authorization"],
             "supports_credentials": False,
             "max_age": 3600
         }})
    
    JWTManager(app)
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(order_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(payment_bp)
    
    # Create database tables and run auto-migrations
    with app.app_context():
        db.create_all()
        
        # Auto-migrate: ensure all expected columns exist in orders table
        try:
            from sqlalchemy import text, inspect as sa_inspect
            inspector = sa_inspect(db.engine)
            if 'orders' in inspector.get_table_names():
                existing_cols = [col['name'] for col in inspector.get_columns('orders')]
                migrations = [
                    ('shipping_method', 'VARCHAR(50)'),
                    ('overlength_fee', 'FLOAT DEFAULT 0'),
                    ('address_id', 'VARCHAR(36)'),
                    ('admin_memo', 'TEXT'),
                    ('memo', 'TEXT'),
                    ('tracking_number', 'VARCHAR(100)'),
                    ('payment_method', 'VARCHAR(50)'),
                    ('payment_transaction_no', 'VARCHAR(120)'),
                    ('paid_at', 'DATETIME'),
                    ('shipped_at', 'DATETIME'),
                    ('delivered_at', 'DATETIME'),
                    ('cancelled_at', 'DATETIME'),
                ]
                with db.engine.connect() as conn:
                    for col_name, col_type in migrations:
                        if col_name not in existing_cols:
                            try:
                                conn.execute(text(f'ALTER TABLE orders ADD COLUMN {col_name} {col_type}'))
                                conn.commit()
                                print(f'  ✅ Auto-migrated: added {col_name} to orders')
                            except Exception:
                                pass  # Column might already exist or DB doesn't support ALTER
        except Exception as e:
            print(f'  ⚠️ Auto-migration check skipped: {e}')
    
    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health():
        return {'status': 'ok', 'message': 'Alufactory Backend is running'}, 200
    
    # Serve admin index.html
    @app.route('/admin/', methods=['GET'])
    def admin_index():
        return send_from_directory(admin_dir, 'index.html')
    
    @app.route('/admin/index.html', methods=['GET'])
    def admin_index_direct():
        return send_from_directory(admin_dir, 'index.html')
    
    # Serve admin login.html
    @app.route('/admin/login.html', methods=['GET'])
    def admin_login():
        return send_from_directory(admin_dir, 'login.html')
    
    # Serve static files from admin directory
    @app.route('/admin/<path:filename>', methods=['GET'])
    def admin_files(filename):
        return send_from_directory(admin_dir, filename)
    
    # Serve root as health check
    @app.route('/', methods=['GET'])
    def root():
        return {'status': 'ok', 'message': 'Alufactory Backend API'}, 200
    
    return app

if __name__ == '__main__':
    app = create_app(os.getenv('FLASK_ENV', 'development'))
    app.run(debug=True, host='0.0.0.0', port=5000)
