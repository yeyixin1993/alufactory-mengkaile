import json, unittest, uuid
from unittest.mock import patch
import test_ai_chat as fixture
from app.ai_models import AIAccount, AIRequest, AIConversation, AIConversationMessage
from app.models.user import db
from app.ai_quote import quote_profile

class ConversationTests(unittest.TestCase):
    setUp=fixture.AIChatTest.setUp
    tearDown=fixture.AIChatTest.tearDown
    headers=fixture.AIChatTest.headers
    status=fixture.AIChatTest.status
    def post(self,path,data=None,user='vip'):
        return self.client.post('/api/ai/'+path,json=data or {},headers=self.headers(user) if user else {})
    def send(self,cid,text='2020粉色两根'):
        return self.post('chat',{'conversation_id':cid,'request_id':str(uuid.uuid4()),'message':text})
    @patch('app.routes.ai_chat.provider_extract',return_value=(json.dumps(fixture.SPEC),100,{}))
    def test_full_archive_new_chat_resume_and_isolation(self,provider):
        a=self.status().json['conversation_id']
        for i in range(6): self.assertEqual(self.send(a).status_code,200)
        snapshot=self.status().json
        self.assertEqual(len(snapshot['history']),12)
        balance=snapshot['balance_cny']
        b=self.post('reset').json['conversation_id']
        self.assertNotEqual(a,b)
        self.assertEqual(self.status().json['history'],[])
        self.assertEqual(self.status().json['balance_cny'],balance)
        self.assertEqual(self.send(a).status_code,409)
        self.assertEqual(self.send(b,'另一份需求').status_code,200)
        self.assertEqual(self.post('conversations/open',{'conversation_id':a},user='standard').status_code,404)
        reopened=self.post('conversations/open',{'conversation_id':a})
        self.assertEqual(len(reopened.json['history']),12)
        self.assertEqual(len(reopened.json['conversations']),2)
        self.assertEqual(self.send(a,'数量改为3根').status_code,200)
        self.assertTrue(provider.call_args.args[0])
        self.assertEqual(len(self.status().json['history']),14)
        self.assertEqual(len(self.post('conversations/open',{'conversation_id':b}).json['history']),2)
    def test_legacy_recovery_and_busy_switch(self):
        account=AIAccount(id='u:vip',history=[]);db.session.add(account)
        reply,q=quote_profile(fixture.SPEC,'vip')
        rid='u:vip:'+str(uuid.uuid4())
        db.session.add(AIRequest(id=rid,account_id=account.id,message='旧报价',status='completed',response={'reply':reply,'quote':q}))
        db.session.commit()
        view=self.status().json
        self.assertEqual(len(view['history']),2)
        self.assertEqual(view['conversations'][0]['title'],'旧报价')
        cid=view['conversation_id']
        account.busy='in-flight';db.session.commit()
        self.assertEqual(self.post('reset').status_code,409)
        self.assertEqual(self.post('conversations/open',{'conversation_id':cid}).status_code,409)
        self.assertEqual(AIConversation.query.count(),1)
    def test_guest_history_requires_signed_identity(self):
        one=self.status(user=None).json
        two=self.status(user=None).json
        self.assertNotEqual(one['conversation_id'],two['conversation_id'])
        result=self.post('conversations/open',{'visitor_token':two['visitor_token'],'conversation_id':one['conversation_id']},user=None)
        self.assertEqual(result.status_code,404)
        self.assertEqual(self.status(user=None,token=one['visitor_token']).json['conversation_id'],one['conversation_id'])

    @patch('app.routes.ai_chat.provider_extract',return_value=(json.dumps(fixture.SPEC),100,{}))
    @patch('app.routes.ai_chat.provider_name',return_value='deepseek')
    @patch('app.routes.ai_chat.image_input',return_value='data:image/png;base64,test-image')
    def test_image_and_quote_survive_switch(self,*mocks):
        cid=self.status().json['conversation_id']
        response=self.send(cid,'按图报价')
        self.assertEqual(response.status_code,200)
        self.post('reset')
        restored=self.post('conversations/open',{'conversation_id':cid}).json
        self.assertEqual(restored['history'][0]['image'],'data:image/png;base64,test-image')
        self.assertEqual(restored['history'][1]['quote'],response.json['quote'])
