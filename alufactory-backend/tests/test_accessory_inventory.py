from io import BytesIO

from app import create_app
from app.accessory_inventory import ACCESSORY_COLORS, build_accessory_inventory_xlsx
from app.models.user import AccessoryInventory, User, db


def _admin_headers(client):
    admin = User(username='accessory-inventory-admin', phone='13800000011', is_admin=True)
    admin.set_password('admin')
    db.session.add(admin)
    db.session.commit()
    response = client.post('/api/auth/login', json={'phone': admin.phone, 'password': 'admin'})
    return {'Authorization': f"Bearer {response.get_json()['access_token']}"}


def test_accessory_inventory_admin_public_and_xlsx_roundtrip():
    app = create_app('testing')
    with app.app_context():
        client = app.test_client()
        headers = _admin_headers(client)

        admin_response = client.get('/api/admin/accessory-inventory', headers=headers)
        assert admin_response.status_code == 200
        payload = admin_response.get_json()
        inventory = payload['inventory']
        assert payload['color_names'] == ACCESSORY_COLORS
        assert any(row['accessory_id'] == 'end_cap_2020' and row['profile_size'] == '2020' for row in inventory)
        assert any(row['accessory_id'] == 'end_cap_3030' and row['profile_size'] == '3030' for row in inventory)

        row = next(
            item for item in inventory
            if item['accessory_id'] == '1' and item['profile_size'] == '2020' and item['color_id'] == 'red'
        )
        updated = client.put(
            f"/api/admin/accessory-inventory/{row['id']}",
            headers=headers,
            json={'quantity': 37},
        )
        assert updated.status_code == 200
        assert updated.get_json()['inventory']['quantity'] == 37

        public = client.get('/api/accessories/inventory')
        assert public.status_code == 200
        public_row = next(
            item for item in public.get_json()['inventory']
            if item['accessory_id'] == '1' and item['profile_size'] == '2020' and item['color_id'] == 'red'
        )
        assert public_row['quantity'] == 37

        exported = client.get('/api/admin/accessory-inventory/export', headers=headers)
        assert exported.status_code == 200
        assert exported.data[:2] == b'PK'

        source_rows = AccessoryInventory.query.order_by(AccessoryInventory.id.asc()).all()
        database_row = next(item for item in source_rows if item.id == row['id'])
        database_row.quantity = 48
        workbook = build_accessory_inventory_xlsx(source_rows)
        imported = client.post(
            '/api/admin/accessory-inventory/import',
            headers=headers,
            data={'file': (BytesIO(workbook.read()), '配件库存.xlsx')},
            content_type='multipart/form-data',
        )
        assert imported.status_code == 200
        db.session.expire_all()
        assert AccessoryInventory.query.get(row['id']).quantity == 48


def test_accessory_inventory_admin_requires_admin():
    app = create_app('testing')
    with app.app_context():
        client = app.test_client()
        customer = User(username='accessory-customer', phone='13800000012')
        customer.set_password('customer')
        db.session.add(customer)
        db.session.commit()
        login = client.post('/api/auth/login', json={'phone': customer.phone, 'password': 'customer'})
        headers = {'Authorization': f"Bearer {login.get_json()['access_token']}"}
        assert client.get('/api/admin/accessory-inventory', headers=headers).status_code == 403
