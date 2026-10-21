import unittest
from unittest.mock import patch
from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from app.models.user import db, User
from app.ai_models import AIAccount, AISettings, AILedger, AIFaqRule, AIKnowledgeMiss
from app.ai_faq import seed_faq_rules, match_faq, serialize_rule
from app.ai_knowledge import pick, rank, normalize_question, AUTO_ANSWER
from app.routes.ai_chat import ai_bp


class KnowledgeTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(TESTING=True, SECRET_KEY='knowledge-test-secret',
                               JWT_SECRET_KEY='knowledge-test-jwt-secret-more-than-32-characters',
                               SQLALCHEMY_DATABASE_URI='sqlite:///:memory:')
        db.init_app(self.app)
        JWTManager(self.app)
        self.app.register_blueprint(ai_bp)
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        seed_faq_rules()
        for uid, level in [('vip', 'vip'), ('standard', 'standard'), ('admin', 'standard')]:
            db.session.add(User(id=uid, username=uid, phone=uid, password_hash='x',
                                membership_level=level, is_admin=uid == 'admin'))
        db.session.add(AISettings(id=1, enabled=True, markup_bps=1000))
        db.session.commit()
        self.client = self.app.test_client()
        # No provider: any path that reaches the model must surface as 503, which is
        # how these tests tell "answered from the library" apart from "handed over".
        self.env = patch.dict('os.environ', {'AI_PROVIDER': 'qwen', 'DASHSCOPE_API_KEY': '', 'AI_QWEN_BASE_URL': ''})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def headers(self, uid='admin'):
        return {'Authorization': 'Bearer ' + create_access_token(identity=uid)}

    def send(self, text, uid='vip', index=1):
        return self.client.post('/api/ai/chat', headers=self.headers(uid),
                                json={'message': text, 'request_id': f'00000000-0000-4000-8000-{index:012d}'})

    def add_rule(self, rule_id, category, question, aliases=(), enabled=True):
        db.session.add(AIFaqRule(id=rule_id, category=category, question=question, aliases=list(aliases),
                                 answer='测试答案', enabled=enabled, notes='', source='test'))
        db.session.commit()

    def test_exact_hit_is_still_reported_as_exact(self):
        response = self.send('两端攻丝是什么意思')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['source'], 'faq')
        self.assertEqual(response.json['rule_id'], 'machining-tapping')

    def test_untyped_wording_is_recalled_for_free(self):
        self.assertIsNone(match_faq('两端攻丝是啥意思'))
        response = self.send('两端攻丝是啥意思')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['source'], 'knowledge')
        self.assertEqual(response.json['rule_id'], 'machining-tapping')
        self.assertEqual(response.json['charged_cny'], 0)
        ledger = AILedger.query.filter_by(kind='faq').one()
        self.assertEqual(ledger.detail['match'], 'recalled')
        self.assertEqual(ledger.api_cost, 0)

    def test_recall_needs_a_clear_winner(self):
        self.add_rule('dup-warranty', '售后政策', '保修多久')
        self.add_rule('dup-warranty-2', '售后政策', '保修多久')
        self.assertIsNone(pick('保修多久'))

    def test_money_categories_are_never_recalled(self):
        self.add_rule('price-per-meter', '报价咨询', '一米型材多少钱')
        self.assertEqual(rank('一米型材多少钱啊')[0][0].id, 'price-per-meter')
        self.assertGreaterEqual(rank('一米型材多少钱啊')[0][1], AUTO_ANSWER)
        self.assertIsNone(pick('一米型材多少钱啊'))
        # Same wording, safe category: the guard is the only thing that changed.
        db.session.get(AIFaqRule, 'price-per-meter').category = '型材规格'
        db.session.commit()
        self.assertEqual(pick('一米型材多少钱啊').id, 'price-per-meter')

    def test_disabled_rule_is_not_recalled(self):
        self.add_rule('draft-acrylic', '材质', '能做亚克力板吗', enabled=False)
        self.assertIsNone(pick('能做亚克力板吗啊'))

    def test_unanswered_question_is_recorded_once(self):
        self.assertEqual(self.send('你们能做亚克力板吗').status_code, 503)
        row = AIKnowledgeMiss.query.one()
        self.assertEqual(row.count, 1)
        self.assertEqual(row.status, 'open')
        self.assertEqual(row.last_source, 'no-provider')
        self.send('你们能做亚克力板吗', index=2)
        self.send('  你们能做亚克力板吗？ ', index=3)
        row = AIKnowledgeMiss.query.one()
        self.assertEqual(row.count, 3)
        self.assertEqual(row.candidates, [])

    def test_quote_request_does_not_pollute_the_miss_queue(self):
        self.assertEqual(self.send('2020 1米 10根').status_code, 503)
        self.assertEqual(AIKnowledgeMiss.query.count(), 0)

    def test_admin_sees_and_dismisses_misses(self):
        self.send('你们能做亚克力板吗')
        listing = self.client.get('/api/ai/admin/knowledge/misses', headers=self.headers()).json
        self.assertEqual(listing['open_total'], 1)
        self.assertEqual(listing['asked_total'], 1)
        self.assertEqual(listing['misses'][0]['question'], '你们能做亚克力板吗')
        miss_id = listing['misses'][0]['id']
        self.assertEqual(self.client.get('/api/ai/admin/knowledge/misses',
                                         headers=self.headers('vip')).status_code, 403)
        saved = self.client.post(f'/api/ai/admin/knowledge/misses/{miss_id}',
                                 json={'status': 'ignored'}, headers=self.headers())
        self.assertEqual(saved.status_code, 200)
        self.assertEqual(self.client.get('/api/ai/admin/knowledge/misses',
                                         headers=self.headers()).json['open_total'], 0)
        self.assertEqual(self.client.post(f'/api/ai/admin/knowledge/misses/{miss_id}',
                                          json={'status': 'open'}, headers=self.headers()).status_code, 200)

    def test_preview_reports_recall_and_suggestions(self):
        result = self.client.post('/api/ai/admin/faq/preview', json={'message': '两端攻丝是啥意思'},
                                  headers=self.headers()).json
        self.assertFalse(result['matched'])
        self.assertEqual(result['recalled']['id'], 'machining-tapping')
        self.assertEqual(result['suggestions'][0]['id'], 'machining-tapping')
        self.assertTrue(result['suggestions'][0]['would_answer'])
        exact = self.client.post('/api/ai/admin/faq/preview', json={'message': '两端攻丝是什么意思'},
                                headers=self.headers()).json
        self.assertTrue(exact['matched'])
        self.assertIsNone(exact['recalled'])
        self.assertFalse(exact['suggestions'][0]['would_answer'])

    def test_normalized_duplicate_wording_shares_one_row(self):
        self.assertEqual(normalize_question('ABC 是什么？'), normalize_question('abc是什么'))
        self.assertNotEqual(normalize_question('不要攻丝'), normalize_question('要攻丝'))


if __name__ == '__main__':
    unittest.main()
