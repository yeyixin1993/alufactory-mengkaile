"""Equipment-tree facts are explicit, scoped, and precede generic price intent."""
import unittest

from app.ai_advice import advice, equipment_tree_advice


class EquipmentTreeAdviceTest(unittest.TestCase):
    def test_shaft_diameter_structure_and_finish(self):
        for question in ['设备树光轴直径多少', '设备树用的是硬轴还是软轴',
                         '设备树光轴是空心的吗', '设备树光轴表面有没有镀铬']:
            with self.subTest(question=question):
                result = advice(question)
                self.assertEqual(result['answer'], '设备树的光轴采用直径35mm的实心镀铬硬轴。')
                self.assertEqual(result['guidance'], [])

    def test_printed_parts_material_and_current_color(self):
        for question in ['设备树3D打印件是什么材料', '设备树打印件是PLA还是PETG',
                         '设备树打印件有多少种颜色', '设备树打印件可以选白色吗']:
            with self.subTest(question=question):
                self.assertEqual(advice(question)['answer'], '设备树的3D打印件采用PETG材料，目前仅有黑色。')

    def test_combined_specs(self):
        for question in ['设备树光轴和打印件分别是什么材料', '设备树材质介绍']:
            answer = advice(question)['answer']
            self.assertIn('35mm的实心镀铬硬轴', answer)
            self.assertIn('PETG材料，目前仅有黑色', answer)

    def test_other_products_and_unknown_properties_are_not_overridden(self):
        for question in ['光轴直径多少', '打印件是什么材料', '设备树光轴多少钱',
                         '设备树承重多少', '设备树打印件耐温多少', '设备树光轴加入购物车']:
            with self.subTest(question=question):
                self.assertIsNone(equipment_tree_advice(question))


if __name__ == '__main__':
    unittest.main()
