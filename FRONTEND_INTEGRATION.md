# Frontend + Backend Integration Guide

## 🔗 Connection Setup

Your frontend is now connected to the Flask backend! Here's what was updated:

### Changes Made

1. **Replaced MockService with ApiService**
   - All API calls now go to: `http://localhost:5000/api`
   - JWT tokens are stored in localStorage
   - Authentication persists across page refreshes

2. **Authentication Flow**
   - Register/Login creates a JWT token
   - Token is automatically stored and sent with every request
   - Token expires after 30 days (can be changed in backend)
   - Auto-redirect to login if token expires

3. **User Data Persistence**
   - Customers keep their account and addresses across deployments
   - Orders are stored in the database
   - No more re-registration needed!

## 🚀 Quick Start

### 1. Start Backend (Terminal 1)
```bash
cd alufactory-backend
python run.py
```

### 2. Start Frontend (Terminal 2)
```bash
npm run dev
```

### 3. Test It
1. Go to `http://localhost:5173` (or shown in terminal)
2. Click **Register** with test data:
   - Phone: `18888888888`
   - Username: `testuser`
   - Password: `test123`
3. Create a profile and add to cart
4. Checkout with shipping address
5. View order history

### 4. Admin Dashboard (Optional)
- Open `http://localhost:5000/admin/login.html`
- Phone: `13800138000`
- Password: `admin123`
- Manage users and orders

## 🔧 Configuration

Update `.env.local` if your backend is on a different URL:

```env
VITE_API_URL=http://your-backend-url/api
```

## 📦 What Works Now

✅ **User Accounts**
- Register new customer (creates account in database)
- Login with existing account (JWT authentication)
- Change password securely
- Save multiple shipping addresses
- Account persists forever

✅ **Shopping**
- Add profiles to cart
- Update quantities
- View cart total with shipping
- Create orders (saved to database)

✅ **Orders**
- Orders saved with customer ID
- View order history
- Download order PDF
- Delete order records

✅ **Admin Management**
- Admin dashboard at `/admin/login.html`
- View all customers and orders
- Manage user membership levels
- Track order status

## 🐛 Troubleshooting

**Frontend can't connect to backend?**
```
Error: Failed to fetch /api/...
```
- Ensure backend is running: `python run.py`
- Check backend is on `http://localhost:5000`
- Check CORS is enabled (it is by default)

**Login fails?**
```
Error: API request failed
```
- Ensure database is initialized: `python init_db.py`
- Verify credentials match backend users
- Check `.env` file has DATABASE_URL set

**Orders not saving?**
- Verify MySQL is running
- Check `python init_db.py` executed successfully
- Look at backend logs for errors

## 📝 Key Endpoints Used

- `POST /api/auth/register` - New account creation
- `POST /api/auth/login` - User authentication
- `GET /api/auth/me` - Get current user
- `POST /api/cart/items` - Add to cart
- `POST /api/orders` - Create order
- `GET /api/orders` - Get user's orders
- `PUT /api/users/{id}/addresses` - Save addresses

All endpoints return JSON and require JWT token (except login/register).

## 🎯 Next Steps

1. ✅ **Test locally** - Verify everything works with test data
2. **Customize** - Update products, prices, shipping rates in constants.ts
3. **Database migration** - When ready, backup your local database
4. **Deploy to Aliyun** - Follow backend README.md for cloud deployment
5. **Update frontend URL** - Change VITE_API_URL to your cloud backend

## 📞 Support

If customers have issues:
1. Clear browser cache and localStorage: `localStorage.clear()`
2. Try registering with a different phone number
3. Check backend logs for detailed errors
4. Verify internet connection to API

Your customers are now ready to use the real system!
