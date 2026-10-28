import unittest
from app.ai_quote import quote_profile, normalize_extracted_spec, CATALOG
from app.ai_review import build_review

class MaterialQuoteTests(unittest.TestCase):
    def quote(self, product, membership='standard', **kwargs):
        return quote_profile({'product':product, **kwargs}, membership)

    def test_missing_board_fields_are_specific_questions(self):
        for product in ('aluminum_plate','pegboard','marine_board','frame','accessory','cabinet_door'):
            reply, quote = quote_profile(normalize_extracted_spec({'product':product,'items':[]}), 'standard')
            self.assertIsNone(quote)
            self.assertNotIn('型材型号', reply)
            self.assertNotIn('攻丝', reply)
            self.assertNotIn('未能可靠', reply)
        reply,_ = self.quote('marine_board',width=600,height=800,quantity=1)
        self.assertIn('12/18',reply); self.assertIn('BBB',reply); self.assertIn('颜色',reply)

    def test_board_prices_minimum_area_memberships_free_shipping(self):
        for product,standard,plus in [('aluminum_plate',280,168),('pegboard',432,208)]:
            for membership,expected in [('standard',standard),('vip',standard),('vip_plus',plus)]:
                _,q=self.quote(product,membership,width=100,height=100,thickness=2,quantity=2)
                self.assertEqual(q['subtotal'],expected)
                self.assertEqual(q['shipping_fee'],0)
                self.assertTrue(q['free_shipping'])
                self.assertEqual(q['items'][0]['charged_area_sqm'],.2)
                self.assertIsNone(build_review(q['source_spec'],q))

    def test_marine_color_and_weight(self):
        _, q=self.quote('marine_board',width=1000,height=1000,thickness=18,quantity=2,marine_spec='marine_bbb_plain',color='natural',province='天津')
        self.assertEqual(q['subtotal'],352); self.assertEqual(q['weight_kg'],24)
        self.assertIsNotNone(q['shipping_fee'])
        _, q=self.quote('marine_board',width=1000,height=1000,thickness=18,quantity=2,marine_spec='marine_bbb_uv_film',color='pink')
        self.assertEqual(q['subtotal'],600); self.assertTrue(q['shipping_pending'])

    def test_frame_and_door_have_different_rules(self):
        _,q=self.quote('frame',inner_width=500,inner_height=700,frame_type='wood',quantity=2)
        self.assertEqual(q['subtotal'],240); self.assertEqual(q['shipping_fee'],0)
        for h,hinges in [(1500,2),(2000,3),(2500,4),(3000,5)]:
            _,q=self.quote('cabinet_door',width=500,height=h,quantity=1)
            self.assertEqual(q['subtotal'],500*h/1e6*700+hinges*10)
            self.assertEqual(q['items'][0]['hinge_count'],hinges)
        _,q=self.quote('cabinet_door','vip_plus',width=500,height=2000,quantity=1)
        self.assertEqual(q['subtotal'],450)

    def test_mixed_partial_preserves_board_and_profile(self):
        spec={'items':[{'product':'pegboard','width':500,'height':400,'thickness':2,'quantity':1},{'model':'2020','length':1000,'color':'natural','quantity':1},{'product':'marine_board','quantity':1}],'province':'天津'}
        reply,q=quote_profile(spec,'standard')
        self.assertEqual(len(q['items']),2); self.assertEqual(len(q['pending_items']),1)
        self.assertTrue(q['partial']); self.assertIn('BBB',reply)
        self.assertEqual(q['length_m'],1)

    def test_out_of_range_not_silently_clamped(self):
        reply,q=self.quote('aluminum_plate',width=2500,height=1000,thickness=2,quantity=1)
        self.assertIsNone(q); self.assertIn('2400',reply)

    def test_accessory_catalog_prices(self):
        a=next(a for a in CATALOG['accessories'] if not a.get('lengthPriced') and not a.get('naturalOnly'))
        _,q=self.quote('accessory',accessory_key=a['key'],color='natural',quantity=100)
        self.assertEqual(q['subtotal'],round(a['price']['naturalBulk']*100,1))

    def test_marine_full_sheet_prices_and_cart_roundtrip(self):
        from app.ai_order import cart_configuration, apply_configuration
        from app.ai_advice import advice
        for membership in ('standard','vip','vip_plus'):
            for thickness,finish,price in [(12,'marine_bbb_plain',226),(12,'marine_bbb_uv_film',258),(18,'marine_bbb_plain',339),(18,'marine_bbb_uv_film',388)]:
                row=dict(product='marine_board',board_purchase_mode='full_sheet',thickness=thickness,marine_spec=finish,quantity=3)
                reply,q=quote_profile(row,membership)
                self.assertEqual(q['subtotal'],price*3)
                self.assertIn('整张板',reply)
                self.assertEqual(q['spec']['width'],2440)
                self.assertEqual(q['spec']['height'],1220)
                self.assertAlmostEqual(q['weight_kg'],2440*1220/1e6*3*(8 if thickness==12 else 12))
                cart=cart_configuration(row,membership)
                self.assertEqual(cart['config']['boardPurchaseMode'],'full_sheet')
                restored=apply_configuration(row,cart['config'],3)
                self.assertEqual(quote_profile(restored,membership)[1]['subtotal'],price*3)
        answer=advice('BBB海洋板整张多少钱')['answer']
        for price in (226,258,339,388): self.assertIn(str(price),answer)

    def test_marine_custom_rotation_and_full_sheet_conflicts(self):
        base=dict(product='marine_board',thickness=18,marine_spec='marine_bbb_uv_film',color='natural',quantity=1)
        for w,h in [(1200,2400),(2400,1200)]:
            _,q=quote_profile(dict(base,width=w,height=h),'standard')
            self.assertEqual(q['subtotal'],576)
            self.assertEqual(q['items'][0]['area_sqm'],2.88)
        _,q=quote_profile(dict(base,width=2440,height=1220),'standard')
        self.assertEqual(q['subtotal'],595.4)
        for patch in [dict(width=2400,height=2400),dict(board_purchase_mode='full_sheet',color='pink'),dict(board_purchase_mode='full_sheet',width=1200,height=2400),dict(board_purchase_mode='full_sheet',width=1000)]:
            reply,q=quote_profile(dict(base,**patch),'standard')
            self.assertIsNone(q)
            self.assertTrue(reply)
        reply,_=quote_profile(dict(product='marine_board'),'standard')
        self.assertIn('整张板',reply)
