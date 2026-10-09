import json
import re
import unittest
from pathlib import Path
from unittest.mock import patch
from flask import Flask
from flask_jwt_extended import JWTManager, create_access_token
from app.models.user import db, User
from app.ai_models import AIAccount, AISettings, AILedger, AIFaqRule
from app.ai_faq import seed_faq_rules, match_faq, serialize_rule, normalize_question, LEGACY_DRAFTS
from app.routes.ai_chat import ai_bp


class FAQTest(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(TESTING=True, SECRET_KEY='faq-test-secret', JWT_SECRET_KEY='faq-test-jwt-secret-more-than-32-characters', SQLALCHEMY_DATABASE_URI='sqlite:///:memory:')
        db.init_app(self.app)
        JWTManager(self.app)
        self.app.register_blueprint(ai_bp)
        self.ctx = self.app.app_context()
        self.ctx.push()
        db.create_all()
        seed_faq_rules()
        for uid, level in [('vip','vip'), ('standard','standard'), ('admin','standard')]:
            db.session.add(User(id=uid, username=uid, phone=uid, password_hash='x', membership_level=level, is_admin=uid=='admin'))
        db.session.add(AISettings(id=1, enabled=True, markup_bps=1000))
        db.session.commit()
        self.client = self.app.test_client()
        self.env = patch.dict('os.environ', {'AI_PROVIDER': 'qwen', 'DASHSCOPE_API_KEY':'', 'AI_QWEN_BASE_URL':''})
        self.env.start()

    def tearDown(self):
        self.env.stop()
        db.session.remove()
        db.drop_all()
        self.ctx.pop()

    def headers(self, uid='admin'):
        return {'Authorization':'Bearer '+create_access_token(identity=uid)}

    def send(self, text, uid='vip', index=1):
        return self.client.post('/api/ai/chat', headers=self.headers(uid), json={'message':text, 'request_id':f'00000000-0000-4000-8000-{index:012d}'})

    def test_seed_and_exact_matching(self):
        self.assertEqual(AIFaqRule.query.count(),36)
        self.assertEqual(AIFaqRule.query.filter_by(enabled=True).count(),36)
        self.assertEqual(match_faq('  两端攻丝是什么意思？ ').id,'machining-tapping')
        self.assertEqual(match_faq('什么叫两端攻丝').id,'machining-tapping')
        self.assertIsNone(match_faq('不要两端攻丝是什么意思'))
        self.assertIsNone(match_faq('两端攻丝是什么意思，另外我要100根'))
        self.assertEqual(match_faq('  截面本色/彩色是什么意思？ ').id,'color-section-meaning')
        self.assertEqual(match_faq('截面本色是什么意思').id,'color-section-meaning')
        self.assertIn('3–5 个工作日', match_faq('多久发货').answer)
        self.assertNotEqual(normalize_question('1.5mm'), normalize_question('15mm'))
        self.assertNotEqual(normalize_question('两端攻丝是什么意思，另外我要100根'), normalize_question('两端攻丝是什么意思'))
        response = self.client.get('/api/ai/admin/faq', headers={**self.headers(), 'Content-Type':'application/json'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json['rules']), 36)

    def test_home_suggestion_chips_have_verified_answers(self):
        # The three chips under the home-page composer must be exact FAQ hits.
        # A chip without a rule silently falls through to the paid model instead.
        source = (Path(__file__).resolve().parents[2] / 'components' / 'AIChatBar.tsx').read_text(encoding='utf-8')
        chips = re.search(r'ai-entry-suggestions.*?\[([^\]]+)\]', source, re.S)
        self.assertIsNotNone(chips, '首页引导词列表不见了，请同步本用例')
        questions = re.findall(r"'([^']+)'", chips.group(1))
        self.assertEqual(len(questions), 3)
        for question in questions:
            rule = match_faq(question)
            self.assertIsNotNone(rule, f'首页引导词没有已核实答案：{question}')
            self.assertTrue(rule.enabled)

    @patch('app.routes.ai_chat.provider_extract')
    def test_local_answer_without_provider_and_idempotency(self, provider):
        first=self.send('两端攻丝是什么意思')
        self.assertEqual(first.status_code,200)
        self.assertEqual(first.json['source'],'faq')
        self.assertEqual(first.json['charged_cny'],0)
        self.assertEqual(self.send('两端攻丝是什么意思').json,first.json)
        provider.assert_not_called()
        self.assertEqual(AILedger.query.filter_by(kind='faq').count(),1)
        self.assertEqual(AILedger.query.filter_by(kind='faq').first().api_cost,0)
        self.assertEqual(db.session.get(AIAccount,'u:vip').balance,10*100_000_000)

    def test_three_messages_still_apply_to_local_answers(self):
        for i in range(1,4):
            self.assertEqual(self.send('两端攻丝是什么意思','standard',i).status_code,200)
        self.assertEqual(self.send('两端攻丝是什么意思','standard',4).status_code,409)
        self.assertEqual(db.session.get(AIAccount,'u:standard').trial_used,3)

    def test_admin_access_and_live_edit_disable(self):
        url='/api/ai/admin/faq/machining-tapping'
        rule=serialize_rule(db.session.get(AIFaqRule,'machining-tapping'))
        rule['answer']='新的已核实回答'
        self.assertEqual(self.client.post(url,json=rule,headers=self.headers('vip')).status_code,403)
        result=self.client.post(url,json=rule,headers=self.headers())
        self.assertEqual(result.status_code,200)
        self.assertEqual(self.send('两端攻丝是什么意思').json['reply'],'新的已核实回答')
        self.assertEqual(self.client.post(url,json=rule,headers=self.headers()).status_code,409)
        updated=result.json['rule']; updated['enabled']=False
        self.assertEqual(self.client.post(url,json=updated,headers=self.headers()).status_code,200)
        self.assertEqual(self.send('两端攻丝是什么意思',index=2).status_code,503)
        seed_faq_rules()
        stored=db.session.get(AIFaqRule,'machining-tapping')
        self.assertEqual(stored.answer,'新的已核实回答')
        self.assertFalse(stored.enabled)

    def test_add_preview_and_duplicate_alias_rejected(self):
        rule=dict(version=0,category='测试',question='测试新问法',aliases=['测试另一个问法'],answer='测试答案',enabled=True,source='测试',notes='只供内部')
        self.assertEqual(self.client.post('/api/ai/admin/faq/new-test',json=rule,headers=self.headers()).status_code,200)
        preview=self.client.post('/api/ai/admin/faq/preview',json={'message':'测试另一个问法？'},headers=self.headers())
        self.assertTrue(preview.json['matched'])
        self.assertEqual(preview.json['rule']['answer'],'测试答案')
        self.assertEqual(AIAccount.query.count(),0)
        self.assertEqual(self.client.post('/api/ai/admin/faq/duplicate',json=rule,headers=self.headers()).status_code,400)
        rule.update(enabled=False,question='草稿新问法')
        self.assertEqual(self.client.post('/api/ai/admin/faq/draft-test',json=rule,headers=self.headers()).status_code,200)
        self.assertIsNone(match_faq('草稿新问法'))
        answer=self.send('测试新问法').json
        self.assertNotIn('notes',answer)
        self.assertNotIn('source',answer['reply'])

    def test_ambiguous_rules_fail_closed_and_switches_apply(self):
        original=db.session.get(AIFaqRule,'machining-tapping')
        db.session.add(AIFaqRule(id='race',category='test',question=original.question,aliases=[],answer='conflict',enabled=True))
        db.session.commit()
        self.assertIsNone(match_faq(original.question))
        db.session.get(AISettings,1).enabled=False;db.session.commit()
        self.assertEqual(self.send('2020是什么意思').status_code,503)

    def test_miss_does_not_consume_trial_when_no_provider(self):
        self.assertEqual(self.send('尚未收录的问题','standard').status_code,503)
        self.assertEqual(db.session.get(AIAccount,'u:standard').trial_used,0)

    def test_policy_upgrade_preserves_admin_edits(self):
        for legacy in LEGACY_DRAFTS:
            rule = db.session.get(AIFaqRule, legacy['id'])
            for key, value in legacy.items():
                setattr(rule, key, value)
            rule.version = 1
            rule.updated_by = 'seed'
        edited = db.session.get(AIFaqRule, 'draft-invoice')
        edited.answer = '管理员自己的开票回答'
        edited.version = 2
        edited.updated_by = 'admin'
        db.session.commit()
        seed_faq_rules()
        self.assertTrue(match_faq('多久发货').enabled)
        self.assertEqual(db.session.get(AIFaqRule, 'draft-leadtime').version, 2)
        self.assertEqual(edited.answer, '管理员自己的开票回答')
        self.assertFalse(edited.enabled)
        seed_faq_rules()
        self.assertEqual(db.session.get(AIFaqRule, 'draft-leadtime').version, 2)
        self.assertIsNone(match_faq('打孔公差是多少'))

    def test_confirmed_refund_and_forwarding_answers(self):
        refund = self.send('余额可以提现吗').json['reply']
        self.assertIn('未使用的实际充值余额', refund)
        self.assertIn('赠送额度不支持', refund)
        delivery = self.send('海外能发货吗', index=2).json['reply']
        self.assertIn('不代表包邮', delivery)
        self.assertIn('转运仓所在省份', delivery)
        self.assertIn('运费价格模板', delivery)

    def test_previous_pending_policy_upgrade(self):
        for legacy in LEGACY_DRAFTS[-2:]:
            rule = db.session.get(AIFaqRule, legacy['id'])
            for key, value in legacy.items():
                setattr(rule, key, value)
            rule.version = 2
            rule.updated_by = 'seed-policy-2026-10-03'
        db.session.commit()
        seed_faq_rules()
        for key in ('draft-recharge-refund', 'draft-delivery-area'):
            rule = db.session.get(AIFaqRule, key)
            self.assertTrue(rule.enabled)
            self.assertEqual(rule.version, 3)
        seed_faq_rules()
        self.assertEqual(db.session.get(AIFaqRule, 'draft-delivery-area').version, 3)

    def test_assembly_policy(self):
        self.assertEqual(self.send('包含组装服务吗').json['reply'], '不含组装服务。')
        self.assertIsNone(match_faq('可以买成品吗'))
        self.assertIsNone(match_faq('提供安装服务吗'))

    def test_policy_template_must_be_filled_before_publishing(self):
        rule=serialize_rule(db.session.get(AIFaqRule,'draft-assembly'))
        rule['answer']=next(r['answer'] for r in LEGACY_DRAFTS if r['id']=='draft-assembly')
        rule['enabled']=True
        self.assertEqual(self.client.post('/api/ai/admin/faq/draft-assembly',json=rule,headers=self.headers()).status_code,400)


if __name__ == '__main__':
    unittest.main()
