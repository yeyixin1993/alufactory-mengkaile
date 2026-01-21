from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import uuid

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    
    # Profile info
    full_name = db.Column(db.String(120), nullable=True)
    membership_level = db.Column(db.String(50), default='standard')  # standard, vip, vip_plus
    membership_points = db.Column(db.Integer, default=0)
    
    # Account status
    is_active = db.Column(db.Boolean, default=True)
    is_admin = db.Column(db.Boolean, default=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    addresses = db.relationship('Address', backref='user', lazy=True, cascade='all, delete-orphan')
    orders = db.relationship('Order', backref='user', lazy=True, cascade='all, delete-orphan')
    cart = db.relationship('Cart', backref='user', uselist=False, cascade='all, delete-orphan')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self, include_password=False):
        data = {
            'id': self.id,
            'username': self.username,
            'phone': self.phone,
            'email': self.email,
            'full_name': self.full_name,
            'membership_level': self.membership_level,
            'membership_points': self.membership_points,
            'is_active': self.is_active,
            'is_admin': self.is_admin,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }
        return data


class Address(db.Model):
    __tablename__ = 'addresses'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    
    recipient_name = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    province = db.Column(db.String(50), nullable=False)
    detail = db.Column(db.Text, nullable=False)
    
    is_default = db.Column(db.Boolean, default=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'recipient_name': self.recipient_name,
            'phone': self.phone,
            'province': self.province,
            'detail': self.detail,
            'is_default': self.is_default,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }


class Cart(db.Model):
    __tablename__ = 'carts'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, unique=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    items = db.relationship('CartItem', backref='cart', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'items': [item.to_dict() for item in self.items],
            'total_price': sum(item.total_price for item in self.items),
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }


class CartItem(db.Model):
    __tablename__ = 'cart_items'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    cart_id = db.Column(db.String(36), db.ForeignKey('carts.id'), nullable=False)
    
    product_id = db.Column(db.String(50), nullable=False)
    product_name = db.Column(db.String(255), nullable=False)
    product_type = db.Column(db.String(50), nullable=False)
    
    quantity = db.Column(db.Integer, default=1, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    
    # Config stored as JSON for complex product configurations
    config = db.Column(db.JSON, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'product_type': self.product_type,
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'total_price': self.total_price,
            'config': self.config,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }


class Order(db.Model):
    __tablename__ = 'orders'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number = db.Column(db.String(50), unique=True, nullable=False)  # User-friendly order number
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    
    # Shipping address at order time
    recipient_name = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    province = db.Column(db.String(50), nullable=False)
    address_detail = db.Column(db.Text, nullable=False)
    
    # Order totals
    subtotal = db.Column(db.Float, default=0)
    shipping_fee = db.Column(db.Float, default=0)
    total_amount = db.Column(db.Float, nullable=False)
    
    # Status: pending, confirmed, shipped, delivered, cancelled
    status = db.Column(db.String(50), default='pending', nullable=False)
    
    # Tracking info
    tracking_number = db.Column(db.String(100), nullable=True)
    
    # Order memo
    memo = db.Column(db.Text, nullable=True)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    shipped_at = db.Column(db.DateTime, nullable=True)
    delivered_at = db.Column(db.DateTime, nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)
    
    # Relationships
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'order_number': self.order_number,
            'user_id': self.user_id,
            'recipient_name': self.recipient_name,
            'phone': self.phone,
            'province': self.province,
            'address_detail': self.address_detail,
            'subtotal': self.subtotal,
            'shipping_fee': self.shipping_fee,
            'total_amount': self.total_amount,
            'status': self.status,
            'tracking_number': self.tracking_number,
            'memo': self.memo,
            'items': [item.to_dict() for item in self.items],
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'shipped_at': self.shipped_at.isoformat() if self.shipped_at else None,
            'delivered_at': self.delivered_at.isoformat() if self.delivered_at else None,
            'cancelled_at': self.cancelled_at.isoformat() if self.cancelled_at else None,
        }


class OrderItem(db.Model):
    __tablename__ = 'order_items'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = db.Column(db.String(36), db.ForeignKey('orders.id'), nullable=False)
    
    product_id = db.Column(db.String(50), nullable=False)
    product_name = db.Column(db.String(255), nullable=False)
    product_type = db.Column(db.String(50), nullable=False)
    
    quantity = db.Column(db.Integer, default=1, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    
    # Config stored as JSON for complex product configurations
    config = db.Column(db.JSON, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'product_name': self.product_name,
            'product_type': self.product_type,
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'total_price': self.total_price,
            'config': self.config,
            'created_at': self.created_at.isoformat(),
        }

class Profile(db.Model):
    """Store user profile data with PDF uploads"""
    __tablename__ = 'profiles'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, unique=True)
    
    # Profile information
    profile_name = db.Column(db.String(255), nullable=True)
    profile_data = db.Column(db.JSON, nullable=True)  # Store profile configuration as JSON
    
    # Address information
    address_recipient_name = db.Column(db.String(120), nullable=True)
    address_phone = db.Column(db.String(20), nullable=True)
    address_province = db.Column(db.String(50), nullable=True)
    address_detail = db.Column(db.Text, nullable=True)
    
    # PDF file path
    pdf_path = db.Column(db.String(500), nullable=True)
    pdf_filename = db.Column(db.String(255), nullable=True)
    pdf_base64 = db.Column(db.Text, nullable=True)  # Store base64 encoded PDF
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='profiles')
    
    def to_dict(self, include_pdf_data=False):
        data = {
            'id': self.id,
            'user_id': self.user_id,
            'profile_name': self.profile_name,
            'profile_data': self.profile_data,
            'address': {
                'recipient_name': self.address_recipient_name,
                'phone': self.address_phone,
                'province': self.address_province,
                'detail': self.address_detail,
            },
            'pdf_filename': self.pdf_filename,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        
        if include_pdf_data and self.pdf_base64:
            data['pdf_base64'] = self.pdf_base64
        
        return data