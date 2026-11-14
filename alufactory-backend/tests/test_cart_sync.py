"""Cart sync replaces snapshots without multiplying explicit addition batches."""
import unittest
from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from sqlalchemy import event
from app.models.user import Cart, CartItem, User, db
from app.routes.cart import cart_bp


class CartSyncTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(TESTING=True,
            JWT_SECRET_KEY='cart-sync-test-secret-more-than-32-characters',
            SQLALCHEMY_DATABASE_URI='sqlite:///:memory:', SQLALCHEMY_TRACK_MODIFICATIONS=False)
        db.init_app(self.app)
        JWTManager(self.app)
        self.app.register_blueprint(cart_bp)
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        for user_id in ('customer-a', 'customer-b'):
            db.session.add(User(id=user_id, username=user_id, phone=user_id, password_hash='unused'))
        db.session.commit()
        self.client = self.app.test_client()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def headers(self, user_id='customer-a'):
        return {'Authorization': 'Bearer ' + create_access_token(identity=user_id)}

    def row(self, entry_id='add-a', quantity=2, added_at='2026-11-14T10:00:00.000Z'):
        return {
            'product_id': 'p2', 'product_name': '2020 型材', 'product_type': 'PROFILE',
            'quantity': quantity, 'unit_price': 10,
            'config': {'variantId': '2020', 'length': 800,
                'cartEntryId': entry_id, 'cartAddedAt': added_at,
                'holes': [{'side': 'A', 'type': 'through', 'positionMm': 20}]},
        }

    def sync(self, items, user_id='customer-a'):
        return self.client.put('/api/cart/sync', json={'items': items}, headers=self.headers(user_id))

    def test_repeated_sync_and_get_preserve_two_additions_without_doubling(self):
        rows = [self.row(), self.row('add-b', 3, '2026-11-14T11:00:00.000Z')]
        previous_ids = set()
        for _ in range(4):
            response = self.sync(rows)
            self.assertEqual(response.status_code, 200, response.get_json())
            saved = response.get_json()['cart']
            self.assertEqual(len(saved['items']), 2)
            self.assertEqual(saved['total_price'], 50)
            self.assertEqual(sum(item['quantity'] for item in saved['items']), 5)
            new_ids = {item['id'] for item in saved['items']}
            self.assertFalse(previous_ids & new_ids, 'Stable config identity must survive replacement DB IDs')
            previous_ids = new_ids
            by_entry = {item['config']['cartEntryId']: item for item in saved['items']}
            for original in rows:
                actual = by_entry[original['config']['cartEntryId']]
                self.assertEqual(actual['config'], original['config'])
                self.assertEqual(actual['quantity'], original['quantity'])
            fetched = self.client.get('/api/cart', headers=self.headers())
            self.assertEqual(fetched.status_code, 200)
            self.assertEqual(fetched.get_json(), saved)
        self.assertEqual(Cart.query.count(), 1)
        self.assertEqual(CartItem.query.count(), 2)

    def test_invalid_second_row_does_not_delete_existing_cart(self):
        self.assertEqual(self.sync([self.row()]).status_code, 200)
        before = self.client.get('/api/cart', headers=self.headers()).get_json()
        statements = []
        def record(_conn, _cursor, statement, _params, _context, _many):
            statements.append(statement)
        event.listen(db.engine, 'before_cursor_execute', record)
        try:
            for invalid in [None, {}, {'product_id': 'p2', 'quantity': 'bad'}]:
                response = self.sync([self.row('new-entry'), invalid])
                self.assertEqual(response.status_code, 400, response.get_json())
        finally:
            event.remove(db.engine, 'before_cursor_execute', record)
        self.assertFalse(any(sql.lstrip().upper().startswith('DELETE') for sql in statements))
        self.assertEqual(self.client.get('/api/cart', headers=self.headers()).get_json(), before)

    def test_users_are_isolated_and_clear_is_idempotent(self):
        self.assertEqual(self.sync([self.row()]).status_code, 200)
        self.assertEqual(self.sync([self.row('b-entry', 7)], 'customer-b').status_code, 200)
        for _ in range(2):
            response = self.sync([])
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json()['cart']['items'], [])
        other = self.client.get('/api/cart', headers=self.headers('customer-b')).get_json()
        self.assertEqual(other['items'][0]['quantity'], 7)
        self.assertEqual(other['items'][0]['config']['cartEntryId'], 'b-entry')
        self.assertEqual(self.client.put('/api/cart/sync', json={'items': []}).status_code, 401)
