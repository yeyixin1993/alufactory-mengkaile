import json
import unittest
from app.ai_quote import quote_profile
from app.ai_review import build_review
import test_ai_chat as fixtures
from unittest.mock import patch

class ReviewTest(unittest.TestCase):
    def spec(self):
        return {**fixtures.SPEC,'order_review':True,'machining_confirmed':True,'accessories':'none','through_hole_count':2,'holes':[{'side':'A','positionMm':50,'type':'through','physicalGrooveIndex':None},{'side':'B','positionMm':150,'type':'through'}]}
    def test_counts_are_not_manufacturing_positions(self):
        spec=self.spec();spec['holes']=[]
        self.assertFalse(build_review(spec,quote_profile(spec,'standard')[1])['ready'])
    def test_multi_face_uses_3d_and_shared_holes(self):
        spec=self.spec();review=build_review(spec,quote_profile(spec,'standard')[1])
        self.assertTrue(review['ready']);self.assertEqual(review['view'],'3d')
        self.assertEqual([h['positionMm'] for h in review['items'][0]['holes']],[50,150])
    def test_unknown_accessories_or_machining_block_cart(self):
        for field,value in [('accessories','pending'),('machining_confirmed',False)]:
            spec=self.spec();spec[field]=value
            self.assertFalse(build_review(spec,quote_profile(spec,'standard')[1])['ready'])
    def test_invalid_hole_position_and_thread_block(self):
        spec=self.spec();spec['holes'][0]['positionMm']=1001
        self.assertFalse(build_review(spec,quote_profile(spec,'standard')[1])['ready'])

class ReviewRouteTest(fixtures.unittest.TestCase):
    setUp=fixtures.AIChatTest.setUp
    tearDown=fixtures.AIChatTest.tearDown
    headers=fixtures.AIChatTest.headers
    chat=fixtures.AIChatTest.chat
    @patch('app.routes.ai_chat.provider_extract')
    def test_owned_confirmed_latest_quote_only(self,provider):
        provider.return_value=(json.dumps(ReviewTest().spec()),100000,{})
        response=self.chat();self.assertTrue(response.json['review']['ready'])
        data={'request_id':'00000000-0000-4000-8000-000000000001','for_cart':True,'confirmed':True}
        self.assertEqual(self.client.post('/api/ai/quote',json=data,headers=self.headers()).status_code,200)
        self.assertEqual(self.client.post('/api/ai/quote',json=data,headers=self.headers('standard')).status_code,400)
        self.assertEqual(self.client.post('/api/ai/quote',json={**data,'confirmed':False},headers=self.headers()).status_code,400)
        self.chat(index=2)
        self.assertEqual(self.client.post('/api/ai/quote',json=data,headers=self.headers()).status_code,400)

    @patch('app.routes.ai_chat.provider_extract')
    def test_ui_confirmation_unblocks_flags_but_not_unknown_holes(self,provider):
        spec=ReviewTest().spec()
        spec.update(machining_confirmed=False,accessories='pending')
        provider.return_value=(json.dumps(spec),100000,{})
        response=self.chat()
        self.assertFalse(response.json['review']['ready'])
        self.assertTrue(response.json['review']['can_confirm'])
        data={'request_id':'00000000-0000-4000-8000-000000000001','for_cart':True,'confirmed':True,'profile_only':True}
        result=self.client.post('/api/ai/quote',json=data,headers=self.headers())
        self.assertEqual(result.status_code,200,result.json)
        self.assertTrue(result.json['review']['ready'])
        spec['holes'][0]['positionMm']=None
        provider.return_value=(json.dumps(spec),100000,{})
        self.chat(index=2)
        data['request_id']='00000000-0000-4000-8000-000000000002'
        self.assertEqual(self.client.post('/api/ai/quote',json=data,headers=self.headers()).status_code,400)

    @patch('app.routes.ai_chat.provider_extract')
    def test_p2_edit_persists_reprices_and_cart_uses_updated_holes(self,provider):
        provider.return_value=(json.dumps(ReviewTest().spec()),100000,{})
        original=self.chat().json
        r=original['review']['items'][0]
        config={'variantId':r['spec']['model'],'colorId':r['spec']['color'],'length':r['spec']['length'],'finish':'oxidized','holes':[],'tapping':{'left':[True],'right':[True]},'unitPrice':0}
        data={'request_id':'00000000-0000-4000-8000-000000000001','source_index':0,'config':config}
        self.assertEqual(self.client.post('/api/ai/edit-profile',json=data,headers=self.headers('standard')).status_code,400)
        result=self.client.post('/api/ai/edit-profile',json=data,headers=self.headers())
        self.assertEqual(result.status_code,200,result.json)
        self.assertEqual(result.json['review']['items'][0]['holes'],[])
        self.assertGreater(result.json['review']['items'][0]['unit_price'],0)
        self.assertEqual(result.json['review']['revision'],1)
        stale=self.client.post('/api/ai/edit-profile',json=data,headers=self.headers())
        self.assertEqual(stale.status_code,409)
        status=self.client.post('/api/ai/status',json={},headers=self.headers()).json
        self.assertEqual(status['history'][-1]['review']['revision'],1)
        cart=self.client.post('/api/ai/quote',json={**data,'for_cart':True,'confirmed':True,'profile_only':True},headers=self.headers())
        self.assertEqual(cart.status_code,200,cart.json)
        self.assertEqual(cart.json['review']['items'][0]['holes'],[])
        config['holes']=[{'side':'A','positionMm':-1,'type':'through'}]
        invalid=self.client.post('/api/ai/edit-profile',json={**data,'revision':1},headers=self.headers())
        self.assertEqual(invalid.status_code,400)
