import json
import unittest
from pathlib import Path
from app.ai_quote import quote_profile

class MultiQuoteTest(unittest.TestCase):
    def test_reference_list_combines_shipping(self):
        spec = json.loads(Path(__file__).with_name('ai_multi_fixture.json').read_text())
        reply, q = quote_profile(spec, 'vip')
        self.assertEqual((q['quantity'], q['length_m']), (114, 55.31))
        self.assertEqual((q['subtotal'], q['shipping_fee'], q['total']), (893.3, 59.7, 953.0))
        self.assertEqual(len(q['items']), 19)
        self.assertTrue(q['assumed_no_machining'])
        self.assertIn('无额外加工', reply)

    def test_missing_province_and_unsupported_rows(self):
        spec = {'items': [{'model':'2020','color':'紫色','length':610,'quantity':2}]}
        reply, q = quote_profile(spec, 'vip')
        self.assertIsNotNone(q)
        self.assertTrue(q['shipping_pending'])
        self.assertIsNone(q['shipping_fee'])
        self.assertIn('哪个省', reply)
        spec['province'] = '天津'
        spec['items'][0]['unsupported'] = True
        self.assertIsNotNone(quote_profile(spec, 'vip')[1])

    def test_confirmation_does_not_swallow_corrections(self):
        from app.routes.ai_chat import is_confirmation
        self.assertTrue(is_confirmation('确认以上识别信息，多个颜色加起来的总价即可'))
        self.assertTrue(is_confirmation('确认，合计价格'))
        self.assertFalse(is_confirmation('确认以上识别信息，但是350改成360'))
