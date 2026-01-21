# 🧪 Complete Testing Guide: Frontend + Backend Integration

## Prerequisites

✅ Backend installed and configured
✅ Frontend code updated with ApiService
✅ MySQL database running locally
✅ `.env` files configured

---

## Phase 1: Backend Verification (5 minutes)

### Step 1: Ensure MySQL is Running
```bash
# Windows: Check if MySQL service is running
sc query MySQL80

# Or open Services.msc and find "MySQL80" or similar
```

### Step 2: Initialize Database
```bash
cd alufactory-backend
python init_db.py
```

**Expected Output:**
```
Database tables created successfully
Initial admin user created
Initial demo customer created
```

### Step 3: Start Backend Server
```bash
python run.py
```

**Expected Output:**
```
 * Running on http://127.0.0.1:5000
 * Press CTRL+C to quit
```

### Step 4: Test Health Endpoint
Open browser: `http://localhost:5000/api/health`

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-21T10:30:00"
}
```

---

## Phase 2: Frontend Verification (5 minutes)

### Step 1: Verify ApiService File
Check that `services/apiService.ts` exists:
```bash
ls -la services/
# Should show: apiService.ts
```

### Step 2: Check Environment Configuration
Open `.env.local` - should have:
```
VITE_API_URL=http://localhost:5000/api
```

### Step 3: Start Frontend
```bash
npm run dev
```

**Expected Output:**
```
VITE v4.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  press h + enter to show help
```

### Step 4: Open in Browser
Navigate to `http://localhost:5173`

**Expected:** Website loads without errors

---

## Phase 3: User Registration Test (5 minutes)

### Step 1: Click Register

### Step 2: Fill Form
- **Phone:** `18888888888`
- **Username:** `TestUser`
- **Password:** `test123`

### Step 3: Submit

**Expected:**
- Form submits without errors
- You're logged in automatically
- Dashboard shows "Welcome TestUser"
- No error messages in browser console

### Step 4: Verify in Backend
Look at backend logs:
```
POST /api/auth/register - 200 OK
```

---

## Phase 4: Profile Creation Test (10 minutes)

### Step 1: Navigate to Catalog
Click "Catalog" from home page

### Step 2: Select a Profile Product
Click on a profile model

### Step 3: Configure Profile
- Set length to 1000mm
- Add some drill holes
- Select finish

### Step 4: Add to Cart
Click "Add to Cart" button

**Expected:**
- Cart count badge appears (shows "1")
- Notification: "Product added to cart"
- No console errors

### Step 5: Add Another Item
Add a different profile with different config

**Expected:**
- Cart badge now shows "2"
- Both items appear in cart with different configs

---

## Phase 5: Order Creation Test (10 minutes)

### Step 1: Go to Cart
Click cart icon

**Expected:**
- Both items show in cart
- Quantities and prices visible
- Total calculated correctly

### Step 2: Add Shipping Address
Click "Add Address"

**Form Fields:**
- **Name:** `Mr. Wang`
- **Phone:** `13612345678`
- **Province:** `Beijing`
- **Address:** `Chaoyang District, Example Street 123`

Click Save

**Expected:**
- Address appears in list
- Address shows as "Default"
- No errors

### Step 3: Checkout
Click "Save & Download PDF"

**Expected:**
- PDF downloads successfully
- Order appears in order history
- Status shows "Pending"
- Success message shown

### Step 4: Verify Database
In backend logs, should see:
```
POST /api/orders - 200 OK
```

---

## Phase 6: Session Persistence Test (10 minutes)

### Step 1: View Order History
Click "History" from nav

**Expected:**
- Your order from Phase 5 shows up
- Order ID, date, total visible
- Status is "Pending"

### Step 2: Hard Refresh Browser
Press `Ctrl+F5` or `Cmd+Shift+R`

**Expected:**
- Still logged in as TestUser
- Order history still visible
- No login prompt
- Same account data

### Step 3: Close Browser Completely
Close all browser windows

### Step 4: Reopen Browser
Go to `http://localhost:5173` again

**Expected:**
- Still logged in!
- Same account data
- Same order history

### Step 5: Logout
Click your name → Click "Logout"

**Expected:**
- Logged out
- Redirected to login page
- Session cleared

### Step 6: Login Again
Phone: `18888888888`
Password: `test123`

**Expected:**
- Logs in successfully
- Same account, addresses, and orders visible
- Everything still there!

---

## Phase 7: Address Management Test (5 minutes)

### Step 1: Go to Profile
Click your name → "Profile"

### Step 2: Edit Address
Click edit button on existing address

**Change:**
- Name to `Ms. Wang`
- Phone to different number

Click Save

**Expected:**
- Address updates immediately
- New data visible

### Step 3: Add New Address
Click "Add New Address"

Fill in:
- Name: `Office Address`
- Phone: `13699999999`
- Province: `Shanghai`
- Address: `Example Tower 88`
- Mark as default: No

Click Save

**Expected:**
- Second address appears
- First address still shows but not default
- New address shows "Not Default"

### Step 4: Delete Address
Click delete on one address

**Expected:**
- Address removed from list
- Other address remains

---

## Phase 8: Password Change Test (5 minutes)

### Step 1: Go to Profile
Click your name → "Profile"

