import unittest,uuid
import test_ai_chat as fixture
from app.ai_models import AILedger,SCALE
from app.models.user import db
class RechargeAdminTests(unittest.TestCase):
    setUp=fixture.AIChatTest.setUp
    tearDown=fixture.AIChatTest.tearDown
    headers=fixture.AIChatTest.headers
    def test_records_and_cash_totals(self):
        rows=[('recharge',100,{'method':'alipay','trade_no':'payment-1'}),('manual',50,{'method':'wechat','reason':'微信交易号'}),('manual',20,{'reason':'旧赠送'}),('grant',10,{}),('usage',-1,{})]
        for i,(kind,amount,detail) in enumerate(rows):db.session.add(AILedger(id=str(i),account_id='u:vip',kind=kind,delta=amount*SCALE,detail=detail))
        db.session.commit()
        url='/api/ai/admin/recharges'
        self.assertEqual(self.client.get(url,headers=self.headers('vip')).status_code,403)
        result=self.client.get(url,headers=self.headers('admin'))
        self.assertEqual(result.status_code,200,result.json)
        self.assertEqual(result.json['paid_cny'],150)
        self.assertEqual(result.json['paid_count'],2)
        self.assertEqual(result.json['total'],3)
        result=self.client.get(url+'?method=adjustment',headers=self.headers('admin')).json
        self.assertEqual(result['total'],1);self.assertEqual(result['paid_cny'],0)
        result=self.client.get(url+'?q=not-a-customer',headers=self.headers('admin')).json
        self.assertEqual(result['total'],0)
        result=self.client.get(url+'?method=wechat&q=vip',headers=self.headers('admin')).json
        self.assertEqual(result['paid_cny'],50)
    def test_manual_wechat_and_idempotency(self):
        payload={'operation_id':str(uuid.uuid4()),'delta_cny':100,'reason':'微信收款单号123','payment_method':'wechat','enabled':True,'trial_limit':3}
        url='/api/ai/admin/users/vip'
        self.assertEqual(self.client.post(url,json=payload,headers=self.headers('admin')).status_code,200)
        self.client.post(url,json=payload,headers=self.headers('admin'))
        self.assertEqual(AILedger.query.filter_by(kind='manual').count(),1)
        result=self.client.get('/api/ai/admin/recharges',headers=self.headers('admin')).json
        self.assertEqual(result['paid_cny'],100)
        payload.update(operation_id=str(uuid.uuid4()),delta_cny=-1)
        self.assertEqual(self.client.post(url,json=payload,headers=self.headers('admin')).status_code,400)
    def test_wechat_application_lifecycle(self):
        from app.ai_models import AIWechatApplication, AIAccount
        payload={'operation_id':str(uuid.uuid4()),'amount_cny':20.5,'phone':'13812345678','wechat_id':''}
        url='/api/ai/wechat-applications'
        self.assertEqual(self.client.post(url,json=payload).status_code,401)
        r=self.client.post(url,json=payload,headers=self.headers('vip'))
        self.assertEqual(r.status_code,201,r.json)
        self.assertTrue(r.json['record']['created_at'])
        self.assertEqual(AIAccount.query.get('u:vip').balance,0)
        self.assertEqual(self.client.post(url,json=payload,headers=self.headers('vip')).status_code,200)
        self.assertEqual(AIWechatApplication.query.count(),1)
        self.assertEqual(self.client.get(url,headers=self.headers('standard')).json['records'],[])
        review='/api/ai/admin/wechat-applications/'+payload['operation_id']+'/review'
        self.assertEqual(self.client.post(review,json={'decision':'approve','trade_no':'wx-1'},headers=self.headers('vip')).status_code,403)
        self.assertEqual(self.client.post(review,json={'decision':'approve','trade_no':'wx-1'},headers=self.headers('admin')).status_code,200)
        self.assertEqual(self.client.post(review,json={'decision':'approve','trade_no':'wx-1'},headers=self.headers('admin')).status_code,409)
        db.session.expire_all()
        self.assertEqual(AIAccount.query.get('u:vip').balance,int(20.5*SCALE))
        self.assertEqual(self.client.get(url,headers=self.headers('vip')).json['records'][0]['status'],'credited')
        payload['operation_id']=str(uuid.uuid4());payload['wechat_id']='my_wechat'
        self.client.post(url,json=payload,headers=self.headers('vip'))
        review='/api/ai/admin/wechat-applications/'+payload['operation_id']+'/review'
        self.assertEqual(self.client.post(review,json={'decision':'approve','trade_no':'wx-1'},headers=self.headers('admin')).status_code,409)
        db.session.expire_all()
        self.assertEqual(db.session.get(AIWechatApplication,payload['operation_id']).status,'pending')
        self.assertEqual(self.client.post(review,json={'decision':'reject','note':'未找到收款'},headers=self.headers('admin')).status_code,200)
        self.assertEqual(self.client.get('/api/ai/admin/recharges',headers=self.headers('admin')).json['paid_cny'],20.5)
        self.assertEqual(self.client.get('/api/ai/admin/wechat-applications',headers=self.headers('admin')).json['records'][0]['wechat_id'],'my_wechat')

    def test_recharge_amount_validation(self):
        from app.routes.ai_chat import recharge_amount
        for value in [10,20,50,100,300,500,'99.99']:
            self.assertEqual(recharge_amount(value),round(float(value)*100))
        for value in [0,-1,'NaN','Infinity',100001,'1.001',True]:
            with self.assertRaises(ValueError):recharge_amount(value)
        payload={'operation_id':str(uuid.uuid4()),'amount_cny':10,'phone':'13812345678'}
        self.assertEqual(self.client.post('/api/ai/wechat-applications',json=payload,headers=self.headers('vip')).status_code,201)
        payload['amount_cny']=20
        self.assertEqual(self.client.post('/api/ai/wechat-applications',json=payload,headers=self.headers('vip')).status_code,409)
