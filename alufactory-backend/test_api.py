#!/usr/bin/env python
"""
Simple test script to verify the backend is working correctly
"""
import requests
import json
from time import sleep

BASE_URL = "http://localhost:5000"

print("=" * 60)
print("Alufactory Backend Test Suite")
print("=" * 60)

# Test 1: Health check
print("\n1. Testing health endpoint...")
try:
    resp = requests.get(f"{BASE_URL}/api/health")
    if resp.status_code == 200:
        print(f"   ✓ Health check passed: {resp.json()}")
    else:
        print(f"   ✗ Health check failed: {resp.status_code}")
except Exception as e:
    print(f"   ✗ Cannot reach server: {e}")
    exit(1)

# Test 2: Login with test account
print("\n2. Testing login...")
login_data = {
    "phone": "19821200413",
    "password": "123456"
}
try:
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    if resp.status_code == 200:
        data = resp.json()
        token = data.get('access_token')
        user = data.get('user')
        print(f"   ✓ Login successful!")
        print(f"     User: {user['username']} ({user['phone']})")
        print(f"     Token: {token[:50]}...")
    else:
        print(f"   ✗ Login failed: {resp.status_code}")
        print(f"     Response: {resp.text}")
except Exception as e:
    print(f"   ✗ Error: {e}")

# Test 3: Create profile
print("\n3. Testing profile creation...")
if 'token' in locals():
    headers = {"Authorization": f"Bearer {token}"}
    profile_data = {
        "profile_name": "Test Profile",
        "profile_data": {
            "material": "aluminum",
            "thickness": 2.0,
            "width": 1000,
            "height": 500
        },
        "address": {
            "recipient_name": "John Doe",
            "phone": "18888888888",
            "province": "Shanghai",
            "detail": "123 Main Street, Building A, Room 100"
        },
        "pdf_base64": "JVBERi0xLjQKJeLjz9MNCjEgMCBvYmogICUgZW50cnkgcG9pbnQNCjw8L1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDIgMCBSPj4Kc3RhcnR4cmVmDQ"
    }
    try:
        resp = requests.post(f"{BASE_URL}/api/profiles", json=profile_data, headers=headers)
        if resp.status_code == 201:
            data = resp.json()
            profile_id = data.get('profile').get('id')
            print(f"   ✓ Profile created!")
            print(f"     Profile ID: {profile_id}")
        else:
            print(f"   ✗ Profile creation failed: {resp.status_code}")
            print(f"     Response: {resp.text}")
    except Exception as e:
        print(f"   ✗ Error: {e}")

# Test 4: Get profile
print("\n4. Testing profile retrieval...")
if 'token' in locals() and 'profile_id' in locals():
    try:
        resp = requests.get(f"{BASE_URL}/api/profiles/{profile_id}", headers=headers)
        if resp.status_code == 200:
            data = resp.json()
            profile = data.get('profile')
            print(f"   ✓ Profile retrieved!")
            print(f"     Name: {profile['profile_name']}")
            print(f"     Address: {profile['address']['province']}")
        else:
            print(f"   ✗ Profile retrieval failed: {resp.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")

# Test 5: Admin login
print("\n5. Testing admin login...")
admin_login_data = {
    "phone": "13916813579",
    "password": "admin"
}
try:
    resp = requests.post(f"{BASE_URL}/api/auth/login", json=admin_login_data)
    if resp.status_code == 200:
        data = resp.json()
        admin_token = data.get('access_token')
        admin_user = data.get('user')
        print(f"   ✓ Admin login successful!")
        print(f"     User: {admin_user['username']} ({admin_user['phone']})")
        print(f"     Is Admin: {admin_user['is_admin']}")
    else:
        print(f"   ✗ Admin login failed: {resp.status_code}")
except Exception as e:
    print(f"   ✗ Error: {e}")

# Test 6: Admin get profiles
print("\n6. Testing admin profile listing...")
if 'admin_token' in locals():
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    try:
        resp = requests.get(f"{BASE_URL}/api/admin/profiles", headers=admin_headers)
        if resp.status_code == 200:
            data = resp.json()
            profiles = data.get('profiles', [])
            print(f"   ✓ Admin profiles retrieved!")
            print(f"     Total profiles: {data['total']}")
            if profiles:
                print(f"     First profile: {profiles[0]['profile_name']} by {profiles[0]['user']['username']}")
        else:
            print(f"   ✗ Failed to get profiles: {resp.status_code}")
    except Exception as e:
        print(f"   ✗ Error: {e}")

# Test 7: Admin dashboard
print("\n7. Testing admin dashboard access...")
try:
    resp = requests.get(f"{BASE_URL}/admin/index.html")
    if resp.status_code == 200:
        print(f"   ✓ Admin dashboard is accessible!")
        print(f"     Response size: {len(resp.text)} bytes")
    else:
        print(f"   ✗ Admin dashboard not found: {resp.status_code}")
except Exception as e:
    print(f"   ✗ Error: {e}")

print("\n" + "=" * 60)
print("Test suite completed!")
print("=" * 60)
print("\nAccess admin dashboard at:")
print(f"  http://localhost:5000/admin/index.html")
print("\nTest accounts:")
print(f"  User: phone=19821200413, password=123456")
print(f"  Admin: phone=13916813579, password=admin")
