# System Architecture & Data Flow

## Complete System Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        CUSTOMER BROWSER (React)                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  App.tsx                                                               │  │
│  │  ├─ Auth Component (Login/Register)                                   │  │
│  │  ├─ Catalog Component (Product Selection)                             │  │
│  │  ├─ Cart Component (Shopping Cart)                                    │  │
│  │  ├─ Checkout Component (Orders)                                       │  │
│  │  ├─ History Component (Order History)                                 │  │
│  │  └─ Profile Component (User Settings & Addresses)                     │  │
│  │                                                                        │  │
│  │  services/apiService.ts                                               │  │
│  │  └─ Manages all API calls to backend                                  │  │
│  │                                                                        │  │
│  │  localStorage                                                          │  │
│  │  └─ Stores JWT token for authentication                               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──────────────────┬──────────────────────────────────────────────────────────┘
                   │
                   │ HTTP/JSON + JWT Token
                   ↓
┌────────────────────────────────────────────────────────────────────────────┐
│                      FLASK BACKEND SERVER                                   │
│  http://localhost:5000                                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  app/__init__.py (Flask Factory)                                    │  │
│  │  ├─ CORS configuration                                              │  │
│  │  ├─ JWT manager                                                     │  │
│  │  ├─ Database initialization                                         │  │
│  │  └─ Blueprint registration                                          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Route Blueprints (31 Endpoints Total)                              │  │
│  │                                                                      │  │
│  │  auth.py                  users.py                  cart.py          │  │
│  │  ├─ POST /register        ├─ GET /users/{id}      ├─ GET /cart    │  │
│  │  ├─ POST /login           ├─ PUT /users/{id}      ├─ POST /items  │  │
│  │  ├─ GET /me               ├─ GET /addresses       ├─ PUT /items   │  │
│  │  ├─ POST /change-pwd      ├─ POST /addresses      ├─ DEL /items   │  │
│  │  └─ POST /logout          ├─ PUT /addresses       └─ POST /clear  │  │
│  │                           └─ DEL /addresses                         │  │
│  │                                                                      │  │
│  │  orders.py                admin.py                                  │  │
│  │  ├─ GET /orders           ├─ GET /users (all)                      │  │
│  │  ├─ GET /orders/{id}      ├─ POST /activate                        │  │
│  │  ├─ POST /orders          ├─ POST /deactivate                      │  │
│  │  ├─ PUT /orders/{id}      ├─ POST /promote                         │  │
│  │  └─ DEL /orders/{id}      ├─ PUT /membership                       │  │
│  │                           ├─ GET /orders (all)                      │  │
│  │                           ├─ PUT /orders/status                     │  │
│  │                           └─ GET /statistics                        │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  SQLAlchemy Models (app/models/user.py)                             │  │
│  │  ├─ User          → user table                                       │  │
│  │  ├─ Address       → address table                                    │  │
│  │  ├─ Cart          → cart table                                       │  │
│  │  ├─ CartItem      → cart_item table                                  │  │
│  │  ├─ Order         → order table                                      │  │
│  │  └─ OrderItem     → order_item table                                 │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Authentication & Authorization                                      │  │
│  │  ├─ JWT tokens (Flask-JWT-Extended)                                 │  │
│  │  ├─ Password hashing (Werkzeug)                                     │  │
│  │  ├─ Role-based access (@admin_required decorator)                   │  │
│  │  └─ Token expiration (30 days)                                      │  │
│  │                                                                      │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  admin/                                                                     │
│  ├─ login.html (Login UI)                                                 │
│  └─ index.html (Admin Dashboard)                                          │
│                                                                             │
└──────────────────┬──────────────────────────────────────────────────────────┘
                   │
                   │ SQL Queries + SQLAlchemy ORM
                   ↓
