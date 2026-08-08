import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app
from app.models.user import Order, User, db


class OrderDeletionAndDuplicateTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app('testing')
        self.client = self.app.test_client()
        registration = self.client.post('/api/auth/register', json={
            'username': 'delete-test-user',
            'phone': '13900000001',
            'password': 'test-password',
        })
        self.assertEqual(registration.status_code, 201, registration.get_json())
        payload = registration.get_json()
        self.token = payload['access_token']
        self.user_id = payload['user']['id']
        self.headers = {'Authorization': f'Bearer {self.token}'}

    def tearDown(self):
        with self.app.app_context():
            db.session.remove()
            db.drop_all()

    def _order_payload(self):
        return {
            'items': [{
                'product_id': '2020',
                'product_name': '2020',
                'product_type': 'profile',
                'quantity': 2,
                'unit_price': 10,
                'total_price': 20,
                'config': {'length': 500, 'color': 'natural'},
            }],
            'recipient_name': '测试客户',
            'phone': '13900000001',
            'province': '上海',
            'address_detail': '测试地址1号',
            'subtotal': 20,
            'shipping_fee': 8,
            'total_amount': 28,
            'shipping_method': 'standard',
        }

    def test_address_delete_order_status_guard_json_and_duplicate_warning(self):
        address = self.client.post(
            f'/api/users/{self.user_id}/addresses',
            headers=self.headers,
            json={
                'recipient_name': '测试客户',
                'phone': '13900000001',
                'province': '上海',
                'detail': '测试地址1号',
            },
        )
        self.assertEqual(address.status_code, 201, address.get_json())
        address_id = address.get_json()['address']['id']
        deleted_address = self.client.delete(f'/api/users/addresses/{address_id}', headers=self.headers)
        self.assertEqual(deleted_address.status_code, 200, deleted_address.get_json())

        first = self.client.post('/api/orders', headers=self.headers, json=self._order_payload())
        second = self.client.post('/api/orders', headers=self.headers, json=self._order_payload())
        self.assertEqual(first.status_code, 201, first.get_json())
        self.assertEqual(second.status_code, 201, second.get_json())
        first_order = first.get_json()['order']
        second_order = second.get_json()['order']
        with self.app.app_context():
            first_stored = Order.query.get(first_order['id'])
            second_stored = Order.query.get(second_order['id'])
            self.assertTrue(first_stored.order_json)
            self.assertEqual(first_stored.duplicate_fingerprint, second_stored.duplicate_fingerprint)

        with self.app.app_context():
            user = User.query.get(self.user_id)
            user.is_admin = True
            db.session.commit()

        admin_orders = self.client.get('/api/admin/orders', headers=self.headers)
        self.assertEqual(admin_orders.status_code, 200, admin_orders.get_json())
        duplicate_rows = [entry for entry in admin_orders.get_json()['orders'] if entry['is_duplicate']]
        self.assertEqual(len(duplicate_rows), 2)
        self.assertTrue(all(entry['duplicate_count'] == 2 for entry in duplicate_rows))

        with self.app.app_context():
            protected_order = Order.query.get(first_order['id'])
            protected_order.status = 'confirmed'
            db.session.commit()

        protected_delete = self.client.delete(
            f"/api/orders/{first_order['id']}",
            headers=self.headers,
        )
        self.assertEqual(protected_delete.status_code, 409, protected_delete.get_json())

        with self.app.app_context():
            cancellable_order = Order.query.get(first_order['id'])
            cancellable_order.status = 'cancelled'
            db.session.commit()

        cancelled_delete = self.client.delete(
            f"/api/orders/{first_order['id']}",
            headers=self.headers,
        )
        self.assertEqual(cancelled_delete.status_code, 200, cancelled_delete.get_json())

        pending_delete = self.client.delete(
            f"/api/orders/{second_order['id']}",
            headers=self.headers,
        )
        self.assertEqual(pending_delete.status_code, 200, pending_delete.get_json())


if __name__ == '__main__':
    unittest.main()
