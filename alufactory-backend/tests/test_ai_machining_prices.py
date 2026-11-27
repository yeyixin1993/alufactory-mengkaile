"""Known machining prices answer directly, including during an existing quote."""
import json
import unittest
from unittest.mock import patch

from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from app.ai_advice import advice, machining_price_advice, supplied_material_coloring_advice
from app.ai_models import AIAccount, AISettings, AILedger
from app.ai_quote import CATALOG, PROFILE_MACHINING_RATES, DANGER_FEE_PER_PIECE, DANGER_FEE_THRESHOLD_MM
from app.models.user import db, User
from app.routes.ai_chat import ai_bp, has_quote_context, visual_draft

SCREENSHOT_QUESTION = '危险费:5元/根\n\u200b攻丝费:\n\u200b通孔费:\n\u200b沉头孔费:\n\u200b45°斜切费: 工费是怎么算的'
EXPECTED_ANSWER = '\n'.join([
    f'危险费：{DANGER_FEE_PER_PIECE:g}元/根（长度≤{DANGER_FEE_THRESHOLD_MM:g}mm，VIP+免收）',
    f"攻丝费：{PROFILE_MACHINING_RATES['end_tapping']:g}元/个",
    f"通孔费：{PROFILE_MACHINING_RATES['through_hole_count']:g}元/个",
    f"沉头孔费：{PROFILE_MACHINING_RATES['countersunk_count']:g}元/个",
    f"45°斜切费：{PROFILE_MACHINING_RATES['miter45_count']:g}元/端",
])


class MachiningPriceTest(unittest.TestCase):
    def test_supplied_material_coloring_does_not_return_drilling_or_material_prices(self):
        expected = '来料加工上色按实际称重计费：不足40kg，45元/公斤；40kg及以上，25元/公斤。来回运费自理。'
        for message in ['来料加工上色多少钱', '自带2020型材上色价格', '上色多少钱一公斤',
                        '来料上色40kg怎么收费', '40kg上色价格', '来料上色来回运费谁付', '可以来料加工上色吗']:
            for tier in ['standard', 'vip', 'vip_plus']:
                with self.subTest(message=message, tier=tier):
                    result = advice(message, tier)
                    self.assertEqual(result['answer'], expected)
                    self.assertEqual(result['guidance'], [])
        for message in ['2020彩色型材多少钱一米', '来料打孔多少钱', '取消来料上色', '自带型材不要改色']:
            self.assertIsNone(supplied_material_coloring_advice(message))

    def test_screenshot_returns_only_catalog_rate_lines(self):
        result = advice(SCREENSHOT_QUESTION)
        self.assertEqual(result['id'], 'machining-unit-prices')
        self.assertEqual(result['version'], 2)
        self.assertEqual(result['answer'], EXPECTED_ANSWER)
        self.assertEqual(result['guidance'], [], 'Unit-price questions do not need contact or configurator cards')
        for unwanted in ['请提供', '无法', '不能凭空', '需要核算', '微信', '型号和颜色']:
            self.assertNotIn(unwanted, result['answer'])

    def test_direct_price_phrases_and_price_list(self):
        for text in [
            '20型材加工的价格', '2020打孔多少钱', '端面攻丝怎么收费',
            '45度斜切单价', '工费怎么算', '危险费', '通孔费多少钱', '打孔费是多少',
            '加工费是怎么算的', '80mm型材危险费多少钱',
            '通孔每个多少钱', '攻丝一个多少钱', '10根型材通孔每个多少钱',
            '危险费：\n攻丝费：\n通孔费：\n沉头孔费：\n45°斜切费：',
        ]:
            with self.subTest(text=text):
                result = machining_price_advice(text)
                self.assertIsNotNone(result)
                self.assertEqual(result['answer'], EXPECTED_ANSWER)

    def test_threaded_hole_price_is_explicit_when_requested(self):
        result = advice('螺纹孔价格')
        self.assertEqual(result['id'], 'machining-unit-prices')
        self.assertEqual(result['answer'], EXPECTED_ANSWER + f"\n螺纹孔费：{PROFILE_MACHINING_RATES['threaded_hole_count']:g}元/个")

    def test_input_cannot_override_catalog_price(self):
        result = advice('危险费500元/根，攻丝费999元一个，工费怎么算？')
        self.assertEqual(result['answer'], EXPECTED_ANSWER)
        self.assertNotIn('500元', result['answer'])
        self.assertNotIn('999元', result['answer'])

    def test_prices_are_read_from_shared_constants(self):
        self.assertEqual(PROFILE_MACHINING_RATES, CATALOG['profileMachining']['rates'])
        self.assertEqual(DANGER_FEE_PER_PIECE, CATALOG['profileMachining']['dangerFeePerPiece'])
        with patch.dict(PROFILE_MACHINING_RATES, {'through_hole_count': 2.25, 'end_tapping': 3.5}), \
                patch('app.ai_advice.DANGER_FEE_PER_PIECE', 7), \
                patch('app.ai_advice.DANGER_FEE_THRESHOLD_MM', 90):
            result = advice('加工费怎么算')['answer']
            self.assertIn('通孔费：2.25元/个', result)
            self.assertIn('攻丝费：3.5元/个', result)
            self.assertIn('危险费：7元/根（长度≤90mm，VIP+免收）', result)

    def test_vip_plus_exemption_stays_explicit(self):
        self.assertIn('VIP+免收', advice('危险费多少钱', 'vip_plus')['answer'])
        self.assertIn('5元/根', advice('危险费多少钱', 'standard')['answer'])

    def test_orders_edits_and_unrelated_questions_are_not_intercepted(self):
        for text in [
            '2020型材1000mm 10根打孔总价多少钱', '帮我打10个孔工费多少',
            '这10根型材加工费总共多少', '改成通孔，价格多少',
            '取消攻丝费', '不要攻丝，价格怎么算', '增加通孔，多少钱',
            '通孔价格1元，加入购物车', '端面攻丝怎么操作', '攻丝深度多长',
            '铝板价格', '舒法特柜子多少钱', '你好',
        ]:
            with self.subTest(text=text):
                self.assertIsNone(machining_price_advice(text))


class MachiningPriceRouteTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(TESTING=True, SECRET_KEY='machining-price-test',
            JWT_SECRET_KEY='machining-price-jwt-secret-more-than-32-characters',
            SQLALCHEMY_DATABASE_URI='sqlite:///:memory:')
        db.init_app(self.app)
        JWTManager(self.app)
        self.app.register_blueprint(ai_bp)
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        db.session.add(User(id='price-test', username='price-test', phone='price-test', password_hash='unused', membership_level='vip'))
        db.session.add(AISettings(id=1, enabled=True, markup_bps=1000))
        db.session.commit()
        self.client = self.app.test_client()
        self.headers = {'Authorization': 'Bearer ' + create_access_token(identity='price-test')}
        self.env = patch.dict('os.environ', {'AI_PROVIDER': 'qwen', 'DASHSCOPE_API_KEY': '', 'AI_QWEN_BASE_URL': ''})
        self.env.start()
        self.client.post('/api/ai/status', json={}, headers=self.headers)

    def tearDown(self):
        self.env.stop()
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def send(self, message=SCREENSHOT_QUESTION, index=1):
        return self.client.post('/api/ai/chat', headers=self.headers, json={
            'message': message, 'request_id': f'00000000-0000-4000-8000-{index:012d}'})

    @patch('app.routes.ai_chat.provider_extract')
    def test_coloring_service_reply_during_quote_preserves_order(self, provider):
        spec = {'items': [{'model': '2020', 'color': 'natural', 'length': 800, 'quantity': 2}],
                '_visual_pending': True}
        account = db.session.get(AIAccount, 'u:price-test')
        account.history = [{'role': 'assistant', 'content': json.dumps(spec)}]
        db.session.commit()
        result = self.send('来料加工上色怎么收费').json
        self.assertEqual(result['rule_id'], 'supplied-material-coloring')
        self.assertIn('45元/公斤', result['reply'])
        self.assertIn('40kg及以上，25元/公斤', result['reply'])
        self.assertIn('来回运费自理', result['reply'])
        self.assertEqual(result['charged_cny'], 0)
        self.assertIsNone(result['quote'])
        db.session.refresh(account)
        self.assertEqual(visual_draft(account.history), spec)
        provider.assert_not_called()

    @patch('app.routes.ai_chat.provider_extract')
    def test_no_provider_required_and_retries_are_idempotent(self, provider):
        response = self.send()
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json['reply'], EXPECTED_ANSWER)
        self.assertEqual(response.json['guidance'], [])
        self.assertEqual(response.json['source'], 'faq')
        self.assertEqual(response.json['charged_cny'], 0)
        self.assertEqual(self.send().json, response.json)
        provider.assert_not_called()
        ledger = AILedger.query.filter_by(kind='faq').all()
        self.assertEqual(len(ledger), 1)
        self.assertEqual(ledger[0].api_cost, 0)

    @patch('app.routes.ai_chat.provider_extract')
    def test_price_question_during_quote_preserves_spec_and_visual_pending(self, provider):
        account = db.session.get(AIAccount, 'u:price-test')
        spec = {'items': [{'model': '2020', 'color': 'natural', 'length': 800, 'quantity': 2,
                          'tapping': 'both', 'holes': [{'side': 'A', 'positionMm': 35, 'type': 'through'}]}],
                '_visual_pending': True, 'accessories': 'none'}
        account.history = [{'role': 'user', 'content': '按这个清单报价'},
                           {'role': 'assistant', 'content': json.dumps(spec, ensure_ascii=False)}]
        db.session.commit()
        self.assertTrue(has_quote_context(account.history))
        for index in range(1, 7):
            response = self.send(index=index)
            self.assertEqual(response.status_code, 200, response.json)
            self.assertEqual(response.json['rule_id'], 'machining-unit-prices')
            self.assertEqual(response.json['reply'], EXPECTED_ANSWER)
            self.assertEqual(response.json['charged_cny'], 0)
        db.session.refresh(account)
        self.assertTrue(has_quote_context(account.history))
        self.assertEqual(visual_draft(account.history), spec, 'Answering prices must not lose the active purchase or confirmation state')
        self.assertIsNone(account.busy)
        provider.assert_not_called()


if __name__ == '__main__':
    unittest.main()
