import unittest
from app.ai_quote import normalize_extracted_spec, quote_profile
from app.ai_review import build_review
from app.routes.ai_chat import visual_reply

class ClarificationTest(unittest.TestCase):
    def test_silver_aliases(self):
        base = dict(model='2020', length=1000, quantity=1, province='天津', tapping='none', section='natural')
        _, natural = quote_profile({**base, 'color': 'natural'}, 'standard')
        for color in ('银色', '本色', '原色', '银白', '银白色'):
            spec = normalize_extracted_spec({**base, 'color': color})
            self.assertEqual(spec['color'], 'natural')
            reply, quote = quote_profile(spec, 'standard')
            self.assertEqual(quote['subtotal'], natural['subtotal'])
            self.assertNotIn('需要什么颜色', reply)
            batch = normalize_extracted_spec({'items': [{**base, 'color': color}]})
            self.assertEqual(batch['items'][0]['color'], 'natural')
        for color in ('亮银色', 'silver'):
            spec = normalize_extracted_spec({**base, 'color': color})
            self.assertEqual(spec['color'], 'silver')
            _, bright = quote_profile(spec, 'standard')
            self.assertGreater(bright['subtotal'], natural['subtotal'])
        marine = normalize_extracted_spec({'product': 'marine_board', 'color': '原色'})
        self.assertEqual(marine['color'], '原色')
        colored = normalize_extracted_spec({**base, 'color': 'purple', 'source_notes': '紫色，截面本色'})
        self.assertEqual(colored['color'], 'purple')

    def test_annotation_and_split_rows(self):
        spec=normalize_extracted_spec({'items':[
            {'source_row':3,'model':'2020','length':1000,'quantity':1,'source_notes':'邻边封槽，一根A面'},
            {'source_row':3,'model':'2020','length':1000,'quantity':1,'source_notes':'邻边封槽，一根B面'},
            {'source_row':8,'color':'silver','source_notes':'银色'}]})
        self.assertEqual(len(spec['items']),2)
        self.assertEqual([r['model'] for r in spec['items']],['2020-N2']*2)
        reply=visual_reply(spec)
        self.assertIn('全部型材',reply)
        self.assertNotIn('还是亮银', reply)
        self.assertNotIn('?mm',reply)
        self.assertNotIn('确认以上识别信息',reply)

    def test_multiport_question_and_quote_counts(self):
        row={'model':'2040-N1-40','color':'natural','length':360,'quantity':2,'province':'天津','tapping':'both'}
        spec=normalize_extracted_spec({'items':[row]})
        reply,q=quote_profile(spec,'standard')
        self.assertIsNotNone(q)
        self.assertFalse(build_review(spec,q)['ready'])
        self.assertIn('2 个攻丝孔位',reply)
        self.assertNotIn('编辑器',reply)
        spec['clarifications']=[]
        row['tapping_ports']={'left':[True,True],'right':[True,True]}
        _,q=quote_profile(spec,'standard')
        self.assertIsNotNone(q)
        row['tapping_ports']={'left':[True,False],'right':[True,False]}
        _,partial=quote_profile(spec,'standard')
        self.assertEqual(round(q['subtotal']-partial['subtotal'],1),6)
        row['tapping_ports']['right']=[False,False]
        self.assertFalse(build_review(spec,quote_profile(spec,'standard')[1])['ready'])

    def test_order_questions_do_not_block_estimate_but_block_cart(self):
        spec={'model':'2020','color':'natural','length':500,'quantity':1,'province':'天津','tapping':'none',
              'machining_confirmed':True,'accessories':'none','order_review':True,
              'clarifications':[{'stage':'order','question':'孔位从哪端量？'}]}
        _,q=quote_profile(spec,'standard')
        self.assertIsNotNone(q)
        review=build_review(spec,q)
        self.assertFalse(review['ready'])
        self.assertIn('孔位从哪端量？',review['questions'])

    def test_hole_list_cannot_lose_its_price_when_model_omits_count(self):
        spec={'model':'2020-N2','color':'natural','length':1000,'quantity':2,'province':'天津','tapping':'both',
              'holes':[{'side':'A','positionMm':None,'type':'through'}]}
        _,q=quote_profile(spec,'standard')
        self.assertEqual(q['spec']['through_hole_count'],1)
        self.assertEqual(q['subtotal'],44)
