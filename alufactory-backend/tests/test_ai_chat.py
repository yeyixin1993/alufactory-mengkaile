import json
import unittest
from unittest.mock import patch, Mock
from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from app.models.user import db, User
from app.ai_models import AIAccount, AISettings, AILedger, AIRecharge, SCALE
from app.routes.ai_chat import ai_bp, quote_profile

SPEC = dict(model='2020', color='pink', length=1000, quantity=2, province='广东', section='colored', tapping='both', unsupported=False)

class AIChatTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(TESTING=True, SECRET_KEY='test-secret', JWT_SECRET_KEY='test-jwt-secret-at-least-32-characters', SQLALCHEMY_DATABASE_URI='sqlite:///:memory:')
        db.init_app(self.app)
        JWTManager(self.app)
        self.app.register_blueprint(ai_bp)
        self.ctx = self.app.app_context(); self.ctx.push(); db.create_all()
        for uid, level in [('vip', 'vip'), ('standard', 'standard'), ('admin', 'standard')]:
            db.session.add(User(id=uid, username=uid, phone=uid, password_hash='x', membership_level=level, is_admin=uid=='admin'))
        db.session.add(AISettings(id=1, enabled=True, markup_bps=1000)); db.session.commit()
        self.client = self.app.test_client()
        self.env = patch.dict('os.environ', {'AI_PROVIDER': 'qwen', 'DASHSCOPE_API_KEY': 'test', 'AI_QWEN_BASE_URL': 'https://example.test/v1'})
        self.env.start()

    def tearDown(self):
        self.env.stop(); db.session.remove(); db.drop_all(); self.ctx.pop()

    def headers(self, user='vip'):
        return {'Authorization': 'Bearer '+create_access_token(identity=user)}

    def status(self, user='vip', token=''):
        return self.client.post('/api/ai/status', json={'visitor_token': token}, headers=self.headers(user) if user else {})

    def chat(self, user='vip', index=1, token=''):
        return self.client.post('/api/ai/chat', headers=self.headers(user) if user else {}, json={'visitor_token': token, 'message': '2020粉色两根', 'request_id': f'00000000-0000-4000-8000-{index:012d}'})

    def test_grant_and_upgrade_once(self):
        self.assertEqual(self.status().json['balance_cny'], 10)
        self.assertEqual(self.status().json['balance_cny'], 10)
        db.session.get(User, 'vip').membership_level='vip_plus'; db.session.commit()
        self.assertEqual(self.status().json['balance_cny'], 100)
        db.session.get(User, 'vip').membership_level='vip'; db.session.commit()
        self.assertEqual(self.status().json['balance_cny'], 100)

    @patch('app.routes.ai_chat.provider_extract', return_value=(json.dumps(SPEC), 100000, {'prompt_tokens':3000,'completion_tokens':500}))
    def test_cost_markup_and_retry(self, provider):
        first=self.chat(); self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json['charged_cny'], .0011)
        self.assertEqual(self.chat().json, first.json)
        self.assertEqual(provider.call_count, 1)
        self.assertAlmostEqual(self.status().json['balance_cny'], 9.9989)
        self.assertEqual(AILedger.query.filter_by(kind='usage').count(), 1)

    @patch('app.routes.ai_chat.provider_extract', return_value=(json.dumps(SPEC), 100000, {}))
    def test_three_message_trial_and_carryover(self, _):
        token=self.status(None).json['visitor_token']
        self.assertEqual(self.chat(None, 1, token).status_code, 200)
        self.assertEqual(self.status('standard', token).json['trial_remaining'], 2)
        self.assertEqual(self.status(None, token).status_code, 400)
        for i in (2,3): self.assertEqual(self.chat('standard', i).status_code, 200)
        self.assertEqual(self.chat('standard', 4).status_code, 409)

    @patch('app.routes.ai_chat.provider_extract', side_effect=TimeoutError())
    def test_timeout_not_charged(self, _):
        self.chat()
        self.assertEqual(self.status().json['balance_cny'], 10)
        self.assertIsNone(db.session.get(AIAccount, 'u:vip').busy)

    def test_no_key_or_disabled_does_not_use_trial(self):
        with patch.dict('os.environ', {'AI_PROVIDER': 'qwen', 'DASHSCOPE_API_KEY': ''}):
            self.assertEqual(self.chat('standard').status_code,503)
        self.assertEqual(self.status('standard').json['trial_remaining'],3)

    def test_admin_only_adjustment_and_idempotency(self):
        self.status()
        payload={'operation_id':'00000000-0000-4000-8000-000000000001','delta_cny':'100','reason':'微信交易123','enabled':True,'trial_limit':3}
        self.assertEqual(self.client.post('/api/ai/admin/users/vip', json=payload, headers=self.headers()).status_code,403)
        self.assertEqual(self.client.post('/api/ai/admin/users/vip', json=payload, headers=self.headers('admin')).status_code,200)
        self.assertEqual(self.client.post('/api/ai/admin/users/vip', json=payload, headers=self.headers('admin')).status_code,409)
        self.assertEqual(self.status().json['balance_cny'],110)
        payload.update(operation_id='00000000-0000-4000-8000-000000000002',delta_cny='-111')
        self.assertEqual(self.client.post('/api/ai/admin/users/vip', json=payload, headers=self.headers('admin')).status_code,409)

    def test_pending_blocks_parallel_requests(self):
        self.status(); db.session.get(AIAccount,'u:vip').busy='running'; db.session.commit()
        self.assertEqual(self.chat().status_code,409)

    def test_quote_clarifies_and_calculates(self):
        reply, result=quote_profile({},'standard')
        self.assertIsNone(result); self.assertIn('哪个省',reply)
        reply, result=quote_profile(SPEC,'vip')
        self.assertIsNotNone(result)
        self.assertEqual(result['unit_price'],25)
        self.assertEqual(result['subtotal'],50)
        self.assertGreater(result['shipping_fee'],0)
        self.assertIsNone(quote_profile({**SPEC,'length':3001},'vip')[1])
        self.assertIsNone(quote_profile({**SPEC,'unsupported':True},'vip')[1])

    def test_only_ask_finish_when_catalog_offers_a_choice(self):
        reply, result = quote_profile({**SPEC, 'section': None}, 'vip')
        self.assertIsNotNone(result)
        self.assertEqual(result['spec']['section'], 'colored')
        self.assertIn('彩色截面', reply)
        reply, result = quote_profile({**SPEC, 'color': 'black', 'section': None}, 'vip')
        self.assertIsNone(result)
        self.assertIn('本色还是彩色', reply)
        reply, result = quote_profile({**SPEC, 'color': 'natural', 'section': None}, 'vip')
        self.assertIsNotNone(result)
        self.assertIn('本色截面', reply)

    @patch('app.routes.ai_chat.provider_extract', return_value=('not-json', 100000, {}))
    def test_invalid_output_not_billed(self, _):
        response = self.chat()
        self.assertEqual(response.json['charged_cny'], 0)
        self.assertEqual(self.status().json['balance_cny'], 10)

    @patch('app.routes.ai_chat.urllib.request.urlopen')
    def test_provider_usage_with_implicit_cache(self, upstream):
        from app.routes.ai_chat import provider_extract
        payload = {'usage': {'prompt_tokens': 3000, 'completion_tokens': 500, 'prompt_tokens_details': {'cached_tokens': 2000}}, 'choices': [{'message': {'content': json.dumps(SPEC)}}]}
        upstream.return_value.__enter__.return_value.read.return_value=json.dumps(payload).encode()
        content, cost, usage = provider_extract([], '2020粉色')
        self.assertEqual(cost, 68000)
        payload['usage']['prompt_tokens'] = 32001
        upstream.return_value.__enter__.return_value.read.return_value=json.dumps(payload).encode()
        with self.assertRaises(RuntimeError): provider_extract([], '2020')

    @patch('app.routes.ai_chat.provider_extract', return_value=(json.dumps(SPEC), 100000, {}))
    def test_new_consultation_does_not_restore_old_messages(self, _):
        self.chat(index=1)
        self.client.post('/api/ai/reset', json={}, headers=self.headers())
        self.assertEqual(self.status().json['history'], [])
        self.chat(index=2)
        self.assertEqual(len(self.status().json['history']), 2)

    @patch('app.routes.payments._build_alipay_client')
    @patch('app.routes.ai_chat.get_payment_settings', return_value={'alipay':{'app_id':'merchant'}})
    def test_alipay_amount_signature_and_duplicate(self, settings, builder):
        self.status(); db.session.add(AIRecharge(id='AItest',account_id='u:vip',amount_fen=10000)); db.session.commit()
        client=Mock();client.verify.return_value=True;builder.return_value=(client,None)
        data={'sign':'valid','out_trade_no':'AItest','app_id':'merchant','total_amount':'100.00','trade_no':'trade-1','trade_status':'TRADE_SUCCESS'}
        endpoint='/api/ai/recharge/alipay/notify'
        self.assertEqual(self.client.post(endpoint,data={**data,'total_amount':'1.00'}).text,'failure')
        self.assertEqual(self.client.post(endpoint,data={**data,'app_id':'other'}).text,'failure')
        client.verify.return_value=False
        self.assertEqual(self.client.post(endpoint,data=data).text,'failure')
        client.verify.return_value=True
        for _ in range(2):self.assertEqual(self.client.post(endpoint,data=data).text,'success')
        self.assertEqual(self.status().json['balance_cny'],110)
        self.assertEqual(AILedger.query.filter_by(kind='recharge').count(),1)
        self.assertEqual(self.client.post(endpoint,data={**data,'trade_no':'different'}).text,'failure')

if __name__ == '__main__':unittest.main()
