# Alufactory - Test Guide

## Test Accounts Created

Two test accounts have been created for testing:

### 1. Regular User Account
- **Username**: testuser
- **Phone**: 19821200413
- **Password**: 123456
- **Role**: Standard User

### 2. Admin Account
- **Username**: admin
- **Phone**: 13916813579
- **Password**: admin
- **Role**: Administrator

## Backend API - Running on http://localhost:5000

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - Login with phone and password
- `POST /api/auth/register` - Register new user
- `GET /api/auth/me` - Get current user profile

#### Profile Management
- `GET /api/profiles` - Get all profiles for current user
- `POST /api/profiles` - Create new profile with address and PDF
- `GET /api/profiles/<profile_id>` - Get profile details
- `PUT /api/profiles/<profile_id>` - Update profile
- `DELETE /api/profiles/<profile_id>` - Delete profile

#### Admin Dashboard
- `http://localhost:5000/admin/index.html` - Admin management interface
- `GET /api/admin/statistics` - Dashboard statistics
- `GET /api/admin/users` - List all users
- `GET /api/admin/profiles` - List all user profiles
- `GET /api/admin/profiles/<profile_id>` - Get profile details with PDF

## Testing the Complete Flow

### 1. Login with Test Account
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"19821200413","password":"123456"}'
```

Expected response:
```json
{
  "message": "Login successful",
  "user": {
    "id": "...",
    "username": "testuser",
    "phone": "19821200413",
    ...
  },
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

### 2. Create Profile with Address
```bash
curl -X POST http://localhost:5000/api/profiles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "profile_name": "My Profile",
    "profile_data": {
      "material": "aluminum",
      "thickness": 2.0
    },
    "address": {
      "recipient_name": "John Doe",
      "phone": "18888888888",
      "province": "Shanghai",
      "detail": "123 Main Street, Suite 100"
    },
    "pdf_base64": "JVBERi0xLjQK..."
  }'
```

### 3. View Profiles in Admin Dashboard
1. Go to http://localhost:5000/admin/index.html
2. Login with admin account
3. Click on "用户资料" (User Profiles) tab
4. View all user profiles with their addresses
5. Click "查看" (View) to see full details and download PDFs

## Database
Using SQLite (alufactory.db in the backend directory)

Tables:
- `users` - User accounts
- `profiles` - User profiles with addresses and PDFs
- `addresses` - User delivery addresses
- `orders` - User orders
- `cart` - Shopping cart
- `cart_items` - Cart items

## What's New

### Profile Storage
The Profile model now stores:
- Profile name and configuration
- Delivery address (recipient, phone, province, detail)
- PDF file (as base64 encoded data)
- Created/updated timestamps

### Admin Dashboard Enhancements
- New "用户资料" (User Profiles) tab
- View all user profiles with address information
- View profile details including PDF
- Download PDF files directly from the admin interface

## Frontend Integration

### Recommended Frontend Flow
1. User logs in
2. User creates/edits profile with:
   - Profile name
   - Profile configuration (material, thickness, etc.)
   - Delivery address
   - Generate and save PDF
3. Frontend sends profile data to `/api/profiles` endpoint
4. Admin can view and manage all profiles

## Notes
- All profile PDFs are stored as base64 in the database for easy transfer
- Address information is stored with each profile
- Profiles can be updated and deleted by the owner or admin
- All endpoints require JWT authentication (except registration and login)
