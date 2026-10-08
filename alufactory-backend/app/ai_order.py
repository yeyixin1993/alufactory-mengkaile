"""Validated cart configurations for AI quotes; client prices are never trusted."""
import copy
from app.ai_quote import CATALOG, quote_profile
from app.ai_material_quote import product_kind
from app.ai_review import build_review

PRODUCT_IDS = {'profile':'p2','aluminum_plate':'p5','pegboard':'p1','marine_board':'p6','cabinet_door':'p3','frame':'p4'}

def apply_configuration(original, config, quantity):
    if not isinstance(config, dict) or type(quantity) is not int or not 1 <= quantity <= 10000:
        raise ValueError('请检查配置及数量。')
    row = copy.deepcopy(original)
    kind = product_kind(row)
    if kind not in PRODUCT_IDS: raise ValueError('此项请先在对应商品模块确认配置。')
    row.update(product=kind, quantity=quantity)
    if kind == 'profile':
        holes,taps,miter=config.get('holes'),config.get('tapping'),config.get('miterCut')
        if not isinstance(holes,list) or len(holes)>100 or any(not isinstance(h,dict) for h in holes) or not isinstance(taps,dict) or any(not isinstance(taps.get(end),list) or len(taps[end])>20 or any(type(v) is not bool for v in taps[end]) for end in ('left','right')):
            raise ValueError('请检查型材孔位和攻丝配置。')
        if miter is not None and (not isinstance(miter,dict) or any(not isinstance(miter.get(e),dict) or type(miter[e].get('enabled')) is not bool for e in ('left','right'))): raise ValueError('斜切配置不正确。')
        row.update(model=config.get('variantId'),color=config.get('colorId'),length=config.get('length'),section='colored' if config.get('finish')=='powder' else 'natural',holes=holes,tapping_ports=taps,
            tapping={(False,False):'none',(True,False):'left',(False,True):'right',(True,True):'both'}[(any(taps['left']),any(taps['right']))],miter_cut=miter,
            miter45_count=sum(miter[e]['enabled'] for e in ('left','right')) if miter else 0,machining_confirmed=True,remark=str(config.get('remark') or '')[:1000])
        for field,kind_name in [('through_hole_count','through'),('countersunk_count','countersunk'),('threaded_hole_count','threaded')]: row[field]=sum(h.get('type')==kind_name for h in holes)
    elif kind == 'frame':
        row.update(frame_type=config.get('frameType'),inner_width=config.get('innerWidth'),inner_height=config.get('innerHeight'),color=config.get('colorId'))
        if row['color'] not in {c['id'] for c in CATALOG['colors']}: raise ValueError('请选择相框颜色。')
    else:
        row.update(width=config.get('width'),height=config.get('height'),thickness=config.get('thickness'),color=config.get('colorId'))
        if kind=='marine_board':
            row['marine_spec']=config.get('marineSpecId')
            if row['color']=='wood_natural': row['color']='natural'
            choices={c['id'] for c in CATALOG['marineColors']}|{'natural'}
        else: choices={c['id'] for c in CATALOG['colors']}
        if row['color'] not in choices: raise ValueError('请选择目录中的颜色。')
        if kind=='cabinet_door':
            if config.get('openingSide') not in ('left','right'): raise ValueError('请选择左开或右开。')
            row['opening_side']=config['openingSide']
            if row['thickness']!=2: raise ValueError('铝框门使用2mm门板。')
        min_w=101 if kind in ('pegboard','cabinet_door') else 1
        min_h=230 if kind=='cabinet_door' else 101 if kind=='pegboard' else 1
        if type(row['width']) is not int or type(row['height']) is not int or row['width']<min_w or row['height']<min_h: raise ValueError(f'请填写有效尺寸：宽至少{min_w}mm，高至少{min_h}mm。')
    row.pop('unsupported',None)
    return row

def cart_configuration(row, membership):
    # Per-item validation is independent of unresolved questions on other rows.
    clean=copy.deepcopy(row)
    clean.pop('clarifications',None)
    reply,q=quote_profile(clean,membership)
    if not q or q.get('partial'): raise ValueError(reply)
    priced=q['items'][0];s=priced['spec'];kind=product_kind(s)
    if kind=='profile':
        review=build_review({**clean,'machining_confirmed':True,'accessories':'none'},q)
        if not review or review['blocking_questions']: raise ValueError('；'.join((review or {}).get('blocking_questions',[])) or '型材配置未完整。')
        r=review['items'][0]
        cfg={'variantId':s['model'],'colorId':s['color'],'length':s['length'],'finish':'oxidized' if s['color']=='natural' else 'powder' if s.get('section')=='colored' else 'electrophoretic','holes':r['holes'],'tapping':s.get('tapping_ports'),'miterCut':r['miter_cut'],'remark':s.get('remark',''),'unitPrice':priced['unit_price']}
    elif kind=='frame':
        cfg={'frameType':s['frame_type'],'innerWidth':s['inner_width'],'innerHeight':s['inner_height'],'width':s['inner_width'],'height':s['inner_height'],'colorId':s['color'],'unitPrice':priced['unit_price']}
    else:
        cfg={'width':s['width'],'height':s['height'],'thickness':s['thickness'],'colorId':'wood_natural' if kind=='marine_board' and s['color']=='natural' else s['color'],'unitPrice':priced['unit_price'],'areaSqm':priced['area_sqm'],'chargedArea':priced['charged_area_sqm'],'minAreaApplied':priced['min_area_applied']}
        colors=CATALOG['marineColors'] if kind=='marine_board' else CATALOG['colors']
        cfg['colorName']=next((c['name']['cn'] for c in colors if c['id']==cfg['colorId']),cfg['colorId'])
        if kind=='marine_board':
            cfg.update(marineSpecId=s['marine_spec'],marineSpecName='BBB素板' if s['marine_spec']=='marine_bbb_plain' else 'BBB两面UV清漆+覆膜')
        if kind=='pegboard':cfg.update(pegHolePattern='ikea',pegHolePatternName='宜家孔（竖向长圆孔）')
        if kind=='cabinet_door':
            h=s['height'];n=priced['hinge_count']
            positions=[100+(h-200)*i/(n-1) for i in range(n)]
            side=s['opening_side']
            cfg.update(openingSide=side,panelThickness=2,frameThickness=18,handleLength=200,handlePosition='right_center' if side=='left' else 'left_center',hingeSide=side,hingePositions=positions,hingeCount=n,hingeUnitPrice=CATALOG['quickQuote']['DOOR_HINGE_UNIT_PRICE'],hingeFeePerPiece=n*CATALOG['quickQuote']['DOOR_HINGE_UNIT_PRICE'],hingeGaps=[round(positions[i+1]-positions[i],1) for i in range(n-1)],topHingeOffset=100,bottomHingeOffset=100)
    return {'product_id':PRODUCT_IDS[kind],'quantity':s['quantity'],'totalPrice':priced['subtotal'],'config':cfg}
