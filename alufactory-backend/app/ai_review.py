"""Manufacturing gate: estimate counts never stand in for hole coordinates."""
import copy
from app.ai_material_quote import product_kind
from app.ai_quote import CATALOG, clarification_questions

def build_review(spec, quote):
    if not quote:
        return None
    # The P2 manufacturing review is only a profile editor. Never send boards to it.
    if any(product_kind(r['spec']) != 'profile' for r in (quote.get('items') or [quote])):
        return None
    missing = [q['question'] for q in spec.get('clarifications', []) if isinstance(q,dict) and isinstance(q.get('question'),str) and q.get('stage') != 'shipping' and q.get('field') != 'province']
    result = []
    acknowledgements = []
    if spec.get('_visual_pending'): acknowledgements.append('请核对图片识别清单，确认后才能下单。')
    if spec.get('unsupported'): missing.append('目录外或结构要求尚需明确；可在对话中调整本单范围。')
    if quote.get('partial'): missing.append('还有未计价的清单项，请补齐信息或明确从本单移除，避免漏单。')
    raw_rows = spec.get('items') or [spec]
    priced_rows = quote.get('items') or [quote]
    for priced in priced_rows:
        index = priced.get('source_index', 0)
        raw = raw_rows[index]
        row = priced['spec']
        row_missing_start = len(missing)
        if raw.get('unsupported'): missing.append(f'第{index+1}项还有额外加工要求，请继续确认。')
        from app.ai_quote import quote_single
        raw_check = {**row, **raw, 'province':row.get('province')}
        raw_check['tapping'] = raw.get('tapping', spec.get('tapping'))
        check_reply, check_quote = quote_single(raw_check, quote['membership'])
        if check_quote is None: missing.append(f'第{index+1}项：{check_reply}')
        label = f'第{index+1}项（{row["model"]} / {row["length"]}mm）'
        if raw.get('machining_confirmed', spec.get('machining_confirmed')) is not True:
            acknowledgements.append('请核对并确认型材加工配置。')
        holes = raw.get('holes', [])
        if not isinstance(holes, list) or len(holes) > 100:
            missing.append(label + '：孔位清单格式不正确。'); holes = []
        valid_holes = []
        for h in holes:
            if not isinstance(h, dict):
                missing.append(label + '：请明确孔位。'); continue
            side, pos, kind = h.get('side'), h.get('positionMm'), h.get('type')
            if not isinstance(side, str):
                missing.append(label + '：请明确 ABCD 加工面。'); continue
            groove_count = CATALOG.get('grooves', {}).get(row['model'], {}).get(side, 1)
            groove = h.get('physicalGrooveIndex')
            if groove is None and groove_count <= 1:
                groove = 0
            if side not in ('A','B','C','D') or type(pos) is not int or not 5 <= pos <= row['length']-5 or kind not in ('through','countersunk','threaded'):
                missing.append(label + '：每个孔需明确 ABCD 加工面、从左端起的毫米位置及孔型，孔位距端部至少5mm。'); continue
            if type(groove) is not int or not 0 <= groove < max(1, groove_count):
                missing.append(label + '：多槽面请明确槽位。'); continue
            if kind == 'threaded' and h.get('threadSize') not in (('M3','M4','M5','M6','M8') if row['model'].startswith(('3030','3060','4040','4080')) else ('M3','M4','M5','M6')):
                missing.append(label + '：螺纹孔请明确 M3/M4/M5/M6/M8。'); continue
            valid_holes.append({**h, 'id':f'ai-hole-{index}-{len(valid_holes)}', 'physicalGrooveIndex':groove})
        for field, kind in [('through_hole_count','through'),('countersunk_count','countersunk'),('threaded_hole_count','threaded')]:
            if row.get(field, 0) != sum(h['type'] == kind for h in valid_holes):
                missing.append(label + '：打孔数量和具体孔位未对应，请补齐或修正。')
        miter = raw.get('miter_cut')
        validated_miter = None
        if row.get('miter45_count',0) or miter:
            valid = isinstance(miter,dict) and all(isinstance(miter.get(end),dict) and type(miter[end].get('enabled')) is bool and (not miter[end]['enabled'] or (miter[end].get('side') in ('AC','BD') and miter[end].get('direction') in ('up','down'))) for end in ('left','right'))
            if valid and sum(miter[end]['enabled'] for end in ('left','right')) == row.get('miter45_count',0):
                validated_miter = {end:{'enabled':miter[end]['enabled'],'side':miter[end].get('side') or 'AC','direction':miter[end].get('direction') or 'up'} for end in ('left','right')}
            else:
                missing.append(label + '：斜切在哪一端、AC 还是 BD 面、向上还是向下？可对照下方图示告诉我。')
        if row.get('tapping') not in ('none','left','right','both'):
            missing.append(label + '：请确认端面攻丝。')
        result.append({'spec':row,'holes':valid_holes,'unit_price':priced['unit_price'],'subtotal':priced['subtotal'],'miter_cut':validated_miter,'questions':missing[row_missing_start:],'source_index':index,'machining_confirmed':raw.get('machining_confirmed',spec.get('machining_confirmed')) is True})
    accessories = spec.get('accessories')
    if accessories not in ('none','self_purchase','later'):
        acknowledgements.append('本次加入购物车仅包含铝型材，配件可自行购买或稍后另配。')
    mode = '3d' if spec.get('review_view') == '3d' or any(len({h['side'] for h in r['holes']})>1 for r in result) else '2d'
    return {'ready': not (missing or acknowledgements), 'can_confirm': not missing, 'blocking_questions':list(dict.fromkeys(missing)), 'questions': list(dict.fromkeys(missing+acknowledgements)), 'items': result, 'view':mode,
            'accessories':accessories if accessories in ('none','self_purchase','later') else 'pending', 'order_review':bool(spec.get('order_review'))}


def confirmed_configuration(spec, profile_only=False):
    """The explicit UI acknowledgement approves the shown configuration only."""
    result = copy.deepcopy(spec)
    result['_visual_pending'] = False
    result['machining_confirmed'] = True
    for row in result.get('items') or []:
        row['machining_confirmed'] = True
    if profile_only and result.get('accessories') not in ('none','self_purchase','later'):
        result['accessories'] = 'none'
    return result
