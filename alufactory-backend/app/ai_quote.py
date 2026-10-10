"""Deterministic phase-one single-profile estimate; no model-supplied prices."""
from app.ai_material_quote import product_kind, quote_material, describe
import json
import math
import re
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name('ai_catalog.json').read_text())

def clarification_questions(spec, stage=None):
    values = spec.get('clarifications', [])
    if not isinstance(values, list):
        raise ValueError('待确认问题格式不正确。')
    return list(dict.fromkeys(v['question'][:300] for v in values
        if isinstance(v, dict) and isinstance(v.get('question'), str) and v['question'].strip()
        and (stage is None or v.get('stage', 'quote') != 'order' or stage == 'order')))

def tap_ports(model):
    if model == '2047': return 3
    m = re.match(r'^(\d{2})(\d{2,3})', model)
    if not m: return 1
    a, b = map(int, m.groups())
    return max(1, round(max(a, b) / min(a, b)))

def recognized_lines(spec):
    names = {c['id']: c['name']['cn'] for c in CATALOG['colors']}
    lines = []
    for index, row in enumerate(spec.get('items') or [spec]):
        if not isinstance(row, dict): continue
        label = str(row.get('source_row') or index + 1)
        if product_kind(row) != 'profile':
            lines.append(f'第{label}项：' + describe(row)); continue
        color = names.get(row.get('color'), row.get('color') or '颜色待确认')
        line = f"第{label}项：{row.get('model') or '型号待确认'} / {color} / {row.get('length') or '?'}mm × {row.get('quantity') or '?'}根"
        notes = row.get('source_notes')
        if isinstance(notes, str) and notes: line += '；' + notes[:300]
        elif row.get('tapping') == 'both': line += '；两端攻丝'
        lines.append(line)
    return '\n'.join(lines)

def normalize_extracted_spec(spec):
    """Keep annotation rows out of the BOM and preserve explicit variant semantics."""
    items = spec.get('items')
    if not isinstance(items, list): return spec
    if not items: spec['items'] = [dict((k,v) for k,v in spec.items() if k != 'items')]; items = spec['items']
    annotations, rows = [], []
    for row in items:
        if not isinstance(row, dict): raise ValueError('清单行格式错误。')
        if spec.get('product') and not row.get('product'): row['product'] = spec['product']
        if product_kind(row) == 'profile' and not row.get('model') and row.get('length') is None and row.get('quantity') is None and (row.get('color') or row.get('source_notes')):
            annotations.append(row)
        else:
            rows.append(row)
    spec['items'] = rows
    questions = spec.get('clarifications', [])
    if not isinstance(questions, list): raise ValueError('问题格式错误。')
    if annotations:
        annotation_ids = [str(r.get('source_row')) for r in annotations if r.get('source_row') is not None]
        questions = [q for q in questions if isinstance(q, dict) and not any(f'第{n}行' in q.get('question','') for n in annotation_ids)]
        questions.append({'stage':'quote', 'question':'表格末尾的颜色备注是否适用于全部型材？“银色”是原色银白还是亮银色？'})
    explicit_neighbor = False
    for row in rows:
        if product_kind(row) != 'profile': continue
        notes = str(row.get('source_notes') or '')
        if str(row.get('model') or '').startswith('2020'):
            if '邻边封槽' in notes:
                row['model'] = '2020-N2'; explicit_neighbor = True
            elif '对边封槽' in notes: row['model'] = '2020-N2-OPP'
            elif '不封槽' in notes: row['model'] = '2020'
        ports = tap_ports(str(row.get('model') or ''))
        if ports > 1 and row.get('tapping') in ('left','right','both') and row.get('tapping_ports') is None:
            questions.append({'stage':'quote','question':f"{row.get('model')} 每端有 {ports} 个攻丝孔位，是否需要所说端面上的全部孔位都攻丝？如果只加工部分，请说明孔位。"})
    if explicit_neighbor:
        questions = [q for q in questions if not (isinstance(q,dict) and '邻边' in q.get('question','') and '对边' in q.get('question',''))]
    if not spec.get('province') and any(product_kind(row) not in ('aluminum_plate','pegboard','frame','cabinet_door') for row in rows) and not all(row.get('province') in CATALOG['shipping']['standard'] for row in rows):
        if not any(isinstance(q, dict) and any(w in q.get('question', '') for w in ('省', '发往', '发货到', '收货地')) for q in questions):
            questions.append({'stage':'shipping','field':'province','question':'这批商品发哪个省或直辖市？'})
    spec['clarifications'] = questions
    return spec

