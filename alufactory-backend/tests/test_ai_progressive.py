import unittest
from app.ai_quote import quote_profile
from app.ai_review import build_review

class ProgressiveTest(unittest.TestCase):
    def row(self,**kwargs):
        return dict(model='2020',color='natural',length=1000,quantity=2,tapping='none',machining_confirmed=True,**kwargs)

    def test_missing_shipping_can_order_profiles_with_external_accessories(self):
        for accessories in ('none','self_purchase','later'):
            spec={**self.row(),'accessories':accessories,'clarifications':[{'stage':'shipping','field':'province','question':'发哪个省？'}]}
            _,q=quote_profile(spec,'standard')
            self.assertEqual(q['subtotal'],32)
            self.assertIsNone(q['shipping_fee'])
            self.assertEqual(q['total'],32)
            self.assertTrue(build_review(spec,q)['ready'])

    def test_partial_rows_keep_source_mapping_and_cannot_silently_order(self):
        spec={'items':[{'model':'2020','quantity':1}, self.row(holes=[{'side':'B','positionMm':50,'type':'through'}])], 'accessories':'self_purchase'}
        _,q=quote_profile(spec,'standard')
        self.assertTrue(q['partial'])
        self.assertEqual(q['items'][0]['source_index'],1)
        self.assertEqual(q['pending_items'][0]['index'],0)
        review=build_review(spec,q)
        self.assertFalse(review['ready'])
        self.assertEqual(review['items'][0]['holes'][0]['side'],'B')
        self.assertEqual(len(q['source_spec']['items']),2)

    def test_miter_complete_goes_to_review_missing_direction_still_previews(self):
        miter={'left':{'enabled':True,'side':'BD','direction':'down'},'right':{'enabled':False}}
        spec={**self.row(miter_cut=miter),'accessories':'later'}
        _,q=quote_profile(spec,'standard')
        self.assertEqual(q['subtotal'],34)
        review=build_review(spec,q)
        self.assertTrue(review['ready'])
        self.assertEqual(review['items'][0]['miter_cut']['left'],miter['left'])
        del miter['left']['direction']
        _,q=quote_profile(spec,'standard')
        self.assertEqual(q['subtotal'],34)
        review=build_review(spec,q)
        self.assertFalse(review['ready'])
        self.assertEqual(len(review['items']),1)
        self.assertIsNone(review['items'][0]['miter_cut'])

    def test_draft_or_requested_accessories_not_silently_confirmed(self):
        for change in ({'_visual_pending':True,'accessories':'none'},{'accessories':'pending'}):
            spec={**self.row(),**change}
            self.assertFalse(build_review(spec,quote_profile(spec,'standard')[1])['ready'])

    def test_unknown_tapping_cannot_become_no_tapping_order(self):
        spec={**self.row(),'tapping':None,'accessories':'self_purchase'}
        _,q=quote_profile(spec,'standard')
        self.assertEqual(q['subtotal'],32)
        self.assertFalse(build_review(spec,q)['ready'])

    def test_checkbox_acknowledges_configuration_but_never_invents_holes(self):
        from app.ai_review import confirmed_configuration
        spec={**self.row(),'_visual_pending':True,'machining_confirmed':False,'accessories':'pending'}
        q=quote_profile(spec,'standard')[1]
        self.assertTrue(build_review(spec,q)['can_confirm'])
        confirmed=confirmed_configuration(spec,profile_only=True)
        self.assertTrue(build_review(confirmed,quote_profile(confirmed,'standard')[1])['ready'])
        self.assertTrue(spec['_visual_pending'])
        confirmed['through_hole_count']=1
        self.assertFalse(build_review(confirmed,quote_profile(confirmed,'standard')[1])['ready'])

    def test_long_context_keeps_latest_complete_state_without_repeating_bom(self):
        import json
        from app.routes.ai_chat import compact_context
        state={'items':[self.row(source_row=i,holes=[{'side':'A','positionMm':i+10,'type':'through'}]) for i in range(60)],'clarifications':[{'stage':'order','question':'第7项孔在哪一面？'}]}
        history=[]
        for i in range(4):
            history += [{'role':'user','content':f'修改第{i+1}项'}, {'role':'assistant','content':json.dumps(state,ensure_ascii=False)}]
        compact=compact_context(history)
        self.assertGreater(len(json.dumps(history).encode()),24000)
        snapshots=[json.loads(h['content']) for h in compact if h['role']=='assistant']
        self.assertEqual(snapshots,[state])
        self.assertEqual(len(snapshots[0]['items']),60)
