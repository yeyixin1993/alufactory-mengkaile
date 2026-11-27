"""End-tap answers use confirmed manufacturing facts, not accessory screw sizes."""
import unittest

from app.ai_advice import (
    END_TAPPING_STANDARD_ANSWER,
    advice,
    catalog_price_advice,
    end_tapping_spec_advice,
)


class EndTappingSpecsTest(unittest.TestCase):
    def answer(self, question):
        result = end_tapping_spec_advice(question)
        self.assertIsNotNone(result, question)
        self.assertEqual(result['guidance'], [])
        return result['answer']

    def assert_spec(self, answer, thread, depth):
        self.assertIn(thread, answer)
        self.assertRegex(answer, rf'(?:至少|不小于|≥|最小|最低)\s*{depth}\s*mm')

    def test_reported_3030_size_question_returns_m8(self):
        answer = self.answer('3030攻丝是6mm还是8mm')
        self.assert_spec(answer, 'M8', 20)
        self.assertNotIn('M6', answer)
        self.assertNotIn('M6×12', answer)
        self.assertNotIn('M6×18', answer)

    def test_each_confirmed_series_thread_and_minimum_depth(self):
        for model, thread, depth in [
            ('1515', 'M4', 10), ('2020', 'M6', 20),
            ('3030', 'M8', 20), ('4040', 'M8', 20),
        ]:
            for question in [f'{model}型材攻丝的长度和大小',
                             f'{model}默认攻丝多大',
                             f'{model}攻丝深度是多少']:
                with self.subTest(question=question):
                    self.assert_spec(self.answer(question), thread, depth)

    def test_general_question_lists_all_confirmed_series(self):
        for question in ['型材攻丝的长度和大小', '攻丝深度是多少', '默认攻丝规格是什么']:
            with self.subTest(question=question):
                self.assertEqual(self.answer(question), END_TAPPING_STANDARD_ANSWER)
        for model, thread, depth in [('1515', 'M4', 10), ('2020', 'M6', 20),
                                      ('3030', 'M8', 20), ('4040', 'M8', 20)]:
            self.assertIn(model, END_TAPPING_STANDARD_ANSWER)
            self.assert_spec(END_TAPPING_STANDARD_ANSWER, thread, depth)

    def test_known_family_variants_keep_series_specification(self):
        for model, thread in [('2040', 'M6'), ('2060', 'M6'), ('20100', 'M6'),
                              ('3060', 'M8'), ('4080', 'M8'),
                              ('2040-N1-20', 'M6'), ('3030-N1', 'M8')]:
            with self.subTest(model=model):
                self.assert_spec(self.answer(f'{model}端面攻丝多大多深'), thread, 20)

    def test_2047_is_not_reduced_to_a_single_20_series_thread(self):
        for question in ['2047攻丝多大', '2047攻丝深度是多少',
                         '2047中间孔攻丝是M8吗', '2020和2047攻丝规格分别是什么']:
            with self.subTest(question=question):
                self.assertIsNone(end_tapping_spec_advice(question))

    def test_other_machining_properties_and_materials_are_not_overridden(self):
        for question in [
            '1515攻丝底孔多大', '3030攻丝底孔直径是多少',
            '3030侧面螺纹孔能攻M6吗', '3030侧面攻丝深度多少',
            '3030端面攻丝螺距多少', '3030攻丝用什么刀具',
            '3030攻丝用哪种丝锥', '铝板攻丝多大多深',
            '海洋板能攻丝吗', '不锈钢攻丝深度是多少',
        ]:
            with self.subTest(question=question):
                self.assertIsNone(end_tapping_spec_advice(question))

    def test_price_and_order_intent_remain_in_their_existing_flows(self):
        for question in [
            '3030攻丝多少钱', '3030攻丝单价', '攻丝费怎么计算',
            '我要3030两根，端面攻丝M8', '下单1515两端攻丝M4',
            '3030两端攻丝加入购物车', '把2020改成3030，攻丝改成M8',
            '取消3030的攻丝', '3030增加两个攻丝孔',
        ]:
            with self.subTest(question=question):
                self.assertIsNone(end_tapping_spec_advice(question))
        price = catalog_price_advice('3030攻丝多少钱')
        self.assertIsNotNone(price)
        self.assertIn('攻丝费：1.5元/个', price['answer'])

    def test_public_advice_dispatch_uses_the_same_confirmed_specs(self):
        for question, thread, depth in [
            ('3030攻丝是6mm还是8mm', 'M8', 20),
            ('1515攻丝深度是多少', 'M4', 10),
            ('2020默认攻丝多大', 'M6', 20),
        ]:
            with self.subTest(question=question):
                result = advice(question)
                self.assertIsNotNone(result)
                self.assert_spec(result['answer'], thread, depth)
                self.assertEqual(result, end_tapping_spec_advice(question))
                self.assertNotIn('统一为20mm', result['answer'])


if __name__ == '__main__':
    unittest.main()