def rounded(value):
    return float(Decimal(str(value)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))

def quote_single(spec, membership):
    if not isinstance(spec, dict):
        raise ValueError('需求格式不正确，请重新描述。')
    if product_kind(spec) != 'profile':
        return quote_material(spec, membership, CATALOG, rounded)
    if spec.get('unsupported'):
        return '已记录需求。目前自动估价支持单种型材；多种材料、家具结构或复杂加工请在设计器补充尺寸和连接方式，并联系人工复核。', None
    variants = {v['id']: v for v in CATALOG['variants']}
    colors = {c['id']: c for c in CATALOG['colors']}
    # A catalog-enforced finish is not a customer choice. Normalize it exactly
    # as QuickQuote does when selecting a colored-section-only color.
    if spec.get('color') in CATALOG['coloredSectionOnly']:
        spec = {**spec, 'section': 'colored'}
    questions = []
    if spec.get('model') not in variants:
        questions.append('需要哪个型材型号（例如 2020）？')
    if spec.get('color') not in colors:
        questions.append('需要什么颜色？请明确具体色号或颜色名称。')
    for field, label, low, high in [('length', '每根长度（21–3000mm）', 21, 3000), ('quantity', '数量（根）', 1, 10000)]:
        value = spec.get(field)
        if type(value) is not int or not low <= value <= high:
            questions.append(f'请提供{label}。')
    if spec.get('tapping') not in ('none', 'left', 'right', 'both'):
        questions.append('是否需要端面攻丝：不攻丝、单端还是两端？')
    color = colors.get(spec.get('color'))
    if color and color['id'] != 'natural' and spec.get('section') not in ('natural', 'colored'):
        questions.append('切口截面要本色还是彩色？两者价格不同。')
    if questions:
        return '\n'.join(questions), None
    if spec['length'] > color['maxLength']:
        return f"该颜色最大长度为 {color['maxLength']}mm，请调整长度或颜色。", None
    spec = dict(spec)
    holes = spec.get('holes', [])
    if isinstance(holes, list):
        for field, kind in [('through_hole_count','through'),('countersunk_count','countersunk'),('threaded_hole_count','threaded')]:
            count = sum(isinstance(h, dict) and h.get('type') == kind for h in holes)
            current = spec.get(field, 0)
            if type(current) is int and current >= 0:
                spec[field] = max(current, count)
    ports = tap_ports(spec['model'])
    selections = spec.get('tapping_ports')
    if selections is not None:
        if not isinstance(selections, dict) or any(not isinstance(selections.get(end), list) or len(selections[end]) != ports or any(type(v) is not bool for v in selections[end]) for end in ('left', 'right')):
            return f'请确认每端 {ports} 个攻丝孔位中，哪些需要攻丝？可以直接回复两端全部孔位。', None
        expected = {'none': (False,False), 'left': (True,False), 'right': (False,True), 'both': (True,True)}[spec['tapping']]
        if tuple(any(selections[end]) for end in ('left','right')) != expected:
            return '攻丝端数与孔位清单不一致，请确认左、右端分别哪些孔需要攻丝？', None
    elif ports > 1 and spec['tapping'] != 'none':
        return f"{spec['model']} 每端有 {ports} 个攻丝孔位，您说的攻丝是该端全部孔位都加工，还是只加工指定孔位？", None
    finish = 'oxidized' if spec['color'] == 'natural' else ('powder' if spec['section'] == 'colored' else 'electrophoretic')
    rate = max(0, variants[spec['model']]['price'][finish] - {'vip': 2, 'vip_plus': 4}.get(membership, 0))
    processing = 0
    for field, rate_per_hole in [('through_hole_count',1),('countersunk_count',1.8),('threaded_hole_count',1.8),('miter45_count',1)]:
        n = spec.get(field, 0)
        if type(n) is not int or not 0 <= n <= 100:
            return '请明确每根型材的打孔类别与数量（0–100）。', None
        processing += n * rate_per_hole
    tapping = (sum(sum(selections[end]) for end in ('left','right')) if selections else {'none': 0, 'left': 1, 'right': 1, 'both': 2}[spec['tapping']]) * 1.5
    unit = rounded(rate * spec['length'] / 1000 + tapping + processing + (5 if membership != 'vip_plus' and spec['length'] <= 100 else 0))
    subtotal = rounded(unit * spec['quantity'])
    weight = CATALOG['weights'].get(spec['model'], 0.6) * spec['length'] / 1000 * spec['quantity']
    options = {}
    for method, rates in CATALOG['shipping'].items() if spec.get('province') in CATALOG['shipping']['standard'] else []:
        tariff = rates[spec['province']]
        if method == 'anneng':
            fee = tariff['first'] + max(0, math.ceil(weight - 15)) * tariff['next']
        else:
            fee = tariff['first'] + (max(1, math.ceil(weight)) - 1) * tariff['next'] + (20 if spec['length'] > 1500 else 0)
        options[method] = rounded(fee)
    method = min(options, key=options.get) if options else None
    fee = options.get(method)
    result = {'spec': spec, 'unit_price': unit, 'subtotal': subtotal, 'shipping_fee': fee, 'shipping_pending': fee is None,
              'shipping_method': method, 'total': rounded(subtotal + (fee or 0)), 'weight_kg': weight,
              'membership': membership, 'estimate_only': True}
    section_label = '本色截面' if finish != 'powder' else '彩色截面'
    reply = f"材料及已注明加工 ¥{subtotal:.1f}。" + (f"预估运费 ¥{fee:.1f}，合计 ¥{result['total']:.1f}。" if fee is not None else '运费待定，请告诉我发哪个省或直辖市。')
    return reply, result


