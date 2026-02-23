# Alufactory Backend Setup Guide

## Overview
This is a complete Flask + MySQL backend for Alufactory e-commerce platform with:
- User authentication & authorization
- CRUD operations for users, addresses, orders, and carts
- Admin dashboard for order and user management
- JWT-based authentication
- CORS support for frontend integration

## Project Structure

```
alufactory-backend/
├── app/
│   ├── __init__.py           # Flask app factory
│   ├── models/
│   │   └── user.py          # Database models (User, Order, Cart, Address)
│   └── routes/
│       ├── auth.py          # Authentication routes
│       ├── users.py         # User management routes
│       ├── cart.py          # Shopping cart routes
│       ├── orders.py        # Order management routes
│       └── admin.py         # Admin management routes
├── admin/
│   ├── index.html           # Admin dashboard
│   └── login.html           # Admin login page
├── config.py                # Configuration management
├── requirements.txt         # Python dependencies
├── run.py                   # Entry point
└── init_db.py              # Database initialization
```

## Installation & Setup

### 1. Install MySQL (if not already installed)

**Windows:**
- Download and install MySQL Community Server from https://dev.mysql.com/downloads/mysql/
- During installation, set root password and remember it
- Make sure MySQL service is running

**macOS:**
```bash
brew install mysql
brew services start mysql
```

**Linux:**
```bash
sudo apt-get install mysql-server
sudo service mysql start
```

### 2. Create Database

Open MySQL terminal/client and run:

```sql
CREATE DATABASE IF NOT EXISTS alufactory_db;
ALTER DATABASE alufactory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Install Python Dependencies

```bash
cd alufactory-backend
pip install -r requirements.txt
```

### 4. Configure Environment

Create a `.env` file in the `alufactory-backend` directory:

```env
FLASK_ENV=development
DATABASE_URL=mysql+pymysql://root:your_password@localhost:3306/alufactory_db
SECRET_KEY=your-secret-key-change-in-production
JWT_SECRET_KEY=your-jwt-secret-key-change-in-production
```

Replace:
- `your_password` with your MySQL root password
- `your-secret-key-change-in-production` with a strong secret
- `your-jwt-secret-key-change-in-production` with a strong JWT secret

### 5. Initialize Database

```bash
python init_db.py
```

This creates:
- All necessary database tables
- Initial admin user (phone: 13916813579, password: admin)
- Demo customer user (phone: 18888888888, password: demo123)

### 6. Run the Backend

```bash
python run.py
```

The backend will be available at `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (requires JWT)
- `POST /api/auth/change-password` - Change password (requires JWT)
- `POST /api/auth/logout` - Logout (requires JWT)

### Users
- `GET /api/users/<user_id>` - Get user details
- `PUT /api/users/<user_id>` - Update user profile
- `GET /api/users/<user_id>/addresses` - Get user addresses
- `POST /api/users/<user_id>/addresses` - Add new address
- `PUT /api/users/addresses/<address_id>` - Update address
- `DELETE /api/users/addresses/<address_id>` - Delete address

### Cart
- `GET /api/cart` - Get shopping cart
- `POST /api/cart/items` - Add item to cart
- `PUT /api/cart/items/<item_id>` - Update cart item
- `DELETE /api/cart/items/<item_id>` - Remove from cart
- `POST /api/cart/clear` - Clear entire cart

