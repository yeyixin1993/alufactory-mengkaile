"""Catalog unit-price answers must use the authenticated tier and exact products."""
import re
import unittest
from unittest.mock import patch

from app.ai_advice import advice, catalog_price_advice
from app.ai_quote import CATALOG


class CatalogPriceTest(unittest.TestCase):
    def answer(self, question, membership='standard'):
        result = catalog_price_advice(question, membership)
        self.assertIsNotNone(result, question)
        self.assertEqual(result['guidance'], [], 'Known prices do not require contact/configurator cards')
        return result['answer']

    def assert_rate(self, answer, price, unit):
        self.assertRegex(answer, rf'(?<![\d.]){re.escape(f"{price:g}")}元/{re.escape(unit)}(?![\w])')

    def test_profile_rates_for_each_membership(self):
        for membership, discount, tier in [('standard', 0, '标准价'), ('vip', 2, 'VIP价'), ('vip_plus', 4, 'VIP+价')]:
            with self.subTest(membership=membership):
                answer = self.answer('2020每米多少钱', membership)
                for price in [16-discount, 20-discount, 24-discount]:
                    self.assert_rate(answer, price, '米')
                self.assertIn('银白', answer)
                self.assertIn('默认', answer)
                self.assertIn(tier, answer)
                self.assertIn('不含加工', answer)
                self.assertIn('运费', answer)
                self.assertNotIn('请提供', answer)

    def test_aluminum_and_pegboard_rates_for_each_membership(self):
        for membership in ['standard', 'vip', 'vip_plus']:
            for product, regular, plus in [('铝板', [700, 1600], [420, 960]), ('洞洞板', [1080, 1980], [520, 1120])]:
                for thickness, price in zip([2, 5], plus if membership == 'vip_plus' else regular):
                    with self.subTest(membership=membership, product=product, thickness=thickness):
                        answer = self.answer(f'{thickness}mm{product}价格', membership)
                        self.assertIn(f'{thickness}mm{product}', answer)
                        self.assert_rate(answer, price, '㎡')
                        self.assertIn('累计', answer)
                        self.assertIn('0.2', answer)
                        self.assertNotIn('请提供', answer)

    def test_marine_custom_rates_are_same_for_all_memberships(self):
        for membership in ['standard', 'vip', 'vip_plus']:
            for thickness, plain, uv in [(12, 136, 155), (18, 176, 200)]:
                with self.subTest(membership=membership, thickness=thickness):
                    answer = self.answer(f'{thickness}mm海洋板多少钱', membership)
                    self.assert_rate(answer, plain, '㎡')
                    self.assert_rate(answer, uv, '㎡')
                    self.assertIn('同价', answer)
                    self.assertIn('单块', answer)
                    self.assertIn('0.2', answer)
                    self.assertIn('运费另计', answer)

    def test_marine_full_sheet_rates_are_same_for_all_memberships(self):
        for membership in ['standard', 'vip', 'vip_plus']:
            for thickness, plain, uv in [(12, 226, 258), (18, 339, 388)]:
                with self.subTest(membership=membership, thickness=thickness):
                    answer = self.answer(f'{thickness}mm海洋板整张多少钱', membership)
                    self.assert_rate(answer, plain, '张')
                    self.assert_rate(answer, uv, '张')
                    self.assertIn('2440', answer)
                    self.assertIn('1220', answer)
                    self.assertIn('原色', answer)
                    self.assertIn('运费另计', answer)

    def test_explicit_colored_marine_prices_include_surcharge(self):
        for membership in ['standard', 'vip', 'vip_plus']:
            for question in ['彩色18mm海洋板多少钱', '粉色18mm海洋板价格']:
                with self.subTest(membership=membership, question=question):
                    answer = self.answer(question, membership)
                    self.assert_rate(answer, 276, '㎡')
                    self.assert_rate(answer, 300, '㎡')
                    self.assertIn('彩色276元/㎡', answer)
                    self.assertIn('彩色300元/㎡', answer)

    def test_explicit_colored_profile_does_not_quote_unavailable_finish(self):
        for membership, price in [('standard', 24), ('vip', 22), ('vip_plus', 20)]:
            for question in ['紫色2020多少钱', '粉色2020每米多少钱']:
                with self.subTest(membership=membership, question=question):
                    answer = self.answer(question, membership)
                    self.assert_rate(answer, price, '米')
                    self.assertNotIn('银白色（默认）', answer)
                    self.assertNotRegex(answer, r'彩色截面本色[：:]\s*\d')

    def test_exact_variant_does_not_quote_prefix_model(self):
        for variant_id in ['2020-N1', '2020-N2-OPP', '2020-N4-RD', '2040-N1-20', '3030-N1', '3060-N1-60']:
            variant = next(v for v in CATALOG['variants'] if v['id'] == variant_id)
            for alias in [variant['id'], variant['name']]:
                with self.subTest(alias=alias):
                    answer = self.answer(f'{alias}单价')
                    self.assertIn(variant['name'], answer)
                    self.assertNotIn(variant_id.split('-')[0] + '：', answer)
                    for price in variant['price'].values():
                        self.assert_rate(answer, price, '米')
        for question in ['2020-N99多少钱', '2020N99价格']:
            with self.subTest(question=question):
                self.assertIsNone(catalog_price_advice(question))

    def test_prices_are_read_from_catalog(self):
        profile = next(v for v in CATALOG['variants'] if v['id'] == '2020')
        rules = CATALOG['quickQuote']
        with patch.dict(profile['price'], {'oxidized': 31, 'electrophoretic': 32, 'powder': 33}), \
                patch.dict(rules['VIP_PLUS_ALUMINUM_PLATE_PRICE_PER_SQM'], {'2': 421}), \
                patch.dict(rules['MARINE_BOARD_SPEC_PRICE_PER_SQM']['marine_bbb_plain'], {'18': 177}), \
                patch.dict(rules['MARINE_BOARD_FULL_SHEET_PRICE']['marine_bbb_uv_film'], {'12': 259}):
            answer = self.answer('2020每米多少钱', 'vip_plus')
            for price in [27, 28, 29]:
                self.assert_rate(answer, price, '米')
            self.assert_rate(self.answer('2mm铝板价格', 'vip_plus'), 421, '㎡')
            self.assert_rate(self.answer('18mm海洋板价格'), 177, '㎡')
            self.assert_rate(self.answer('12mm海洋板整张多少钱'), 259, '张')

    def test_mixed_material_questions_keep_both_known_prices(self):
        answer = self.answer('2020型材和2mm洞洞板价格', 'vip_plus')
        self.assertIn('2020', answer)
        self.assert_rate(answer, 12, '米')
        self.assertIn('2mm洞洞板', answer)
        self.assert_rate(answer, 520, '㎡')
        answer = self.answer('2020型材价格，攻丝费多少钱', 'vip_plus')
        self.assertIn('2020', answer)
        self.assert_rate(answer, 12, '米')
        self.assert_rate(answer, 1.5, '个')

    def test_board_question_cannot_be_replaced_by_profile_machining_prices(self):
        answer = self.answer('2mm洞洞板价格，加工费多少钱', 'vip_plus')
        self.assertIn('2mm洞洞板', answer)
        self.assert_rate(answer, 520, '㎡')
        self.assertNotIn('危险费：5元/根', answer)

    def test_order_totals_and_edits_still_reach_quote_flow(self):
        for question in [
            '2020型材1000mm 10根总价多少钱', '我要2020型材1000mm两根，多少钱',
            '2020型材1000mm 2根多少钱', '下单2mm洞洞板，多少钱',
            '2020改成3030，价格多少', '铝板和海洋板合计多少钱',
            '2020一共多少钱', '2mm洞洞板加入购物车',
        ]:
            with self.subTest(question=question):
                self.assertIsNone(catalog_price_advice(question))
                self.assertIsNone(advice(question))

    def test_specification_questions_are_not_price_questions(self):
        for question in ['2020的壁厚是多少', '攻丝深度是多少', '海洋板厚度多少']:
            with self.subTest(question=question):
                self.assertIsNone(catalog_price_advice(question))
        self.assertIn('20mm', advice('攻丝深度是多少')['answer'])
        self.assertIn('截面图', advice('2020的壁厚是多少')['answer'])

    def test_unsupported_thickness_cannot_match_decimal_suffix(self):
        for question in ['海洋板1.12mm价格', '1.18mm海洋板价格', '3mm洞洞板多少钱', '3mm铝板价格']:
            with self.subTest(question=question):
                self.assertIsNone(catalog_price_advice(question))


if __name__ == '__main__':
    unittest.main()
