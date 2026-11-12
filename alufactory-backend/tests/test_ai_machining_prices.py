import unittest
from app.ai_advice import advice
from app.ai_quote import PROFILE_MACHINING_RATES

class MachiningPriceTest(unittest.TestCase):
    def test_direct_rates(self):
        for text in ['20型材加工的价格', '2020打孔多少钱', '端面攻丝怎么收费', '45度斜切单价', '螺纹孔价格']:
            result = advice(text)
            self.assertEqual(result['id'], 'machining-unit-prices')
            self.assertIn(f"通孔：{PROFILE_MACHINING_RATES['through_hole_count']:g}元/个", result['answer'])
            self.assertIn('端面攻丝：1.5元/孔', result['answer'])
            self.assertIn('45°斜切：1元/端', result['answer'])
            self.assertNotIn('颜色', result['answer'])

    def test_order_not_intercepted(self):
        result = advice('2020型材1000mm 10根打孔总价多少钱')
        self.assertNotEqual((result or {}).get('id'), 'machining-unit-prices')