### Orders
- `GET /api/orders` - Get orders (user's or all if admin)
- `GET /api/orders/<order_id>` - Get order details
- `POST /api/orders` - Create new order
- `PUT /api/orders/<order_id>` - Update order (admin only)
- `DELETE /api/orders/<order_id>` - Delete order (admin only)
- `GET /api/orders/stats` - Get order statistics (admin only)

### Admin (All require admin privileges)
- `GET /api/admin/users` - Get all users with pagination
- `POST /api/admin/users/<user_id>/activate` - Activate user
- `POST /api/admin/users/<user_id>/deactivate` - Deactivate user
- `POST /api/admin/users/<user_id>/promote` - Promote to admin
- `PUT /api/admin/users/<user_id>/membership` - Update membership level
- `GET /api/admin/orders` - Get all orders with pagination
- `PUT /api/admin/orders/<order_id>/status` - Update order status
- `GET /api/admin/statistics` - Get dashboard statistics

## Admin Dashboard

### Access
1. Open `admin/login.html` in a web browser (or navigate to admin folder)
2. Login with credentials:
   - Phone: 13916813579
   - Password: admin

### Features
- **Dashboard**: View statistics (users, orders, revenue)
- **User Management**: View, edit membership, activate/deactivate users
- **Order Management**: View orders, update status, add tracking numbers

## Database Models

### User
- id (UUID, Primary Key)
- username (Unique)
- phone (Unique)
- email
- password_hash
- full_name
- membership_level (standard, vip, vip_plus)
- membership_points
- is_active
- is_admin
- created_at, updated_at, last_login

### Address
- id (UUID, Primary Key)
- user_id (Foreign Key)
- recipient_name
- phone
- province
- detail
- is_default
- created_at, updated_at

### Cart
- id (UUID, Primary Key)
- user_id (Foreign Key, Unique)
- created_at, updated_at

### CartItem
- id (UUID, Primary Key)
- cart_id (Foreign Key)
- product_id
- product_name
- product_type
- quantity
- unit_price
- total_price
- config (JSON)

### Order
- id (UUID, Primary Key)
- order_number (Unique, User-friendly)
- user_id (Foreign Key)
- recipient_name, phone, province, address_detail
- subtotal, shipping_fee, total_amount
- status (pending, confirmed, shipped, delivered, cancelled)
- tracking_number
- memo
- created_at, updated_at, shipped_at, delivered_at, cancelled_at

### OrderItem
- id (UUID, Primary Key)
- order_id (Foreign Key)
- product_id, product_name, product_type
- quantity, unit_price, total_price
- config (JSON)

## Frontend Integration

### Example: Login
```javascript
const response = await fetch('http://localhost:5000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ phone: '13916813579', password: 'admin' })
});

const data = await response.json();
localStorage.setItem('authToken', data.access_token);
```

### Example: Get Current User
```javascript
const response = await fetch('http://localhost:5000/api/auth/me', {
  headers: { 'Authorization': `Bearer ${authToken}` }
});

const data = await response.json();
```

### Example: Create Order
```javascript
const response = await fetch('http://localhost:5000/api/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    items: [...],
    recipient_name: 'John Doe',
    phone: '13916813579',
    province: 'Beijing',
    address_detail: '123 Main St',
    subtotal: 100,
    shipping_fee: 10,
    total_amount: 110
  })
});
```

## Production Deployment (Aliyun)

### 1. Update Configuration
Create `.env.production`:
```env
FLASK_ENV=production
DATABASE_URL=mysql+pymysql://user:password@aliyun-rds-host:3306/alufactory_db
SECRET_KEY=your-production-secret-key
JWT_SECRET_KEY=your-production-jwt-secret
```

### 2. Use Production Server (Gunicorn)
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

### 3. Setup Nginx as Reverse Proxy
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 4. Use systemd for Service Management
Create `/etc/systemd/system/alufactory.service`:
```ini
[Unit]
Description=Alufactory Backend
After=network.target

[Service]
Type=notify
User=www
WorkingDirectory=/path/to/alufactory-backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 run:app
Restart=always

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### Database Connection Error
- Check MySQL is running: `sudo service mysql status`
- Verify DATABASE_URL in `.env` file
- Ensure database exists: `mysql -u root -p alufactory_db`

### CORS Issues
- Add frontend URL to CORS origins in `app/__init__.py`
- For development: `CORS(app, origins=['*'])`

### JWT Token Expired
- Tokens are valid for 30 days
- Client should refresh by re-logging in

### Port Already in Use
- Change port in `run.py`: `app.run(port=5001)`
- Or kill process: `lsof -i :5000` and `kill -9 <PID>`

## Support
For issues or questions, refer to the Flask-SQLAlchemy and JWT documentation.
