# 🚀 Quick Reference Card

## Start Your System (Copy & Paste)

### Terminal 1: Backend
```bash
cd alufactory-backend
pip install -r requirements.txt
python init_db.py
python run.py
```

### Terminal 2: Frontend
```bash
npm install
npm run dev
```

---

## URLs

| Purpose | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Backend** | http://localhost:5000 |
| **API Base** | http://localhost:5000/api |
| **Admin Dashboard** | http://localhost:5000/admin/index.html |
| **Admin Login** | http://localhost:5000/admin/login.html |

---

## Test Accounts

### Regular Customer
```
Phone: 18888888888
Password: demo123
Username: Demo Customer
```

### Admin
```
Phone: 13916813579
Password: admin
Username: System Admin
```

---

## Key Files Changed

| File | Change | Notes |
|------|--------|-------|
| `App.tsx` | MockService → ApiService | 12 calls updated |
| `services/apiService.ts` | ✨ NEW | 31 API endpoints |
| `.env.local` | ✨ NEW | Backend URL config |
| `alufactory-backend/` | ✨ NEW | Complete backend |

---

## API Endpoints (Quick List)

### Auth (POST)
- `/api/auth/register` → Create account
- `/api/auth/login` → Get JWT token
- `/api/auth/logout` → Clear session
- `/api/auth/me` → Get current user
- `/api/auth/change-password` → Update password

### Users (GET/PUT/POST/DELETE)
- `/api/users/{id}` → Get/update profile
- `/api/users/{id}/addresses` → Get addresses
- `/api/users/{id}/addresses` → Add address
- `/api/users/addresses/{id}` → Update/delete

### Cart (GET/POST/PUT/DELETE)
- `/api/cart` → View cart
- `/api/cart/items` → Add items
- `/api/cart/items/{id}` → Update/remove
- `/api/cart/clear` → Empty cart

### Orders (GET/POST/PUT/DELETE)
- `/api/orders` → Get user's orders
- `/api/orders` → Create order
- `/api/orders/{id}` → Get/update/delete

### Admin (GET/POST/PUT) - Admin only
- `/api/admin/users` → List users
- `/api/admin/users/{id}/activate` → Enable user
- `/api/admin/users/{id}/promote` → Make admin
- `/api/admin/orders` → List all orders
- `/api/admin/statistics` → Dashboard stats

---

## Database Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `user` | id, username, phone, password_hash, is_admin | Account storage |
| `address` | id, user_id, name, phone, province, detail | Shipping addresses |
| `cart` | id, user_id, total | Shopping cart |
| `cart_item` | id, cart_id, product_id, quantity, config | Cart items |
| `order` | id, order_number, user_id, total, status | Orders |
| `order_item` | id, order_id, product_id, quantity, config | Order line items |

---

## Common Tasks

### Register New User
1. Click "Register"
2. Fill phone, username, password
3. Submit
4. Auto-logged in

### Add to Cart
1. Browse catalog
2. Configure product
3. Click "Add to Cart"
4. View cart badge count

### Checkout
1. Click cart icon
2. Add/select shipping address
3. Click "Save & Download PDF"
4. Order created!

### View Orders
1. Click "History"
2. See all your orders
3. Click to view details

### Change Password
1. Click your name
2. Go to "Profile"
3. Enter new password
4. Click "Update"

### Admin Dashboard
1. Go to `/admin/login.html`
2. Login with admin credentials
3. View users and orders
4. Manage everything

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Backend won't start | Check Python installed: `python --version` |
| | Check pip packages: `pip list` |
| Frontend won't connect | Ensure backend running on port 5000 |
| | Check `.env.local` has `VITE_API_URL=http://localhost:5000/api` |
| Login fails | Run `python init_db.py` |
| | Check MySQL running |
| Order doesn't save | Make sure signed in with valid JWT |
| | Check backend logs for errors |
| Data disappears | This is normal now - it uses database! |
| | If lost, check database: `SELECT * FROM order;` |

---

## Documentation Files

| File | Purpose |
|------|---------|
| `README_FINAL.md` | Complete overview (START HERE!) |
| `FRONTEND_INTEGRATION.md` | Setup & configuration |
| `INTEGRATION_SUMMARY.md` | Before/after flow |
| `TESTING_GUIDE.md` | Full testing procedure |
| `ARCHITECTURE.md` | System diagrams & flows |
| `alufactory-backend/README.md` | Backend deployment guide |
| `alufactory-backend/QUICKSTART.md` | 5-minute setup |

---

## What's New ✨

### Before (Mock)
- Data in browser only
- Lost on page refresh
- Users logged out on website update

### After (Real)
- Data in MySQL database
- Persists forever ✅
- Users stay logged in
- Accounts survive website updates
- Real e-commerce system

---

## Next Steps

1. ✅ **Run backend**: `python run.py`
2. ✅ **Run frontend**: `npm run dev`
3. ✅ **Test registration**: Create new account
4. ✅ **Test shopping**: Add items to cart, checkout
5. ✅ **Test persistence**: Refresh page, still logged in!
6. 📖 **Follow TESTING_GUIDE.md**: Complete all 10 phases
7. 📊 **View admin dashboard**: Check `http://localhost:5000/admin/login.html`
8. 🚀 **Deploy to Aliyun**: Follow backend README.md

---

## Key Endpoints for Testing

### Test in Browser
```
Health check:
http://localhost:5000/api/health

Admin Dashboard:
http://localhost:5000/admin/login.html

Admin (backend):
http://localhost:5000/admin/index.html
```

### Test in Postman/cURL
```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"phone":"12345678901","username":"Test","password":"test123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"12345678901","password":"test123"}'

# Get Current User (after login, use token from response)
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Environment Variables

### Frontend (.env.local)
```
VITE_API_URL=http://localhost:5000/api
VITE_ENV=development
```

### Backend (.env)
```
FLASK_ENV=development
DATABASE_URL=mysql+pymysql://root:root@localhost:3306/alufactory_db
JWT_SECRET_KEY=your-secret-key
SECRET_KEY=your-secret-key
```

---

## Support Checklist

Before asking for help, check:

- [ ] Backend running? (`python run.py` in one terminal)
- [ ] Frontend running? (`npm run dev` in another terminal)
- [ ] MySQL running? (check Services)
- [ ] Database initialized? (ran `python init_db.py`)
- [ ] `.env` files configured correctly?
- [ ] Port 5000 and 5173 not in use by other apps?
- [ ] Checked browser console for errors? (F12)
- [ ] Tried hard refresh? (Ctrl+F5)
- [ ] Checked backend logs for errors?

---

## Success! 🎉

Your e-commerce system is ready!

✅ Customers have real accounts
✅ Orders are permanent
✅ Addresses are saved
✅ No re-registration needed
✅ Website updates don't affect accounts

**NOW TEST IT! Follow TESTING_GUIDE.md**

---

## Emergency Restart

Reset everything:
```bash
# Stop both servers (Ctrl+C in each terminal)

# Reset database
cd alufactory-backend
python init_db.py

# Start backend
python run.py

# In another terminal
npm run dev

# Visit http://localhost:5173
```

---

## Quick Reference: JWT Flow

```
1. Register/Login
   ↓
2. Get JWT token
   ↓
3. Store in localStorage
   ↓
4. Send in Authorization header
   ↓
5. Backend verifies token
   ↓
6. Process request
   ↓
7. Return data
```

**Token expires:** 30 days
**Auto-login:** Yes (if token valid)
**Logout:** Clears token from storage

---

**That's it! You're ready to go! 🚀**

Start with README_FINAL.md or TESTING_GUIDE.md
