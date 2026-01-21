from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import config
from app.models.user import db
from app.routes.auth import auth_bp
from app.routes.users import user_bp
from app.routes.cart import cart_bp
from app.routes.orders import order_bp
from app.routes.admin import admin_bp
import os

def create_app(config_name='development'):
    """Application factory"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    CORS(app, origins=['http://localhost:3000', 'http://localhost:5173', '*'])
    JWTManager(app)
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(cart_bp)
    app.register_blueprint(order_bp)
    app.register_blueprint(admin_bp)
    
    # Create database tables
    with app.app_context():
        db.create_all()
    
    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health():
        return {'status': 'ok', 'message': 'Alufactory Backend is running'}, 200
    
    return app

if __name__ == '__main__':
    app = create_app(os.getenv('FLASK_ENV', 'development'))
    app.run(debug=True, host='0.0.0.0', port=5000)
