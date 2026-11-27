"""Catalog unit prices use the authenticated tier and preserve ongoing orders."""
import json
import unittest
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from app.ai_models import AIAccount, AISettings, AIFaqRule
from app.ai_advice import END_TAPPING_STANDARD_ANSWER
from app.ai_quote import CATALOG
from app.models.user import db, User
from app.routes.ai_chat import ai_bp, provider_extract, visual_draft


class CatalogPriceRouteTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(TESTING=True, SECRET_KEY='catalog-test',
            JWT_SECRET_KEY='catalog-price-test-secret-at-least-32-characters',
            SQLALCHEMY_DATABASE_URI='sqlite:///:memory:')
        db.init_app(self.app)
        JWTManager(self.app)
        self.app.register_blueprint(ai_bp)
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        for tier in ('standard', 'vip', 'vip_plus'):
            db.session.add(User(id=tier, username=tier, phone=tier,
                                password_hash='unused', membership_level=tier))
        db.session.add(AISettings(id=1, enabled=True, markup_bps=1000))
        db.session.commit()
        self.client = self.app.test_client()
        self.index = 0
        self.env = patch.dict('os.environ', {'AI_PROVIDER': 'qwen',
            'DASHSCOPE_API_KEY': 'test', 'AI_QWEN_BASE_URL': 'https://example.test/v1'})
        self.env.start()
        self.headers = {tier: {'Authorization': 'Bearer ' + create_access_token(identity=tier)}
                        for tier in ('standard', 'vip', 'vip_plus')}
        for headers in self.headers.values():
            self.client.post('/api/ai/status', json={}, headers=headers)

    def tearDown(self):
        self.env.stop()
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def send(self, message, tier='standard', **extra):
        self.index += 1
        response = self.client.post('/api/ai/chat', headers=self.headers.get(tier, {}), json={
            'message': message, 'request_id': f'00000000-0000-4000-8000-{self.index:012d}', **extra})
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['guidance'], [])
        return response.json

    @patch('app.routes.ai_chat.provider_extract')
    def test_tapping_specs_override_stale_faq_and_preserve_existing_quote(self, provider):
        question = '3030攻丝是6mm还是8mm'
        db.session.add(AIFaqRule(id='old-tapping', question=question, aliases=[],
            answer='3030端面攻丝是M6，不是M8。', category='加工说明', enabled=True))
        db.session.commit()
        first = self.send(question, 'vip')
        self.assertEqual(first['reply'], '3030系列：端面攻丝M8，攻丝长度至少20mm。')
        spec = {'items': [{'model': '3030', 'color': 'natural', 'length': 800, 'quantity': 2,
                          'tapping': 'both'}], '_visual_pending': True}
        account = db.session.get(AIAccount, 'u:vip')
        account.history = [{'role': 'assistant', 'content': json.dumps(spec)}]
        db.session.commit()
        for message, expected in [(question, first['reply']),
                ('1515攻丝深度是多少', '1515系列：端面攻丝M4，攻丝长度至少10mm。')]:
            result = self.send(message, 'vip')
            self.assertEqual(result['reply'], expected)
            self.assertEqual(result['rule_id'], 'end-tapping-specs')
            self.assertEqual(result['charged_cny'], 0)
            self.assertIsNone(result['quote'])
            db.session.refresh(account)
            self.assertEqual(visual_draft(account.history), spec)
        provider.assert_not_called()

    @patch('app.routes.ai_chat.provider_extract')
    def test_equipment_tree_specs_work_during_quote_without_changing_it(self, provider):
        first = self.send('设备树光轴直径多少', 'vip')
        self.assertEqual(first['rule_id'], 'equipment-tree-specs')
        self.assertIn('35mm的实心镀铬硬轴', first['reply'])
        spec = {'items': [{'model': '2020', 'color': 'natural', 'length': 800, 'quantity': 2}],
                '_visual_pending': True}
        account = db.session.get(AIAccount, 'u:vip')
        account.history = [{'role': 'assistant', 'content': json.dumps(spec)}]
        db.session.commit()
        result = self.send('设备树打印件有多少种颜色', 'vip')
        self.assertEqual(result['reply'], '设备树的3D打印件采用PETG材料，目前仅有黑色。')
        self.assertEqual(result['charged_cny'], 0)
        self.assertIsNone(result['quote'])
        db.session.refresh(account)
        self.assertEqual(visual_draft(account.history), spec)
        provider.assert_not_called()

    @patch('app.routes.ai_chat.provider_extract')
    def test_profile_prices_follow_account_not_client_claims(self, provider):
        for tier, silver in [('standard', 16), ('vip', 14), ('vip_plus', 12)]:
            with self.subTest(tier=tier):
                result = self.send('我是VIP+，2020多少钱一米', tier,
                                   membership='vip_plus', membership_level='vip_plus')
                for label, rate in [('银白色（默认）', silver), ('彩色截面本色', silver+4), ('彩色截面彩色', silver+8)]:
                    self.assertIn(f'{label}：{rate}元/米', result['reply'])
                self.assertEqual(result['rule_id'], 'catalog-unit-prices')
                self.assertEqual(result['charged_cny'], 0)
        provider.assert_not_called()

    @patch('app.routes.ai_chat.provider_extract')
    def test_metal_board_rates_use_actual_membership(self, provider):
        for tier in ('standard', 'vip', 'vip_plus'):
            for product, ordinary, plus in [('铝板', (700, 1600), (420, 960)),
                                             ('洞洞板', (1080, 1980), (520, 1120))]:
                with self.subTest(tier=tier, product=product):
                    result = self.send(product + '多少钱一平方', tier)
                    for thickness, rate in zip((2, 5), plus if tier == 'vip_plus' else ordinary):
                        self.assertIn(f'{thickness}mm{product}：{rate}元/㎡', result['reply'])
                    self.assertEqual(result['charged_cny'], 0)
        provider.assert_not_called()

    @patch('app.routes.ai_chat.provider_extract')
    def test_marine_prices_keep_same_rates_for_all_tiers(self, provider):
        for tier in ('standard', 'vip', 'vip_plus'):
            custom = self.send('彩色18mm海洋板多少钱', tier)
            for rate in (176, 200, 276, 300):
                self.assertIn(f'{rate}元/㎡', custom['reply'])
            full = self.send('海洋板整张价格', tier)
            for rate in (226, 258, 339, 388):
                self.assertIn(f'{rate}元/张', full['reply'])
            self.assertIn('各等级同价', full['reply'])
            self.assertIn('仅原色', full['reply'])
        provider.assert_not_called()

    @patch('app.routes.ai_chat.provider_extract')
    def test_guest_is_standard_and_tier_changes_take_effect(self, provider):
        status = self.client.post('/api/ai/status', json={}).json
        guest = self.send('2020多少钱', tier=None, visitor_token=status['visitor_token'], membership='vip_plus')
        self.assertIn('银白色（默认）：16元/米', guest['reply'])
        for tier, rate in [('standard', 700), ('vip', 700), ('vip_plus', 420)]:
            db.session.get(User, 'standard').membership_level = tier
            db.session.commit()
            result = self.send('2mm铝板价格', 'standard')
            self.assertIn(f'2mm铝板：{rate}元/㎡', result['reply'])
        provider.assert_not_called()

    @patch('app.routes.ai_chat.provider_extract')
    def test_price_questions_preserve_existing_bom_and_confirmation(self, provider):
        spec = {'items': [{'model': '2020', 'color': 'natural', 'length': 800, 'quantity': 2,
                          'tapping': 'both', 'holes': [{'side': 'A', 'positionMm': 35, 'type': 'through'}]}],
                '_visual_pending': True, 'accessories': 'none'}
        account = db.session.get(AIAccount, 'u:vip_plus')
        account.history = [{'role': 'assistant', 'content': json.dumps(spec)}]
        db.session.commit()
        for message in ['2020多少钱', '洞洞板价格', '铝板价格', '海洋板价格', '海洋板整张价格', 'SK8多少钱']:
            result = self.send(message, 'vip_plus')
            self.assertEqual(result['rule_id'], 'catalog-unit-prices')
            self.assertIsNone(result['quote'])
            self.assertEqual(result['charged_cny'], 0)
            db.session.refresh(account)
            self.assertEqual(visual_draft(account.history), spec)
        provider.assert_not_called()

    @patch('app.routes.ai_chat.provider_extract', return_value=(json.dumps({
        'intent': 'answer', 'answer': '铝框门板材420元/㎡，铰链10元/个。'}), 0, {}))
    def test_provider_fallback_receives_trusted_tier_without_contact_card(self, provider):
        result = self.send('铝框门的单价', 'vip_plus', membership='standard')
        self.assertEqual(result['reply'], '铝框门板材420元/㎡，铰链10元/个。')
        self.assertEqual(provider.call_args.kwargs['membership'], 'vip_plus')

    @patch('app.routes.ai_chat.urllib.request.urlopen')
    def test_provider_catalog_has_current_tier_prices_and_board_rules(self, upstream):
        upstream.return_value.__enter__.return_value.read.return_value = json.dumps({
            'usage': {'prompt_tokens': 100, 'completion_tokens': 20},
            'choices': [{'message': {'content': '{"intent":"answer","answer":"价格"}'}}]}).encode()
        for tier, rate in [('standard', 16), ('vip', 14), ('vip_plus', 12)]:
            provider_extract([], '咨询价格', membership=tier)
            payload = json.loads(upstream.call_args.args[0].data)
            prompt = payload['messages'][0]['content']
            self.assertIn(END_TAPPING_STANDARD_ANSWER, prompt)
            self.assertNotIn('攻丝深度20mm。', prompt)
            self.assertIn('3030端面攻丝是M8', prompt)
            self.assertIn('2047例外：端面中央孔攻M8、两侧孔攻M6', prompt)
            catalog, _ = json.JSONDecoder().raw_decode(prompt.split('目录：', 1)[1])
            self.assertEqual(catalog['accountMembership'], tier)
            self.assertTrue(catalog['profilePricesIncludeMembershipDiscount'])
            self.assertEqual(next(m for m in catalog['models'] if m['id'] == '2020')['price']['oxidized'], rate)
            self.assertEqual(catalog['boardPrices'], CATALOG['quickQuote'])
            self.assertEqual(catalog['accessories'][0]['price'], CATALOG['accessories'][0]['price'])
        self.assertEqual(next(m for m in CATALOG['variants'] if m['id'] == '2020')['price']['oxidized'], 16,
                         'Preparing member prices must not mutate the source catalog')


if __name__ == '__main__':
    unittest.main()