### Step 2: Change Password
- Current Password: (empty for now - backend may not validate)
- New Password: `newpassword123`

Click Update

**Expected:**
- Success message appears
- You stay logged in

### Step 3: Logout
Click Logout

### Step 4: Login with New Password
Phone: `18888888888`
Password: `newpassword123`

**Expected:**
- Login successful
- Same account, same data

### Step 5: Try Old Password
Logout and try old password `test123`

**Expected:**
- Login fails
- Error message: "Invalid credentials"

---

## Phase 9: Admin Dashboard Test (Optional - 5 minutes)

### Step 1: Go to Admin
Open `http://localhost:5000/admin/login.html`

### Step 2: Login
Phone: `13800138000`
Password: `admin123`

**Expected:**
- Admin dashboard loads
- Shows statistics cards
- User and Order tables visible

### Step 3: Check Statistics
Dashboard should show:
- Total Users: 2 (admin + your test user)
- Active Orders: 1 (the order you created)
- Total Revenue: Your order total

### Step 4: View Users Table
Should see:
- Your test user (18888888888)
- Phone, username, created date

### Step 5: View Orders Table
Should see:
- Your order
- Order date, total, status

---

## Phase 10: Error Handling Test (5 minutes)

### Test 1: Wrong Password
Try login with:
- Phone: `18888888888`
- Password: `wrongpassword`

**Expected:**
- Error: "Invalid credentials"
- Stays on login page
- No crash or console errors

### Test 2: Unregistered Phone
Try login with:
- Phone: `12345678901`
- Password: `anything`

**Expected:**
- Error: "Invalid credentials"
- No crash

### Test 3: Stop Backend
In backend terminal: Press `Ctrl+C`

Try to add something to cart

**Expected:**
- Error message about API connection
- No crash
- Page stays usable (shows offline state)

Restart backend: `python run.py`

---

## Console Checks

During all tests, check browser console (`F12`):

**Should NOT see:**
- ❌ `Uncaught TypeError`
- ❌ `404 Not Found` (for API calls)
- ❌ `CORS error`
- ❌ `undefined is not a function`

**Should see:**
- ✅ `POST /api/auth/login 200`
- ✅ `GET /api/orders 200`
- ✅ Network tab shows successful requests

---

## Network Inspection

Open browser DevTools → Network tab

### Registration Request
- **Method:** POST
- **URL:** `/api/auth/register`
- **Status:** 200
- **Response:** Contains `access_token` and `user` data

### Login Request
- **Method:** POST
- **URL:** `/api/auth/login`
- **Status:** 200
- **Response:** Contains JWT token

### Create Order Request
- **Method:** POST
- **URL:** `/api/orders`
- **Status:** 200
- **Response:** Contains order ID and details

### Check Headers
Click on any API request → Headers tab:
- Should see `Authorization: Bearer {token}`
- Should see `Content-Type: application/json`

---

## Database Verification

### Check Users Table
```bash
# In MySQL client
SELECT id, username, phone, is_admin FROM user;
```

Expected output:
```
| id | username | phone | is_admin |
|----|----------|-------|----------|
| 1  | System Admin | NULL | 1 |
| 2  | TestUser | 18888888888 | 0 |
```

### Check Orders Table
```bash
SELECT id, user_id, total, status FROM order;
```

Expected output:
```
| id | user_id | total | status |
|----|---------|-------|--------|
| 1  | 2 | 150.50 | pending |
```

### Check Addresses Table
```bash
SELECT id, user_id, name, province FROM address;
```

---

## Success Criteria ✅

All tests pass if:

1. ✅ User can register with new phone number
2. ✅ User can login with registered credentials
3. ✅ User stays logged in after page refresh
4. ✅ User can add products and create orders
5. ✅ User can save and edit addresses
6. ✅ User can change password
7. ✅ Order history shows all orders
8. ✅ Admin can see users and orders
9. ✅ No console errors
10. ✅ Data persists in database (not mock storage)
11. ✅ JWT tokens work for authentication
12. ✅ Logout clears session properly

---

## Issues & Solutions

### Issue: "Cannot connect to backend"
**Solution:**
1. Check backend running: `python run.py`
2. Check URL in `.env.local`: `VITE_API_URL=http://localhost:5000/api`
3. Check frontend dev server not on port 5000

### Issue: "Login fails with valid credentials"
**Solution:**
1. Run `python init_db.py` again
2. Check .env has DATABASE_URL set
3. Check MySQL is running
4. Look at backend console for errors

### Issue: "Addresses not saving"
**Solution:**
1. Backend must be running
2. Must be logged in (JWT token exists)
3. Check browser console for 401 errors (token expired)

### Issue: "Order doesn't appear in history"
**Solution:**
1. Wait a moment (async operation)
2. Refresh page
3. Check backend logs for errors
4. Ensure address was selected before checkout

### Issue: "Cart shows old data after logout"
**Solution:**
This is expected! Different users have different carts. Clear browser cache or use incognito window.

---

## Next: Go Live Checklist

After all tests pass:

- [ ] Verify all 10 test phases completed
- [ ] Check admin dashboard works
- [ ] Database contains your test data
- [ ] No console errors
- [ ] API calls show in Network tab
- [ ] Ready to deploy to Aliyun

You're now ready to show real customers!