┌────────────────────────────────────────────────────────────────────────────┐
│                          MYSQL DATABASE                                     │
│  Database: alufactory_db                                                   │
│  Charset: utf8mb4                                                          │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ user table              │ order table                             │   │
│  ├─ id (PK)               ├─ id (PK)                              │   │
│  ├─ username              ├─ order_number (unique)                │   │
│  ├─ phone (unique)        ├─ user_id (FK)                         │   │
│  ├─ password_hash         ├─ total                                │   │
│  ├─ is_admin              ├─ shipping_fee                         │   │
│  ├─ membership_level      ├─ status                               │   │
│  ├─ created_at            ├─ created_at                           │   │
│  └─ updated_at            └─ updated_at                           │   │
│                                                                     │   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ address table           │ cart table                           │   │
│  ├─ id (PK)               ├─ id (PK)                              │   │
│  ├─ user_id (FK)          ├─ user_id (FK, unique)                │   │
│  ├─ name                  └─ total                                │   │
│  ├─ phone                                                          │   │
│  ├─ province                                                       │   │
│  ├─ detail                                                         │   │
│  └─ is_default                                                     │   │
│                                                                     │   │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │ cart_item table         │ order_item table                     │   │
│  ├─ id (PK)               ├─ id (PK)                              │   │
│  ├─ cart_id (FK)          ├─ order_id (FK)                        │   │
│  ├─ product_id            ├─ product_id                           │   │
│  ├─ quantity              ├─ quantity                             │   │
│  ├─ config (JSON)         ├─ price                                │   │
│  └─ total_price           └─ config (JSON)                        │   │
│                                                                     │   │
│  Relationships:                                                     │   │
│  ├─ user → addresses (1:many)                                      │   │
│  ├─ user → orders (1:many)                                         │   │
│  ├─ user → carts (1:1)                                             │   │
│  ├─ cart → cart_items (1:many)                                     │   │
│  ├─ order → order_items (1:many)                                   │   │
│  └─ All FK columns indexed for performance                         │   │
│                                                                     │   │
└────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Authentication Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. REGISTRATION                                                  │
│                                                                  │
│   User fills form (phone, username, password)                  │
│          ↓                                                       │
│   Frontend calls: ApiService.register(phone, pwd, name)        │
│          ↓                                                       │
│   POST /api/auth/register {phone, username, password}          │
│          ↓                                                       │
│   Backend hashes password with Werkzeug                         │
│   Backend creates User record in database                       │
│   Backend generates JWT token (30-day expiry)                   │
│          ↓                                                       │
│   Returns: {access_token: "eyJ...", user: {id, name}}          │
│          ↓                                                       │
│   Frontend stores token in localStorage                         │
│   Frontend shows user profile page                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 2. LOGIN                                                         │
│                                                                  │
│   User fills form (phone, password)                             │
│          ↓                                                       │
│   Frontend calls: ApiService.login(phone, password)             │
│          ↓                                                       │
│   POST /api/auth/login {phone, password}                        │
│          ↓                                                       │
│   Backend looks up user by phone                                │
│   Backend verifies password hash                                │
│          ↓ SUCCESS:                                              │
│   Backend generates JWT token                                   │
│   Returns: {access_token: "eyJ...", user: {id, name}}          │
│          ↓                                                       │
│   Frontend stores token                                         │
│   Logged in! Can now use protected endpoints                    │
│                                                                  │
│          ↓ FAILURE:                                              │
│   Returns error: "Invalid credentials"                          │
│   Frontend shows error message                                  │
│   User stays on login page                                      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 3. AUTHENTICATED REQUESTS                                        │
│                                                                  │
│   Every API request after login includes token:                 │
│                                                                  │
│   Headers: {                                                     │
│     "Authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGc...",       │
│     "Content-Type": "application/json"                          │
│   }                                                              │
│          ↓                                                       │
│   Backend checks Authorization header                           │
│   Backend verifies JWT signature                                │
│   Backend extracts user ID from token                           │
│          ↓ VALID TOKEN:                                          │
│   Process request (get user's cart, orders, etc.)              │
│   Return data                                                   │
│          ↓ INVALID/EXPIRED TOKEN:                                │
│   Return 401 Unauthorized                                       │
│   Frontend clears token and redirects to login                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 4. PERSISTENCE                                                   │
│                                                                  │
│   Browser closes...                                             │
│          ↓                                                       │
│   JWT token stays in localStorage                               │
│          ↓                                                       │
│   User returns to website 1 week later                          │
│          ↓                                                       │
│   Frontend checks localStorage for token                        │
│   Frontend calls: ApiService.getCurrentUser()                   │
│          ↓                                                       │
│   GET /api/auth/me (with token in header)                       │
│          ↓                                                       │
│   Backend verifies token, returns user data                     │
│          ↓                                                       │
│   User automatically logged in!                                 │
│   Can see orders, addresses, everything                         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Order Creation Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ CUSTOMER ADDS ITEMS TO CART                                      │
│                                                                  │
│ 1. Select Profile (1000mm length, top tapping, drill holes)    │
│    ↓                                                             │
│ 2. Click "Add to Cart"                                           │
│    ↓                                                             │
│ POST /api/cart/items                                             │
│ {                                                                │
│   "product_id": "PROFILE_6063",                                 │
│   "quantity": 2,                                                │
│   "config": {                                                    │
│     "length": 1000,                                             │
│     "tapping": {"left": true, "right": false},                 │
│     "holes": [{"side": "A", "positionMm": 500}],               │
│     "finish": "oxidized"                                        │
│   }                                                              │
│ }                                                                │
│    ↓                                                             │
│ 3. Backend verifies user (from JWT token)                        │
│ 4. Backend calculates price                                      │
│ 5. Backend adds/updates CartItem in database                     │
│    ↓                                                             │
│ 6. Cart badge shows "1" item                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ CUSTOMER PROCEEDS TO CHECKOUT                                    │
│                                                                  │
│ 1. Click "Cart" → View cart with 2 items (1000mm + 500mm)      │
│    ↓                                                             │
│ 2. See total: ￥250 + shipping ￥50 = ￥300                      │
│    ↓                                                             │
│ 3. Select or add shipping address:                              │
│    - Name: Mr. Wang                                             │
│    - Phone: 13612345678                                         │
│    - Address: Beijing, Chaoyang District                        │
│    ↓                                                             │
│ 4. PUT /api/users/{userId}/addresses                            │
│    (Save address to profile)                                     │
│    ↓                                                             │
│ 5. Click "Save & Download PDF"                                   │
│    ↓                                                             │
│ 6. Frontend generates PDF with all order details                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ORDER CREATION                                                   │
│                                                                  │
│ Frontend creates Order object:                                  │
│ {                                                                │
│   "id": "ORDER-20250121-001",                                   │
│   "date": "2025-01-21",                                         │
│   "items": [                                                     │
│     {product, quantity, config, totalPrice},                    │
│     {product, quantity, config, totalPrice}                     │
│   ],                                                             │
│   "total": 300,                                                 │
│   "shippingFee": 50,                                            │
│   "status": "pending",                                          │
│   "userId": "18888888888",                                      │
│   "address": {id, name, phone, province, detail}               │
│ }                                                                │
│    ↓                                                             │
│ POST /api/orders {all order data}                               │
│    ↓                                                             │
│ Backend receives order                                          │
│ Backend verifies user (from JWT)                                │
│ Backend creates Order record                                    │
│ Backend creates OrderItem records for each product              │
│ Backend clears user's cart                                      │
│ Backend returns: {order_id, confirmation}                       │
│    ↓                                                             │
│ Frontend:                                                        │
│ - Downloads PDF                                                 │
│ - Shows success message                                         │
│ - Clears local cart                                             │
│ - Navigates to order history                                    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ IN DATABASE (MySQL)                                              │
│                                                                  │
│ CREATE: order row                                                │
│ ├─ id: ORDER-20250121-001                                        │
│ ├─ order_number: ORD-2025-0001                                  │
│ ├─ user_id: 18888888888                                         │
│ ├─ total: 300                                                   │
│ ├─ shipping_fee: 50                                             │
│ ├─ status: "pending"                                            │
│ ├─ created_at: 2025-01-21 10:30:45                              │
│ └─ updated_at: 2025-01-21 10:30:45                              │
│                                                                  │
│ CREATE: order_item rows (1 per product)                         │
│ ├─ order_id: ORDER-20250121-001                                 │
│ ├─ product_id: PROFILE_6063                                     │
│ ├─ quantity: 2                                                  │
│ ├─ price: 125 (per item)                                        │
│ └─ config: {JSON with tapping, holes, finish}                  │
│                                                                  │
│ UPDATE: address (mark as used for delivery)                      │
│ EMPTY: cart (clear all items, keep cart record)                 │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Request/Response Examples

### Register
```
→ REQUEST
POST /api/auth/register
Content-Type: application/json

{
  "phone": "18888888888",
  "username": "Mr. Wang",
  "password": "mypassword123"
}

← RESPONSE (201 Created)
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": "18888888888",
    "username": "Mr. Wang",
    "is_admin": false,
    "created_at": "2025-01-21T10:30:00"
  }
}
```

### Get Current User
```
→ REQUEST
GET /api/auth/me
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...

← RESPONSE (200 OK)
{
  "id": "18888888888",
  "username": "Mr. Wang",
  "phone": "18888888888",
  "is_admin": false,
  "addresses": [
    {
      "id": "addr-123",
      "name": "Home",
      "phone": "13612345678",
      "province": "Beijing",
      "detail": "Chaoyang District...",
      "is_default": true
    }
  ]
}
```

### Create Order
```
→ REQUEST
POST /api/orders
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{
  "items": [
    {
      "product_id": "PROFILE_6063",
      "quantity": 2,
      "config": {...}
    }
  ],
  "total": 300,
  "shipping_fee": 50,
  "address_id": "addr-123"
}

← RESPONSE (201 Created)
{
  "id": "ORDER-20250121-001",
  "order_number": "ORD-2025-0001",
  "status": "pending",
  "total": 300,
  "created_at": "2025-01-21T10:30:00"
}
```

---

## State Diagram: User Journey

```
                    ┌─────────────────┐
                    │   NO ACCOUNT    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   VISIT SITE    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────────┐
              ┌─────│  SEE LOGIN FORM    │
              │     └────────────────────┘
              │            │
        [REGISTER]    [LOGIN]
              │            │
              │     ┌──────▼──────┐
              │     │  TRY LOGIN  │
              │     └──────┬──────┘
              │            │
              │      ┌─────▼──────────┐
              │      │ INVALID CREDS? │
              │      └─────┬──────┬───┘
              │           NO    YES
              │            │      │
              │     ┌──────▼──┐  SHOW
              └────►│ REGISTER│  ERROR
                    │  USER   │  RETRY
                    └────┬────┘  LOGIN
                         │
                    ┌────▼──────────┐
                    │ CREATE ACCOUNT │
                    │ HASH PASSWORD  │
                    │ SAVE IN DB     │
                    └────┬───────────┘
                         │
                    ┌────▼────────────────┐
                    │  GIVE JWT TOKEN     │
                    │  STORE IN BROWSER   │
                    └────┬────────────────┘
                         │
                    ┌────▼──────────────┐
                    │  ✅ LOGGED IN     │
                    │  - Browse catalog │
                    │  - Add to cart    │
                    │  - Save addresses │
                    │  - Create orders  │
                    │  - View history   │
                    └────┬──────────────┘
                         │
                    ┌────▼──────────────┐
                    │ LOGOUT BUTTON     │
                    └────┬──────────────┘
                         │
                    ┌────▼──────────────┐
                    │ CLEAR TOKEN       │
                    │ REMOVE FROM DB    │
                    └────┬──────────────┘
                         │
                    ┌────▼──────────────┐
                    │ BACK TO LOGIN     │
                    │ (later can login  │
                    │  again, same acc) │
                    └───────────────────┘
```

---

## Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 | UI framework |
| | TypeScript | Type safety |
| | Vite | Build tool |
| | Lucide Icons | Icons |
| | React Router | Navigation |
| **API Client** | Fetch API | HTTP requests |
| | localStorage | Token storage |
| **Backend** | Python 3.11 | Language |
| | Flask 2.3 | Web framework |
| | SQLAlchemy | ORM |
| | Flask-JWT-Extended | Authentication |
| | Flask-CORS | Cross-origin requests |
| | Werkzeug | Password hashing |
| **Database** | MySQL 8.0 | Data storage |
| | PyMySQL | Driver |
| **Deployment** | Gunicorn | Production server |
| | Nginx | Reverse proxy |

This architecture ensures:
- ✅ Scalability (Flask blueprints, SQLAlchemy relationships)
- ✅ Security (JWT auth, password hashing, CORS)
- ✅ Persistence (MySQL database)
- ✅ Type Safety (TypeScript + Python type hints)
- ✅ Maintainability (Modular code, clear separation)
