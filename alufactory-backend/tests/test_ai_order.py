import copy,json,uuid
from unittest.mock import patch
from app.ai_quote import quote_profile
from app.ai_order import apply_configuration,cart_configuration
from app.ai_models import AIRequest, AIConversationMessage
from app.ai_conversations import current_conversation
from app.models.user import db
import test_ai_chat as fixtures

# Reuse only the isolated Flask fixture, not inherited tests.
import unittest
class AIOrderTests(unittest.TestCase):
    setUp=fixtures.AIChatTest.setUp
    tearDown=fixtures.AIChatTest.tearDown
    headers=fixtures.AIChatTest.headers
    status=fixtures.AIChatTest.status
    def seed(self):
        self.status()
        spec={'items':[
          {'product':'aluminum_plate','width':500,'height':400,'thickness':2,'quantity':2},
          {'product':'pegboard','width':500,'height':400,'thickness':5,'quantity':1},
          {'product':'marine_board','width':1000,'height':1000,'thickness':18,'marine_spec':'marine_bbb_plain','color':'natural','quantity':1},
          {'product':'cabinet_door','width':500,'height':2000,'quantity':1},
          {'product':'frame','inner_width':500,'inner_height':700,'frame_type':'wood','quantity':2}]}
        rid=str(uuid.uuid4());reply,q=quote_profile(spec,'vip')
        db.session.add(AIRequest(id='u:vip:'+rid,account_id='u:vip',status='completed',message='test',response={'reply':reply,'quote':q}));db.session.commit()
        from app.ai_models import AIAccount
        db.session.add(AIConversationMessage(request_id='u:vip:'+rid,conversation_id=current_conversation(db.session.get(AIAccount,'u:vip')).id));db.session.commit()
        return rid,spec
    def request(self,rid,**data):
        return self.client.post('/api/ai/order-configuration',headers=self.headers(),json={'request_id':rid,**data})
    def test_all_five_save_cart_pricing_and_config(self):
        rid,spec=self.seed()
        configs=[{'width':500,'height':400,'thickness':2,'colorId':'pink'},
        {'width':500,'height':400,'thickness':5,'colorId':'natural'},
        {'width':1000,'height':1000,'thickness':18,'colorId':'wood_natural','marineSpecId':'marine_bbb_plain'},
        {'width':500,'height':2000,'thickness':2,'colorId':'natural','openingSide':'right'},
        {'innerWidth':500,'innerHeight':700,'frameType':'wood','colorId':'natural'}]
        self.assertEqual(self.request(rid,action='cart',confirmed=True).status_code,400)
        for i,c in enumerate(configs):
            c['unitPrice']=.01
            r=self.request(rid,source_index=i,config=c,quantity=spec['items'][i]['quantity'],revision=i)
            self.assertEqual(r.status_code,200,r.json)
            self.assertEqual(r.json['order_confirmed'],list(range(i+1)))
        stale=self.request(rid,action='cart',confirmed=True,revision=0)
        self.assertEqual(stale.status_code,409)
        r=self.request(rid,action='cart',confirmed=True,revision=5)
        self.assertEqual(r.status_code,200,r.json)
        items=r.json['items'];self.assertEqual([i['product_id'] for i in items],['p5','p1','p6','p3','p4'])
        self.assertEqual([i['totalPrice'] for i in items],[280,396,176,730,240])
        self.assertEqual(items[1]['config']['pegHolePattern'],'ikea')
        self.assertEqual(items[2]['config']['marineSpecId'],'marine_bbb_plain')
        door=items[3]['config'];self.assertEqual(door['openingSide'],'right');self.assertEqual(door['handlePosition'],'left_center');self.assertEqual(door['hingePositions'],[100,1000,1900])
        restored=self.status().json['history'][-1];self.assertEqual(restored['order_confirmed'],[0,1,2,3,4])
    def test_ownership_and_disabled_thickness_and_unlock(self):
        rid,spec=self.seed()
        other=self.client.post('/api/ai/order-configuration',headers=self.headers('standard'),json={'request_id':rid})
        self.assertEqual(other.status_code,409)
        for thickness in (1,3,4):
            r=self.request(rid,source_index=0,quantity=1,config={'width':500,'height':400,'thickness':thickness,'colorId':'natural'})
            self.assertEqual(r.status_code,400,r.json);self.assertIn('2/5',r.json['error'])
        r=self.request(rid,source_index=0,quantity=1,config={'width':500,'height':400,'thickness':2,'colorId':'natural'})
        self.assertEqual(r.status_code,200,r.json)
    def test_door_missing_direction_and_invalid_size(self):
        original={'product':'cabinet_door','quantity':1}
        with self.assertRaises(ValueError):apply_configuration(original,{'width':500,'height':2000,'thickness':2,'colorId':'natural'},1)
        with self.assertRaises(ValueError):apply_configuration(original,{'width':50,'height':2000,'thickness':2,'colorId':'natural','openingSide':'left'},1)
    def test_mixed_profile_config(self):
        row=apply_configuration({'product':'profile','quantity':2},{'variantId':'2020','colorId':'natural','length':1000,'finish':'oxidized','holes':[],'tapping':{'left':[True],'right':[True]}},2)
        item=cart_configuration(row,'standard')
        self.assertEqual(item['product_id'],'p2');self.assertEqual(item['config']['tapping'],{'left':[True],'right':[True]})
        for tier in ('standard','vip','vip_plus'):
            self.assertIsNone(quote_profile({'product':'pegboard','width':500,'height':400,'thickness':3,'quantity':1},tier)[1])

    def test_portrait_pegboard_matches_product_editor(self):
        row={'product':'pegboard','width':500,'height':2000,'thickness':2,'color':'natural','quantity':1}
        item=cart_configuration(row,'standard')
        self.assertEqual(item['config']['height'],2000)
        with self.assertRaises(ValueError):cart_configuration({**row,'width':1400},'standard')
