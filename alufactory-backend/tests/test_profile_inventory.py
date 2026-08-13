from io import BytesIO

from app import create_app
from datetime import datetime

from app.models.user import Order, OrderItem, ProfileInventory, User, db
from app.profile_inventory import ALLOWED_BAR_LENGTHS, build_inventory_xlsx


def _admin_headers(client):
    admin = User(username='inventory-admin', phone='13800000001', is_admin=True)
    admin.set_password('admin')
    db.session.add(admin)
    db.session.commit()
    response = client.post('/api/auth/login', json={'phone': admin.phone, 'password': 'admin'})
    token = response.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}


def test_profile_inventory_roundtrip_and_public_meters():
    app = create_app('testing')
    with app.app_context():
        client = app.test_client()
        headers = _admin_headers(client)

        admin_rows = client.get('/api/admin/profile-inventory', headers=headers)
        assert admin_rows.status_code == 200
        inventory = admin_rows.get_json()['inventory']
        assert ALLOWED_BAR_LENGTHS == (3.15,)
        assert {item['bar_length_m'] for item in inventory} == {3.15}
        assert 'raw_material' in admin_rows.get_json()['color_names']
        row = next(item for item in inventory if item['variant_id'] == '2020' and item['color_id'] == 'red' and item['bar_length_m'] == 3.15)

        updated = client.put(
            f"/api/admin/profile-inventory/{row['id']}",
            headers=headers,
            json={'bar_count': 4},
        )
        assert updated.status_code == 200
        assert updated.get_json()['inventory']['total_meters'] == 12.6

        public = client.get('/api/profiles/inventory')
        assert public.status_code == 200
        total = next(item for item in public.get_json()['inventory'] if item['variant_id'] == '2020' and item['color_id'] == 'red')
        assert total['total_meters'] == 12.6
        assert all(item['color_id'] != 'raw_material' for item in public.get_json()['inventory'])

        raw_row = next(item for item in inventory if item['variant_id'] == '2020' and item['color_id'] == 'raw_material')
        raw_updated = client.put(
            f"/api/admin/profile-inventory/{raw_row['id']}",
            headers=headers,
            json={'bar_count': 5},
        )
        assert raw_updated.status_code == 200
        public_after_raw_update = client.get('/api/profiles/inventory').get_json()['inventory']
        assert all(item['color_id'] != 'raw_material' for item in public_after_raw_update)

        exported = client.get('/api/admin/profile-inventory/export', headers=headers)
        assert exported.status_code == 200
        assert exported.data[:2] == b'PK'

        source_rows = ProfileInventory.query.order_by(ProfileInventory.id.asc()).all()
        red_row = next(item for item in source_rows if item.variant_id == '2020' and item.color_id == 'red' and item.bar_length_m == 3.15)
        red_row.bar_count = 9
        workbook = build_inventory_xlsx(source_rows)
        imported = client.post(
            '/api/admin/profile-inventory/import',
            headers=headers,
            data={'file': (BytesIO(workbook.read()), '库存.xlsx')},
            content_type='multipart/form-data',
        )
        assert imported.status_code == 200
        db.session.expire_all()
        assert ProfileInventory.query.get(red_row.id).bar_count == 9


def test_dashboard_monthly_revenue_and_top_colored_profile_meters():
    app = create_app('testing')
    with app.app_context():
        client = app.test_client()
        headers = _admin_headers(client)
        customer = User(username='inventory-customer', phone='13800000002')
        customer.set_password('customer')
        db.session.add(customer)
        db.session.flush()

        paid_order = Order(
            order_number='INVENTORY-PAID',
            user_id=customer.id,
            recipient_name='测试客户',
            phone=customer.phone,
            province='上海',
            address_detail='测试地址',
            total_amount=320,
            status='confirmed',
            paid_at=datetime(2026, 7, 15, 10, 0, 0),
        )
        pending_order = Order(
            order_number='INVENTORY-PENDING',
            user_id=customer.id,
            recipient_name='测试客户',
            phone=customer.phone,
            province='上海',
            address_detail='测试地址',
            total_amount=999,
            status='pending',
            created_at=datetime(2026, 7, 16, 10, 0, 0),
        )
        db.session.add_all([paid_order, pending_order])
        db.session.flush()
        db.session.add_all([
            OrderItem(
                order_id=paid_order.id,
                product_id='2020',
                product_name='2020 型材',
                product_type='PROFILE',
                quantity=3,
                unit_price=20,
                total_price=60,
                config={'variantId': '2020', 'colorId': 'red', 'length': 1200},
            ),
            OrderItem(
                order_id=paid_order.id,
                product_id='2020',
                product_name='2020 型材',
                product_type='PROFILE',
                quantity=4,
                unit_price=16,
                total_price=64,
                config={'variantId': '2020', 'colorId': 'natural', 'length': 1000},
            ),
            OrderItem(
                order_id=pending_order.id,
                product_id='2020',
                product_name='2020 型材',
                product_type='PROFILE',
                quantity=99,
                unit_price=20,
                total_price=1980,
                config={'variantId': '2020', 'colorId': 'black', 'length': 3000},
            ),
        ])
        db.session.commit()

        response = client.get('/api/admin/statistics', headers=headers)
        assert response.status_code == 200
        statistics = response.get_json()
        assert statistics['monthly_revenue'] == [{'month': '2026-07', 'revenue': 320.0}]
        assert statistics['top_profile_colors'] == [
            {'color_id': 'red', 'color_name': '中国红', 'meters': 3.6},
        ]
