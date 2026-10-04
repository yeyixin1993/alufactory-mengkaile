"""Deterministic phase-one single-profile estimate; no model-supplied prices."""
import json
import math
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name('ai_catalog.json').read_text())

def rounded(value):
    return float(Decimal(str(value)).quantize(Decimal('0.1'), rounding=ROUND_HALF_UP))

def quote_profile(spec, membership):
    if not isinstance(spec, dict):
        raise ValueError('需求格式不正确，请重新描述。')
    if spec.get('unsupported'):
        return '目前支持单种型材的文字估价；多种材料、钻孔定位或图片方案请使用快速报价或设计器。', None
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
    if spec.get('province') not in CATALOG['shipping']['standard']:
        questions.append('发哪个省或直辖市？')
    if spec.get('tapping') not in ('none', 'left', 'right', 'both'):
        questions.append('是否需要端面攻丝：不攻丝、单端还是两端？')
    color = colors.get(spec.get('color'))
    if color and color['id'] != 'natural' and spec.get('section') not in ('natural', 'colored'):
        questions.append('切口截面要本色还是彩色？两者价格不同。')
    if questions:
        return '\n'.join(questions), None
    if spec['length'] > color['maxLength']:
        return f"该颜色最大长度为 {color['maxLength']}mm，请调整长度或颜色。", None
    # Multi-port sections need explicit port selection, outside this initial contract.
    if spec['tapping'] != 'none' and spec['model'][:4] not in ('1515', '2020', '3030', '4040'):
        return '该型号端面可能有多个攻丝孔位，请在型材编辑器确认具体孔位后报价。', None
    finish = 'oxidized' if spec['color'] == 'natural' else ('powder' if spec['section'] == 'colored' else 'electrophoretic')
    rate = max(0, variants[spec['model']]['price'][finish] - {'vip': 2, 'vip_plus': 4}.get(membership, 0))
    tapping = {'none': 0, 'left': 1, 'right': 1, 'both': 2}[spec['tapping']] * 1.5
    unit = rounded(rate * spec['length'] / 1000 + tapping + (5 if spec['length'] <= 100 else 0))
    subtotal = rounded(unit * spec['quantity'])
    weight = CATALOG['weights'].get(spec['model'], 0.6) * spec['length'] / 1000 * spec['quantity']
    options = {}
    for method, rates in CATALOG['shipping'].items():
        tariff = rates[spec['province']]
        if method == 'anneng':
            fee = tariff['first'] + max(0, math.ceil(weight - 15)) * tariff['next']
        else:
            fee = tariff['first'] + (max(1, math.ceil(weight)) - 1) * tariff['next'] + (20 if spec['length'] > 1500 else 0)
        options[method] = rounded(fee)
    method = min(options, key=options.get)
    result = {'spec': spec, 'unit_price': unit, 'subtotal': subtotal, 'shipping_fee': options[method],
              'shipping_method': method, 'total': rounded(subtotal + options[method]), 'weight_kg': weight,
              'membership': membership, 'estimate_only': True}
    section_label = '本色截面' if finish != 'powder' else '彩色截面'
    reply = f"{spec['model']} · {color['name']['cn']} · {section_label} · {spec['length']}mm × {spec['quantity']}根\n单根含加工 ¥{unit:.1f}，材料及加工合计 ¥{subtotal:.1f}；发往{spec['province']}，预估运费 ¥{options[method]:.1f}，合计 ¥{result['total']:.1f}。\n这是按当前快速报价规则计算的估价，请在下单前核对加工、配送及最终金额。"
    return reply, result
