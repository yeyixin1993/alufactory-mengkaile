import base64
import io
import json
import uuid
from unittest.mock import patch
from PIL import Image
import test_ai_chat as fixtures

class VisionTest(fixtures.unittest.TestCase):
    setUp = fixtures.AIChatTest.setUp
    tearDown = fixtures.AIChatTest.tearDown
    headers = fixtures.AIChatTest.headers
    status = fixtures.AIChatTest.status

    def request(self, message='请按图片报价', image=None, request_id=None):
        data = {'message': message, 'request_id': request_id or str(uuid.uuid4())}
        if image is not None:
            data['image'] = image
        return self.client.post('/api/ai/chat', json=data, headers=self.headers())

    def picture(self, color='pink'):
        out = io.BytesIO()
        Image.new('RGB', (40, 40), color).save(out, 'PNG')
        return 'data:image/png;base64,' + base64.b64encode(out.getvalue()).decode()

    @patch.dict('os.environ', {'AI_PROVIDER': 'deepseek', 'DEEPSEEK_API_KEY': 'test'})
    @patch('app.routes.ai_chat.provider_extract', return_value=(json.dumps(fixtures.SPEC), 100000, {}))
    def test_confirmation_corrections_replay(self, provider):
        key = str(uuid.uuid4())
        first = self.request(image=self.picture(), request_id=key)
        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.json['quote']['recognition_pending'])
        self.assertFalse(first.json['review']['ready'])
        self.assertTrue(first.json['needs_confirmation'])
        self.assertEqual(self.request(image=self.picture(), request_id=key).json, first.json)
        self.assertEqual(provider.call_count, 1)
        self.assertEqual(self.request(image=self.picture('red'), request_id=key).status_code, 409)
        correction = self.request('数量还是两根')
        self.assertTrue(correction.json['quote']['recognition_pending'])
        self.assertFalse(correction.json['review']['ready'])
        self.assertTrue(correction.json['needs_confirmation'])
        confirmed = self.request('确认以上识别信息')
        self.assertIsNotNone(confirmed.json['quote'])
        self.assertEqual(confirmed.json['charged_cny'], 0)
        self.assertEqual(provider.call_count, 2)
        self.assertFalse(self.status().json['needs_confirmation'])

    @patch('app.routes.ai_chat.provider_extract')
    def test_invalid_images_never_call_provider(self, provider):
        for value in ('https://example.com/a.jpg', 'data:image/png;base64,YWJj', {}, 'data:image/svg+xml;base64,YWJj'):
            self.assertEqual(self.request(image=value).status_code, 400)
        provider.assert_not_called()

    @patch('app.routes.ai_chat.provider_extract')
    def test_quote_price_uses_authenticated_membership(self, provider):
        from pathlib import Path
        spec = json.loads(Path(__file__).with_name('ai_multi_fixture.json').read_text())
        provider.return_value = (json.dumps(spec), 100000, {})
        for user, expected, level in [(None, 1065.1, 'standard'), ('standard', 1065.1, 'standard'), ('vip', 953.0, 'vip')]:
            response = self.client.post('/api/ai/chat', headers=self.headers(user) if user else {}, json={
                'message': '按清单报价，发天津', 'request_id': str(uuid.uuid4()),
                'membership': 'vip_plus', 'membership_level': 'vip_plus'})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json['quote']['total'], expected)
            self.assertEqual(response.json['quote']['membership'], level)
