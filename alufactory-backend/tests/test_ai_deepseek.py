import json
import unittest
from datetime import datetime
from unittest.mock import patch
import test_ai_chat as base_tests
SPEC = base_tests.SPEC
from app.ai_provider import BEIJING, deepseek_period, maximum_cost
from app.routes.ai_chat import provider_extract, configured
from app.models.user import db
from app.ai_models import AIAccount, AILedger


def stamp(value):
    return int(datetime.fromisoformat(value).replace(tzinfo=BEIJING).timestamp())


class DeepSeekTest(unittest.TestCase):
    setUp = base_tests.AIChatTest.setUp
    tearDown = base_tests.AIChatTest.tearDown
    headers = base_tests.AIChatTest.headers
    chat = base_tests.AIChatTest.chat
    status = base_tests.AIChatTest.status

    def response(self, timestamp):
        return {'id':'test-request','model':'deepseek-flash','created':timestamp,
            'usage':{'prompt_tokens':3000,'completion_tokens':500,'prompt_cache_hit_tokens':2000,'prompt_cache_miss_tokens':1000},
            'choices':[{'finish_reason':'stop','message':{'content':json.dumps(SPEC)}}]}

    @patch.dict('os.environ', {'AI_PROVIDER':'deepseek','DEEPSEEK_API_KEY':'fake-deepseek-key'})
    @patch('app.routes.ai_chat.urllib.request.urlopen')
    def test_payload_cost_and_ledger(self, upstream):
        now=stamp('2026-10-08T10:00:00')
        upstream.return_value.__enter__.return_value.read.return_value=json.dumps(self.response(now)).encode()
        with patch('app.routes.ai_chat.time.time',return_value=now):
            response=self.chat()
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json['charged_cny'],.006688)
        req=upstream.call_args.args[0]; payload=json.loads(req.data)
        self.assertEqual(req.full_url,'https://api.deepseek.com/chat/completions')
        self.assertEqual(payload['model'],'deepseek-flash')
        self.assertEqual(payload['thinking'],{'type':'disabled'})
        self.assertNotIn('enable_thinking',payload)
        self.assertEqual(payload['response_format'],{'type':'json_object'})
        row=AILedger.query.filter_by(kind='usage').one()
        self.assertEqual(row.detail['provider'],'deepseek')
        self.assertEqual(row.detail['usage']['billing']['period'],'peak')
        self.assertEqual(row.api_cost,608000)

    @patch.dict('os.environ', {'AI_PROVIDER':'deepseek','DEEPSEEK_API_KEY':'fake'})
    @patch('app.routes.ai_chat.urllib.request.urlopen')
    def test_holiday_cached_cost(self, upstream):
        now=stamp('2026-10-01T10:00:00')
        upstream.return_value.__enter__.return_value.read.return_value=json.dumps(self.response(now)).encode()
        with patch('app.routes.ai_chat.time.time',return_value=now):
            _,cost,usage=provider_extract([],'2020粉色')
        self.assertEqual(cost,304000)
        self.assertEqual(usage['billing']['period'],'off_peak')

    def test_calendar_boundaries(self):
        for dt,period in [('2026-10-08T08:59:59','off_peak'),('2026-10-08T09:00:00','peak'),('2026-10-08T12:00:00','off_peak'),('2026-10-08T14:00:00','peak'),('2026-10-08T18:00:00','off_peak'),('2026-10-10T10:00:00','off_peak')]:
            self.assertEqual(deepseek_period(stamp(dt)),period)
        with self.assertRaises(RuntimeError):deepseek_period(stamp('2027-01-01T10:00:00'))

    @patch.dict('os.environ', {'AI_PROVIDER':'deepseek','DEEPSEEK_API_KEY':'fake'})
    @patch('app.routes.ai_chat.urllib.request.urlopen')
    def test_bad_usage_truncation_and_boundary_no_debit(self, upstream):
        now=stamp('2026-10-08T10:00:00')
        cases=[]
        bad=self.response(now);bad['usage']['prompt_cache_miss_tokens']=3000;cases.append(bad)
        bad=self.response(now);bad['choices'][0]['finish_reason']='length';cases.append(bad)
        cases.append(self.response(stamp('2026-10-08T11:59:50')))
        for index,result in enumerate(cases,1):
            upstream.return_value.__enter__.return_value.read.return_value=json.dumps(result).encode()
            with patch('app.routes.ai_chat.time.time',return_value=result['created']):
                response=self.chat(index=index)
            self.assertEqual(response.json['charged_cny'],0)
            self.assertEqual(self.status().json['balance_cny'],10)
            self.assertIsNone(db.session.get(AIAccount,'u:vip').busy)

    @patch.dict('os.environ', {'AI_PROVIDER':'deepseek','DEEPSEEK_API_KEY':'fake'})
    @patch('app.routes.ai_chat.urllib.request.urlopen')
    def test_reserve_blocks_underfunded_call(self, upstream):
        self.status();db.session.get(AIAccount,'u:vip').balance=1000000;db.session.commit()
        self.assertEqual(self.chat().status_code,409)
        upstream.assert_not_called()
        self.assertEqual(str(maximum_cost()),'0.0704')

    @patch.dict('os.environ', {'AI_PROVIDER':'deepseek','DEEPSEEK_API_KEY':'fake'})
    @patch('app.routes.ai_chat.urllib.request.urlopen', side_effect=TimeoutError())
    def test_timeout_does_not_charge(self, upstream):
        result = self.chat()
        self.assertEqual(result.json['charged_cny'], 0)
        self.assertEqual(self.status().json['balance_cny'], 10)
        self.assertIsNone(db.session.get(AIAccount,'u:vip').busy)

    def test_explicit_selection_and_no_key(self):
        with patch.dict('os.environ',{'AI_PROVIDER':'deepseek','DEEPSEEK_API_KEY':''}):
            self.assertFalse(configured())
            self.assertEqual(self.chat('standard').status_code,503)
        with patch.dict('os.environ',{'AI_PROVIDER':'typo'}):self.assertFalse(configured())

if __name__=='__main__':unittest.main()