def quote_profile(spec, membership):
    if not isinstance(spec, dict): raise ValueError('需求格式不正确。')
    source = json.loads(json.dumps(spec))
    items = spec.get('items') if 'items' in spec else [spec]
    if not isinstance(items, list) or not 1 <= len(items) <= 60:
        raise ValueError('清单应包含 1–60 行型材，可分批告诉我。')
    rows, pending, assumptions = [], [], False
    questions = clarification_questions(spec, 'quote')
    if spec.get('unsupported'):
        questions.append('还有目录外或结构要求需要确认；先核对下方能识别的型材，其余需求可以继续告诉我。')
    for index, item in enumerate(items):
        if not isinstance(item, dict): raise ValueError('清单行格式错误。')
        line = {**{k: spec.get(k) for k in ('product','model','color','province','section','tapping')}, **item}
        line['province'] = spec.get('province') or line.get('province')
        line['color'] = {'原色':'natural','本色':'natural','银白':'natural','紫色':'purple','米白':'beige'}.get(line.get('color'),line.get('color'))
        if product_kind(line) == 'profile' and line.get('tapping') is None:
            line['tapping'] = 'none'; assumptions = True
        if line.get('unsupported'):
            questions.append(f'第{index+1}项：额外加工或结构要求尚未计入，请继续说明。')
            line = {**line, 'unsupported':False}
        miter = line.get('miter_cut')
        if isinstance(miter, dict):
            enabled = sum(isinstance(miter.get(end),dict) and miter[end].get('enabled') is True for end in ('left','right'))
            if type(line.get('miter45_count',0)) is int:
                line['miter45_count'] = max(line.get('miter45_count',0),enabled)
        reply, result = quote_single(line, membership)
        # Unknown machining should not erase the known material estimate.
        if result is None and ('攻丝' in reply or '打孔类别与数量' in reply):
            questions.append(f'第{index+1}项：{reply} 此项未明确加工暂不计费。')
            fallback = dict(line)
            if '攻丝' in reply:
                fallback['tapping'] = 'none'; fallback.pop('tapping_ports',None)
            for field in ('through_hole_count','countersunk_count','threaded_hole_count','miter45_count'):
                if type(fallback.get(field,0)) is not int or not 0 <= fallback.get(field,0) <= 100:
                    fallback[field] = 0
            reply, result = quote_single(fallback, membership)
        if result is None:
            pending.append({'index':index,'spec':item,'question':reply})
            questions.append(f'第{index+1}项：{reply}')
        else:
            result['source_index'] = index
            rows.append(result)
    questions = list(dict.fromkeys(questions))
    if not rows:
        if not spec.get('province') and any(product_kind(r) not in ('aluminum_plate','pegboard','frame','cabinet_door') for r in items): questions.append('发哪个省或直辖市？可稍后补充。')
        return '已记录需求：\n' + recognized_lines(spec) + '\n我们先补充这些信息：\n' + '\n'.join(questions), None
    weight = sum(row['weight_kg'] for row in rows)
    overlength = any(product_kind(row['spec']) == 'profile' and row['spec']['length'] > 1500 for row in rows)
    if all(product_kind(r['spec']) == 'accessory' for r in rows):
        weight = 1
        for r in rows: r['shipping_weight_known'] = True
    unknown_weight = any(not r.get('shipping_weight_known', product_kind(r['spec']) == 'profile') for r in rows)
    province = rows[0]['spec'].get('province')
    complete_shipping = not pending and not unknown_weight and province in CATALOG['shipping']['standard'] and all(r['spec'].get('province') == province for r in rows)
    options = {}
    if complete_shipping:
        for method, rates in CATALOG['shipping'].items():
            tariff = rates[province]
            fee = (tariff['first'] + max(0, math.ceil(weight-15))*tariff['next'] if method == 'anneng' else tariff['first']+(max(1,math.ceil(weight))-1)*tariff['next']+(20 if overlength else 0))
            options[method] = rounded(fee)
    method = min(options,key=options.get) if options else None
    fee = options.get(method)
    subtotal = rounded(sum(row['subtotal'] for row in rows))
    total = rounded(subtotal+(fee or 0))
    count = sum(row['spec']['quantity'] for row in rows)
    meters = sum(row['spec']['quantity']*row['spec']['length'] for row in rows if product_kind(row['spec']) == 'profile')/1000
    free_shipping = weight == 0 and not unknown_weight and not pending
    if free_shipping: fee = 0; method = 'included'; total = subtotal
    if fee is None:
        shipping_question = '待清单补齐后合并计算运费。' if pending else '发哪个省或直辖市？也可在购物车填写地址后计算运费。'
        questions.append('铝框门或混合配件的运费尚待核实，当前金额不含运费。' if unknown_weight else shipping_question)
    prefix = '已明确部分' if pending or clarification_questions(spec,'quote') else '材料及已注明加工'
    lines = [f'{prefix} ¥{subtotal:.1f}；' + (f'运费 ¥{fee:.1f}，预估合计 ¥{total:.1f}。' if fee is not None else '运费待定，当前金额不含运费。'),f'已计价 {len(rows)} 项、{count} 件，其中型材{meters:g} 米。']
    for r in rows:
        row = r['spec']
        if product_kind(row) != 'profile':
            lines.append(f"第{r['source_index']+1}项：" + describe(row)); continue
        section = '本色截面' if row['color'] == 'natural' or row.get('section') == 'natural' else '彩色截面'
        lines.append(f"第{r['source_index']+1}项：{row['model']} · {section} · {row['length']}mm × {row['quantity']}根")
    if assumptions: lines.append('已注明的加工已计入；未说明加工的行暂按无额外加工估价，下单前再确认。')
    if questions: lines.append('可以继续补充：\n'+'\n'.join(dict.fromkeys(questions)))
    result = {'items':rows,'subtotal':subtotal,'shipping_fee':fee,'shipping_pending':fee is None,'shipping_method':method,'total':total,'weight_kg':weight,'quantity':count,'length_m':meters,'membership':membership,'estimate_only':True,'free_shipping':free_shipping,'assumed_no_machining':assumptions,'partial':bool(pending),'pending_items':pending,'questions':list(dict.fromkeys(questions)),'source_spec':source}
    # Keep the existing single-row response shape for integrations.
    if 'items' not in spec: result.update(spec=rows[0]['spec'],unit_price=rows[0]['unit_price'])
    return '\n'.join(lines), result
