# Alufactory - Complete Setup Guide

## ✅ What's Been Implemented

### Backend Enhancements
1. **Static File Serving**: Backend now serves the admin dashboard at `http://localhost:5000/admin/index.html`
2. **Test Accounts**: Two test accounts have been created:
   - Regular User: `19821200413` / `123456`
   - Admin User: `13916813579` / `admin`
3. **Profile Management API**: New endpoints to save user profiles with addresses and PDFs
4. **Admin Dashboard Updates**: New "用户资料" (User Profiles) tab to manage and view all user profiles

### Database Changes
- **Profile Model**: New `Profile` table stores:
  - Profile name and configuration
  - Delivery address (recipient, phone, province, detail)
  - PDF file (as base64)
  - Created/updated timestamps

## 🚀 How to Run

### Start the Backend
```bash
cd alufactory-backend
python run_prod.py
```

Backend will be available at: `http://localhost:5000`

### Access Admin Dashboard
Open in your browser:
```
http://localhost:5000/admin/index.html
```

Login with admin credentials:
- Phone: `13916813579`
- Password: `admin`

## 📋 Testing the Complete Flow

### 1. User Registers/Logs In
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "19821200413",
    "password": "123456"
  }'
```

Response will include `access_token` - save this for next requests.

### 2. User Creates Profile with Address
```bash
curl -X POST http://localhost:5000/api/profiles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "profile_name": "My Aluminum Profile",
    "profile_data": {
      "material": "aluminum",
      "thickness": 2.0,
      "width": 1000,
      "height": 500
    },
    "address": {
      "recipient_name": "Zhang San",
      "phone": "18888888888",
      "province": "Shanghai",
      "detail": "123 Main Street, Building A, Room 100"
    },
    "pdf_base64": "JVBERi0xLjQK..."
  }'
```

### 3. View Profiles in Admin Dashboard
1. Go to `http://localhost:5000/admin/index.html`
2. Login with admin account
3. Click on "📄 用户资料" tab
4. View all profiles created by users
5. Click "查看" button to see full details
6. Download PDF if available

## 📊 Admin Dashboard Features

### Dashboard Tab
- Total users count
- Active users
- Total orders
- Pending/shipped/delivered orders
- Total revenue

### Users Tab
- View all users
- Edit user membership level
- Activate/deactivate users

### Profiles Tab (NEW!)
- View all user-created profiles
- See profile name, owner, phone, address
- Check if PDF is attached
- Click to view full details with PDF download

### Orders Tab
- View all orders
- Filter by status
- Edit order status and tracking info

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register
- `GET /api/auth/me` - Current user

### Profiles
- `GET /api/profiles` - List user's profiles
- `POST /api/profiles` - Create profile
- `GET /api/profiles/<id>` - Get profile details
- `PUT /api/profiles/<id>` - Update profile
- `DELETE /api/profiles/<id>` - Delete profile

### Admin
- `GET /api/admin/profiles` - List all profiles (admin only)
- `GET /api/admin/profiles/<id>` - Get profile details with PDF
- `GET /api/admin/statistics` - Dashboard stats
- `GET /api/admin/users` - List all users

## 📁 File Structure

```
alufactory-backend/
├── app/
│   ├── __init__.py (Updated: serves static files)
│   ├── models/
│   │   └── user.py (Updated: Profile model added)
│   ├── routes/
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── profiles.py (NEW: Profile management)
│   │   ├── admin.py (Updated: profiles endpoints)
│   │   ├── cart.py
│   │   └── orders.py
├── admin/
│   ├── index.html (Updated: profiles tab added)
│   └── login.html
├── alufactory.db (SQLite database)
├── run.py
├── run_prod.py (NEW: production runner)
├── create_test_accounts.py (NEW: test account creation)
├── test_api.py (NEW: API test suite)
└── TEST_ACCOUNTS.md (NEW: this file)
```

## 🔐 Security Notes
- All endpoints require JWT authentication (except login/register)
- Admin-only endpoints are protected by admin check
- Passwords are hashed using PBKDF2
- PDFs are stored as base64 to avoid file system issues

## 💾 Database Location
SQLite database file: `alufactory-backend/alufactory.db`

To reset the database:
1. Delete `alufactory.db`
2. Run `python init_db.py` to reinitialize
3. Run `python create_test_accounts.py` to recreate test accounts

## 🐛 Troubleshooting

### Backend not starting
- Ensure Python 3.10+ is installed
- Check if port 5000 is available
- Run `pip install -r requirements.txt` to install dependencies

### Admin dashboard not loading
- Make sure backend is running on `http://localhost:5000`
- Clear browser cache
- Check browser console for errors

### Cannot create profile
- Verify JWT token is valid
- Check the profile data format
- Ensure address fields are provided

### PDFs not showing in admin
- PDF must be provided as base64 string
- Frontend must encode PDF file to base64 before sending

## 📱 Frontend Integration

The frontend should:
1. Handle user login and store JWT token
2. Provide profile editor with address form
3. Generate PDF from profile data
4. Convert PDF to base64
5. Send to `/api/profiles` endpoint with token in Authorization header

Example frontend flow:
```javascript
// 1. Login
const loginResp = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({phone, password})
});
const {access_token} = await loginResp.json();
localStorage.setItem('token', access_token);

// 2. Create profile with PDF
const profileResp = await fetch('/api/profiles', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${access_token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    profile_name: "My Profile",
    profile_data: {...},
    address: {...},
    pdf_base64: await generateAndConvertPdfToBase64()
  })
});
```

## ✨ Key Features

✅ User registration and login
✅ JWT authentication
✅ Profile creation with address
✅ PDF storage and retrieval  
✅ Admin dashboard
✅ User profile management
✅ Admin can view all profiles with details
✅ PDF download from admin panel
✅ SQLite persistence
✅ RESTful API design
✅ CORS enabled for frontend integration

---

**Ready to use!** Start the backend and access the admin dashboard to test the complete flow.
