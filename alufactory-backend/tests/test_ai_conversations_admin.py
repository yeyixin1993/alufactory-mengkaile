"""Admin chat-log audit: every customer question and answer must be inspectable.

The customer-facing transcript only ever returns the caller's own account, and only the
8-message working context. These tests pin the *admin* view: signed-in accounts and
anonymous guests, full history, and the guest's first-touch origin.
"""
import json, unittest, uuid
from datetime import datetime, timedelta
from unittest.mock import patch
import test_ai_chat as fixture
from app.ai_models import AIAccount, AIConversation, AIConversationMessage, AIRequest
from app.models.user import db

GUEST_ORIGIN = {'REMOTE_ADDR': '203.0.113.7', 'HTTP_USER_AGENT': 'GuestBrowser/1.0 (Android)'}

class ConversationAdminTests(unittest.TestCase):
    setUp = fixture.AIChatTest.setUp
    tearDown = fixture.AIChatTest.tearDown
    headers = fixture.AIChatTest.headers

    def call(self, path, user='admin'):
        return self.client.get(path, headers=self.headers(user) if user else {})

    def signed_in(self, user='vip'):
        return self.client.post('/api/ai/status', json={}, headers=self.headers(user)).json

    def guest(self):
        return self.client.post('/api/ai/status', json={}, environ_overrides=GUEST_ORIGIN).json

    def send(self, conversation_id, message='2020粉色两根', token='', user='vip', attachments=None):
        payload = {'conversation_id': conversation_id, 'request_id': str(uuid.uuid4()), 'message': message}
        if token:
            payload['visitor_token'] = token
        if attachments:
            payload['attachments'] = attachments
        return self.client.post('/api/ai/chat', json=payload, headers=self.headers(user) if user else {},
                                environ_overrides=GUEST_ORIGIN)

    def test_admin_only(self):
        self.assertEqual(self.client.get('/api/ai/admin/conversations').status_code, 401)
        self.assertEqual(self.call('/api/ai/admin/conversations', 'vip').status_code, 403)
        self.assertEqual(self.call('/api/ai/admin/conversations', None).status_code, 401)
        self.assertEqual(self.call('/api/ai/admin/conversations/missing-id').status_code, 404)
        self.assertEqual(self.call('/api/ai/admin/messages/g:nope:nope/images').status_code, 404)

    @patch('app.routes.ai_chat.provider_extract', return_value=(json.dumps(fixture.SPEC), 100, {}))
    def test_guest_first_touch_and_full_transcript(self, provider):
        state = self.guest()
        self.assertEqual(self.send(state['conversation_id'], token=state['visitor_token'], user=None).status_code, 200)
        listing = self.call('/api/ai/admin/conversations').json
        self.assertEqual(listing['total'], 1)
        item = listing['conversations'][0]
        self.assertEqual(item['id'], state['conversation_id'])
        self.assertEqual(item['actor']['kind'], 'guest')
        self.assertEqual(item['actor']['ip'], '203.0.113.7')
        self.assertIn('GuestBrowser', item['actor']['user_agent'])
        self.assertTrue(item['actor']['first_seen_at'].endswith('Z'))
        self.assertEqual(item['messages'], 1)
        self.assertEqual(item['question'], '2020粉色两根')
        self.assertEqual(item['status'], 'completed')
        self.assertEqual(item['issues'], 0)
        detail = self.call('/api/ai/admin/conversations/' + state['conversation_id']).json
        self.assertEqual(detail['actor']['kind'], 'guest')
        self.assertEqual(len(detail['messages']), 2)
        self.assertEqual(detail['messages'][0]['role'], 'user')
        self.assertEqual(detail['messages'][0]['content'], '2020粉色两根')
        self.assertEqual(detail['messages'][0]['images'], 0)
        answer = detail['messages'][1]
        self.assertEqual(answer['role'], 'assistant')
        self.assertTrue(answer['content'])
        self.assertIsNotNone(answer['quote'])
        self.assertIn('subtotal', answer['quote'])
        self.assertEqual(provider.call_count, 1)

    @patch('app.routes.ai_chat.provider_extract', return_value=(json.dumps(fixture.SPEC), 100, {}))
    def test_search_by_customer_ip_and_audience(self, provider):
        account = self.signed_in()
        self.send(account['conversation_id'], user='vip')
        guest = self.guest()
        self.send(guest['conversation_id'], token=guest['visitor_token'], user=None)
        self.assertEqual(self.call('/api/ai/admin/conversations').json['total'], 2)
        self.assertEqual(self.call('/api/ai/admin/conversations?kind=guest').json['total'], 1)
        self.assertEqual(self.call('/api/ai/admin/conversations?kind=user').json['total'], 1)
        self.assertEqual(self.call('/api/ai/admin/conversations?kind=guest').json['conversations'][0]['actor']['kind'], 'guest')
        by_name = self.call('/api/ai/admin/conversations?q=vip').json
        self.assertEqual(by_name['total'], 1)
        self.assertEqual(by_name['conversations'][0]['actor']['name'], 'vip')
        self.assertEqual(by_name['conversations'][0]['actor']['account_id'], 'u:vip')
        self.assertEqual(self.call('/api/ai/admin/conversations?q=203.0.113.7').json['total'], 1)
        self.assertEqual(self.call('/api/ai/admin/conversations?q=nobody-here').json['total'], 0)

    @patch('app.routes.ai_chat.provider_extract', return_value=(json.dumps(fixture.SPEC), 100, {}))
    @patch('app.routes.ai_chat.provider_name', return_value='deepseek')
    @patch('app.routes.ai_chat.image_input', return_value='data:image/png;base64,QUJD')
    def test_images_are_fetched_per_message(self, clean, name, provider):
        state = self.signed_in()
        response = self.send(state['conversation_id'], message='按图报价', user='vip',
                             attachments=[{'name': '图纸.png', 'data': 'data:image/png;base64,QUJD'}])
        self.assertEqual(response.status_code, 200, response.json)
        detail = self.call('/api/ai/admin/conversations/' + state['conversation_id']).json
        self.assertEqual(detail['messages'][0]['images'], 1)
        # The thread itself carries no base64; the page pulls each upload on demand.
        self.assertNotIn('data:image', json.dumps(detail['messages']))
        images = self.call('/api/ai/admin/messages/' + detail['messages'][0]['request_id'] + '/images').json['images']
        self.assertEqual(images, [{'name': '图纸.png', 'kind': 'image', 'data': 'data:image/png;base64,QUJD'}])

    def test_pagination_hides_empty_chats_and_counts_issues(self):
        base = datetime.utcnow()
        for index in range(25):
            conversation_id = str(uuid.uuid4())
            account_id = 'g:bulk-%d' % index
            request_id = '%s:%s' % (account_id, uuid.uuid4())
            when = base + timedelta(seconds=index)
            db.session.add(AIConversation(id=conversation_id, account_id=account_id, title='问题%d' % index,
                                          created_at=when, updated_at=when))
            db.session.add(AIRequest(id=request_id, account_id=account_id, status='reconcile' if index == 0 else 'completed',
                                     message='第%d条' % index, response={'reply': '答%d' % index}, created_at=when))
            db.session.add(AIConversationMessage(request_id=request_id, conversation_id=conversation_id))
        db.session.add(AIConversation(id=str(uuid.uuid4()), account_id='g:empty', title='空对话'))
        db.session.commit()
        first = self.call('/api/ai/admin/conversations').json
        # An empty chat has nothing to audit and must not occupy a row.
        self.assertEqual(first['total'], 25)
        self.assertEqual(first['pages'], 2)
        self.assertEqual(first['per_page'], 20)
        self.assertEqual(len(first['conversations']), 20)
        # Newest first, so the newest question leads page one.
        self.assertEqual(first['conversations'][0]['title'], '问题24')
        self.assertEqual(first['conversations'][-1]['title'], '问题5')
        second = self.call('/api/ai/admin/conversations?page=2').json
        self.assertEqual(len(second['conversations']), 5)
        self.assertEqual(second['conversations'][-1]['title'], '问题0')
        # The one request still waiting for reconciliation is flagged on whichever page it lands.
        self.assertEqual(sum(item['issues'] for item in first['conversations'] + second['conversations']), 1)
        self.assertEqual(second['conversations'][-1]['issues'], 1)
        self.assertEqual(self.call('/api/ai/admin/conversations?q=bulk-3').json['total'], 1)

    def test_legacy_requests_show_without_the_customer_returning(self):
        # A request written before the archive existed only gains its link when its owner is
        # next touched. The audit log must not wait for that: it adopts the row on read, and
        # reading twice changes nothing.
        db.session.add(AIAccount(id='u:vip', history=[]))
        db.session.add(AIRequest(id='u:vip:legacy', account_id='u:vip', status='completed',
                                 message='旧报价', response={'reply': '旧回复', 'quote': None}))
        db.session.commit()
        first = self.call('/api/ai/admin/conversations').json
        self.assertEqual(first['total'], 1)
        self.assertEqual(first['conversations'][0]['title'], '旧报价')
        detail = self.call('/api/ai/admin/conversations/' + first['conversations'][0]['id']).json
        self.assertEqual([message['content'] for message in detail['messages']], ['旧报价', '旧回复'])
        again = self.call('/api/ai/admin/conversations').json
        self.assertEqual(again['total'], 1)
        self.assertEqual(again['conversations'][0]['messages'], 1)
        self.assertEqual(AIConversation.query.count(), 1)
