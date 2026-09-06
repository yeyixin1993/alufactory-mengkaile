import tempfile
import unittest
from datetime import datetime
from types import SimpleNamespace

from app.product_order_db import (
    CATEGORY_LABELS,
    classify_order_item,
    query_order_snapshots,
    sync_order_snapshot,
)


class DisplayRackOrderManagementTest(unittest.TestCase):
    def test_display_rack_classification_aliases(self):
        self.assertEqual(classify_order_item('DISPLAY_RACK_3_0', '3.0参数化展示架', 'p9'), 'display_rack')
        self.assertEqual(classify_order_item('', '', 'p9'), 'display_rack')
        self.assertEqual(classify_order_item('', '3.0参数化展示架', ''), 'display_rack')
        self.assertEqual(CATEGORY_LABELS['display_rack'], '展示架订单管理')

    def test_display_rack_snapshot_keeps_parameters_and_management_fields(self):
        config = {
            'type': 'finished_furniture',
            'finishedFurnitureCategory': 'finished_furniture',
            'finishedFurnitureSource': 'display_rack_3_0',
            'finishedFurnitureProductId': 'p9',
            'finishedFurnitureTotalCny': 4500,
            'parametricSummary': {
                'widthMm': 800,
                'heightMm': 2000,
                'depthMm': 450,
                'baseCabinetHeightMm': 824,
                'upperLevels': 3,
                'lowerLevels': 5,
                'profileColorId': 'natural',
                'marineBoardColorId': 'wood_natural',
            },
            'productionItems': [{'id': 'profile-1', 'quantity': 4}],
        }
        item = SimpleNamespace(
            id='item-p9',
            product_id='p9',
            product_name='3.0参数化展示架',
            product_type='DISPLAY_RACK_3_0',
            quantity=1,
            unit_price=4500,
            total_price=4500,
            config=config,
        )
        now = datetime(2026, 9, 6, 12, 0, 0)
        order = SimpleNamespace(
            id='order-p9',
            order_number='ORD-P9',
            items=[item],
            user_id='user-1',
            phone='13900000000',
            recipient_name='展示架客户',
            province='上海',
            address_detail='测试地址',
            shipping_method='standard',
            subtotal=4500,
            shipping_fee=0,
            total_amount=4500,
            status='pending',
            tracking_number='',
            memo='',
            admin_memo='',
            created_at=now,
            updated_at=now,
        )
        user = SimpleNamespace(username='测试用户', phone='13900000000')

        with tempfile.TemporaryDirectory() as instance_path:
            sync_order_snapshot(instance_path, order, user=user, pdf_available=True)
            rows, total = query_order_snapshots(instance_path, category_code='display_rack')

        self.assertEqual(total, 1)
        row = rows[0]
        self.assertEqual(row['category_label'], '展示架订单管理')
        self.assertEqual(row['item_product_id'], 'p9')
        self.assertEqual(row['item_width'], 800)
        self.assertEqual(row['item_height'], 2000)
        self.assertEqual(row['item_thickness'], '450mm')
        self.assertEqual(row['item_total_price'], 4500)
        self.assertIn('地柜高824mm', row['item_remark'])
        self.assertIn('展示层板3层', row['item_remark'])
        self.assertIn('抽屉5层', row['item_remark'])
        self.assertIn('productionItems', row['item_config'])
        self.assertTrue(row['item_sketch_svg'].startswith('data:image/png;base64,'))


if __name__ == '__main__':
    unittest.main()
