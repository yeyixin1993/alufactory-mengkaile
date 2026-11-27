"""Sales questions are not incomplete purchase orders. Only trusted UI actions leave here."""
import re
from app.ai_quote import CATALOG, quote_single, PROFILE_MACHINING_RATES, DANGER_FEE_PER_PIECE, DANGER_FEE_THRESHOLD_MM

CONTACT = '复杂设计或需要进一步确认，可以加微信 19821200413，发送图片一起沟通。'

# End tapping is distinct from the screws used by individual accessories.
END_TAPPING_SPECS = {'1515': ('M4', 10), '2020': ('M6', 20),
                     '3030': ('M8', 20), '4040': ('M8', 20)}

def _end_tapping_line(series):
    thread, depth = END_TAPPING_SPECS[series]
    return f'{series}系列：端面攻丝{thread}，攻丝长度至少{depth}mm。'

END_TAPPING_STANDARD_ANSWER = '\n'.join(_end_tapping_line(s) for s in END_TAPPING_SPECS)

def end_tapping_spec_advice(message):
    """Answer confirmed thread sizes/depths without changing an order or guessing ports."""
    text = re.sub(r'[\u200b-\u200f\ufeff]', '', message).strip()
    if not re.search(r'攻丝|攻牙|tapp', text, re.I):
        return None
    if re.search(r'多少钱|多少元|价格|价钱|报价|单价|费用|工费|收费|怎么收|怎么算|price|cost|how\s+much|下单|加入购物车|改成|改为|换成|取消|删除|增加|不要|不需要', text, re.I):
        return None
    if re.search(r'底孔|侧面|侧孔|螺纹孔|螺距|丝锥|刀具|扭矩|转速|钢|铁板|铜材|铜板|塑料|木板|海洋板|铝板|洞洞板|设备树|几端|单端还是双端|一端还是两端', text):
        return None
    if re.search(r'(?:\d+|[一二两三四五六七八九十百]+)\s*(?:根|件)', text):
        return None
    if not re.search(r'规格|大小|多大|直径|孔径|深|多长|长度|多少|几毫米|几厘米|还是|吗|是不是|是否|默认|size|depth|diameter|length', text, re.I):
        return None
    models = re.findall(r'(?<![\d.])(\d{4,5})(?![\d.])', text)
    # 2047 has M6 outer ports and an M8 centre port. Never flatten it to 2020.
    supported = {'1515': '1515', '2020': '2020', '2040': '2020', '2060': '2020',
                 '2080': '2020', '20100': '2020', '3030': '3030', '3060': '3030',
                 '4040': '4040', '4080': '4040'}
    if any(model not in supported for model in models):
        return None
    series = list(dict.fromkeys(supported[model] for model in models))
    if not series:
        series = list(dict.fromkeys({'15': '1515', '20': '2020', '30': '3030', '40': '4040'}[s]
                                   for s in re.findall(r'(?<!\d)(15|20|30|40)\s*系列', text)))
    return {'id': 'end-tapping-specs', 'version': 1, 'guidance': [],
            'answer': '\n'.join(_end_tapping_line(s) for s in series) if series else END_TAPPING_STANDARD_ANSWER}

SURFACE_PROCESS_ANSWER = '表面工艺有三种：喷砂阳极氧化、喷砂高定水性漆、喷涂砂纹。前两种支持截面彩色，喷涂砂纹只有截面本色。'

def surface_process_advice(message):
    text = message.strip()
    if re.search(r'价格|多少钱|费用|起订|下单|改成|改为|加入购物车|取消|海洋板|木板', text):
        return None
    if not (re.search(r'表面.*(?:工艺|处理)|(?:彩色|颜色).*(?:工艺|怎么上色)', text)
            or re.search(r'(?:阳极氧化|水性漆|喷涂砂纹).*(?:截面|切口)|(?:截面|切口).*(?:阳极氧化|水性漆|喷涂砂纹)', text)):
        return None
    return {'id': 'surface-process-specs', 'version': 1, 'guidance': [], 'answer': SURFACE_PROCESS_ANSWER}

def equipment_tree_advice(message):
    """Confirmed specifications apply to the equipment tree, not all accessories."""
    text = message.strip()
    if not re.search(r'设备树|設備樹|(?:equipment|device)\s*tree', text, re.I):
        return None
    if re.search(r'多少钱|多少元|价格|价钱|报价|单价|费用|运费|下单|加入购物车|改成|换成|取消|删除|承重|负载|硬度|耐温|寿命', text):
        return None
    shaft = bool(re.search(r'光轴|光軸|硬轴|软轴|轴杆|镀铬|实心|空心|直径|外径|多粗', text))
    printed = bool(re.search(r'3\s*d\s*打印|打印件|打印材料|塑料|petg|\bpla\b|\babs\b', text, re.I))
    if not shaft and not printed:
        if not re.search(r'材质|材料|规格', text):
            return None
        shaft = printed = True
    answers = []
    if shaft:
        answers.append('设备树的光轴采用直径35mm的实心镀铬硬轴。')
    if printed:
        answers.append('设备树的3D打印件采用PETG材料，目前仅有黑色。')
    return {'id': 'equipment-tree-specs', 'version': 1, 'guidance': [], 'answer': '\n'.join(answers)}

def supplied_material_coloring_advice(message):
    """Owner-confirmed coloring service, separate from buying colored profiles."""
    text = message.strip()
    if not re.search(r'上色|着色|改色', text):
        return None
    if not re.search(r'来料|自带|自备|自己提供|寄料|称重|公斤|千克|(?<![a-z])kg(?![a-z])', text, re.I):
        return None
    if re.search(r'(?:不要|不需要|取消).*(?:上色|着色|改色)', text):
        return None
    return {'id': 'supplied-material-coloring', 'version': 1, 'guidance': [],
            'answer': '来料加工上色按实际称重计费：不足40kg，45元/公斤；40kg及以上，25元/公斤。来回运费自理。'}

def machining_price_advice(message, membership="standard"):
    """Fixed unit prices are answered even during a quote; order edits are not."""
    text = re.sub(r'[\u200b-\u200f\ufeff]', '', message).strip()
    if not re.search(r'加工|工费|工钱|危险费|打孔|通孔|沉头孔|螺纹孔|攻丝|斜切|斜割', text):
        return None
    if not (is_price_question(text) or re.search(r'加工费|工费|工钱|打孔费|危险费|攻丝费|通孔费|沉头孔费|螺纹孔费|斜切费|怎么收|如何收|怎么算|如何计算|怎么计算|怎么计费|如何计费|咋算|价目', text)):
        return None
    explicit_unit = re.search(r'单价|每(?:个|孔|端|根).*?(?:多少|价格|费用)|多少钱(?:一|每)(?:个|孔|端|根)|(?:一|1)个.*?多少钱', text)
    if re.search(r'下单|加入购物车|改成|改为|取消|不要|不需要|增加|删除', text):
        return None
    if not explicit_unit and re.search(r'总价|总共|合计|一共|(?:\d+|[一二两三四五六七八九十百千万]+)\s*根|(?:打|加|开)\s*(?:\d+|[一二两三四五六七八九十百千万]+)\s*(?:个|孔)', text):
        return None
    rates = PROFILE_MACHINING_RATES
    lines = [
        f"危险费：{DANGER_FEE_PER_PIECE:g}元/根（长度≤{DANGER_FEE_THRESHOLD_MM:g}mm，VIP+免收）",
        f"攻丝费：{rates['end_tapping']:g}元/个",
        f"通孔费：{rates['through_hole_count']:g}元/个",
        f"沉头孔费：{rates['countersunk_count']:g}元/个",
        f"45°斜切费：{rates['miter45_count']:g}元/端",
    ]
    if '螺纹孔' in text:
        lines.append(f"螺纹孔费：{rates['threaded_hole_count']:g}元/个")
    return {'id': 'machining-unit-prices', 'version': 2, 'guidance': [], 'answer': '\n'.join(lines)}

def is_price_question(message):
    if re.search(r'多少钱|多少元|价格|价钱|价位|什么价|怎么卖|咋卖|单价|报价|贵吗|费用|工费|收费|price|cost|how\s+much', message, re.I):
        return True
    return bool('多少' in message and not re.search(r'厚|深|长度|宽度|高度|尺寸|直径|孔径|规格|大小|重量|面积|孔位|数量|承重', message))


def requested_catalog_color(text):
    # Include the colloquial names accepted by quote extraction, not just color-card titles.
    aliases = {'紫色': 'purple', '粉色': 'pink', '黑色': 'black', '米白': 'beige',
               '银白': 'natural', '银色': 'natural', '亮银色': 'silver',
               '浅青蓝': 'sky_blue', '天蓝色': 'sky_blue', '天蓝': 'sky_blue'}
    for color in CATALOG['colors']:
        aliases[color['name']['cn']] = color['id']
    for name in sorted(aliases, key=len, reverse=True):
        if name in text:
            return aliases[name]
    return None


def catalog_price_advice(message, membership="standard"):
    """Answer known catalog rates before sales guidance, independent of quote history."""
    text = re.sub(r'[\u200b-\u200f\ufeff]', '', message).strip()
    coloring = supplied_material_coloring_advice(text)
    if coloring:
        return coloring
    machining = machining_price_advice(re.sub(r'不含加工(?:费)?|不包括加工(?:费)?', '', text), membership)
    board_query = bool(re.search(r'海洋板|BBB|洞洞板|铝板|柜门|铝框门', text, re.I))
    if not is_price_question(text) and not machining:
        return None
    # An actual order/change still needs the existing deterministic quote flow.
    if re.search(r'加入购物车|下单|改成|改为|换成|取消|删除|不要|不需要|增加|总价|合计|总共|一共', text):
        return None
    unit_query = re.search(r'单价|每(?:米|个|孔|端|根|张|块|平方)|(?:一|1)米|一公尺|/米|per\s*(?:m|metre|meter)|多少钱一|(?:一|1)个.*?多少钱', text, re.I)
    if not unit_query and re.search(r'(?<![元/])(?:\d+|[一二两三四五六七八九十百千万]+)\s*(?:根|块|张|套|个|颗)', text):
        return None
    material_price_question = re.search(r'型材(?:的)?(?:价格|单价|多少钱)|(?:每|一|1)米|/米|per\s*(?:m|metre|meter)|[A-Z0-9]\s*(?:价格|多少钱|什么价|单价|怎么卖)', text, re.I)
    if machining and not board_query and not material_price_question:
        return machining
    lines = []
    rules = CATALOG['quickQuote']
    tier = {'vip': 'VIP价', 'vip_plus': 'VIP+价'}.get(membership, '标准价')
    color = requested_catalog_color(text)
    # Accessories may contain a profile series number; never misquote it as a profile.
    accessory_query = bool(re.search(r'配件|端盖|螺丝|角码|连接件|光轴|SK8|SHF8|\d+号', text, re.I))
    if accessory_query:
        code = re.search(r'(?<!\d)(\d+)号', text)
        series = re.search(r'(?<!\d)(1515|2020|3030|4040)(?!\d)', text)
        for item in CATALOG['accessories']:
            name = item['name']['cn']
            matches = (code and str(item['code']) == code[1]) or name in text
            matches = matches or ('端盖' in text and '端盖' in name)
            for model in ('SK8', 'SHF8'):
                matches = matches or (re.search(r'(?<![A-Z0-9])'+model+r'(?![A-Z0-9])', text, re.I) and model in name)
            if not matches or (series and item['series'] not in (series[1], 'universal')):
                continue
            price = item['price']
            unit = '米' if item.get('lengthPriced') else '个'
            label = name + (f" · {item['series']}" if item['series'] != 'universal' else '')
            line = f"{label}：本色{price['natural']:g}元/{unit}"
            if not item.get('naturalOnly'):
                line += f"，彩色{price['colored']:g}元/{unit}"
            lines.append(line)
        if lines:
            lines.append(f'{tier}；配件各会员等级同价，以上为零售单价。')
    if not accessory_query and re.search(r'海洋板|BBB', text, re.I):
        full = bool(re.search(r'整张|整板', text))
        prices = rules['MARINE_BOARD_FULL_SHEET_PRICE' if full else 'MARINE_BOARD_SPEC_PRICE_PER_SQM']
        thicknesses = {float(m) for m in re.findall(r'(?<![\d.])(\d+(?:\.\d+)?)\s*(?:mm|毫米|厘)', text, re.I)}
        marine_lines = []
        for mm in ('12', '18'):
            if thicknesses and float(mm) not in thicknesses:
                continue
            unit = '张' if full else '㎡'
            for spec, name in [('marine_bbb_plain', 'BBB素板'), ('marine_bbb_uv_film', '两面UV清漆+覆膜')]:
                rate = prices[spec][mm]
                line = f'{mm}mm海洋板{name}：原色{rate:g}元/{unit}'
                if not full:
                    line += f"，彩色{rate + rules['MARINE_BOARD_COLORED_SURCHARGE_PER_SQM']:g}元/{unit}"
                marine_lines.append(line)
        if marine_lines:
            lines.extend(marine_lines)
            lines.append(f'{tier}（海洋板各等级同价）。')
            lines.append('整张尺寸2440×1220mm，仅原色；彩色需选定制裁切，运费另计。' if full else f"单块最低计费{rules['MIN_BOARD_CHARGE_AREA_SQM']:g}㎡，运费另计。")
    if not accessory_query and re.search(r'洞洞板|铝板', text) and not re.search(r'柜门|铝框门', text):
        thicknesses = {float(m) for m in re.findall(r'(?<![\d.])(\d+(?:\.\d+)?)\s*(?:mm|毫米|厘)', text, re.I)}
        metal_lines = []
        for word, key in [('洞洞板', 'PEGBOARD'), ('铝板', 'ALUMINUM_PLATE')]:
            if word not in text:
                continue
            rates = rules[('VIP_PLUS_' if membership == 'vip_plus' else '') + key + '_PRICE_PER_SQM']
            for mm in rules['ENABLED_METAL_BOARD_THICKNESSES']:
                if thicknesses and mm not in thicknesses:
                    continue
                metal_lines.append(f"{mm}mm{word}：{rates[str(mm)]:g}元/㎡")
        if metal_lines:
            lines.extend(metal_lines)
            lines.append(f"{tier}；同品类、同厚度、同颜色累计最低计费{rules['MIN_BOARD_CHARGE_AREA_SQM']:g}㎡。")
    models = []
    if not accessory_query and (not board_query or '型材' in text):
        hits = []
        for variant in CATALOG['variants']:
            for alias in (variant['id'], variant['name']):
                parts = re.split(r'[\s\-]+', alias)
                pattern = r'(?<![A-Z0-9])' + r'[\s\-－–—]*'.join(map(re.escape, parts)) + r'(?![A-Z0-9-])'
                for match in re.finditer(pattern, text, re.I):
                    # A model prefix must not substitute for an unknown suffix.
                    if re.match(r'[\s\-－–—]*N\d', text[match.end():], re.I):
                        continue
                    hits.append((match.start(), match.end(), variant))
        ids = {v['id'] for start, end, v in hits if not any(a <= start and b > end for a, b, _ in hits)}
        models = [v for v in CATALOG['variants'] if v['id'] in ids]
        for model in models:
            discount = {'vip': 2, 'vip_plus': 4}.get(membership, 0)
            prices = [max(0, model['price'][finish] - discount) for finish in ('oxidized', 'electrophoretic', 'powder')]
            finishes = [f'银白色（默认）：{prices[0]:g}元/米', f'彩色截面本色：{prices[1]:g}元/米', f'彩色截面彩色：{prices[2]:g}元/米']
            if color in CATALOG['coloredSectionOnly']:
                finishes = [finishes[2], '该颜色仅支持彩色截面。']
            lines.append(model['name'] + '：\n' + '\n'.join(finishes))
        if models:
            lines.append(f'{tier}，不含加工和运费。')
    # Machining rates are for profiles. Do not apply them to boards or accessories.
    if machining and not board_query and not accessory_query:
        if not lines:
            return machining
        if not re.search(r'不含加工|不包括加工', text):
            lines.append(machining['answer'])
    return {'id': 'catalog-unit-prices', 'version': 1, 'answer': '\n'.join(lines), 'guidance': []} if lines else None

def advice(message, membership="standard"):
    text = message.strip()
    surface = surface_process_advice(text)
    if surface:
        return surface
    tapping_specs = end_tapping_spec_advice(text)
    if tapping_specs:
        return tapping_specs
    equipment_specs = equipment_tree_advice(text)
    if equipment_specs:
        return equipment_specs
    prices = catalog_price_advice(text, membership)
    if prices:
        return prices
    # A price question must not fall through to furniture/contact suggestions.
    if is_price_question(text):
        return None
    if '浅青蓝' in text and '天蓝' in text and re.search(r'区别|一样|同一|一种|两种|两个|关系|是不是|相同|不同|同色', text):
        return {'id': 'sky-blue-color-alias', 'version': 1, 'guidance': [],
                'answer': '浅青蓝和天蓝色是同一种颜色的不同叫法，统一标为「浅青蓝/天蓝色」。'}
    # Recognize the storefront product before generic cabinet/profile advice.
    if re.search(r'舒法特|书法特|書法特|舒发特|trofast', text, re.I):
        return {'id': 'trofast-cabinet', 'version': 1,
                'answer': '有的，网站有「宜家舒法特柜子」专区，是适配宜家舒法特（TROFAST）收纳筐的柜子。点击下方入口即可调整尺寸和配置，查看报价及三维方案。您也可以告诉我需要的长、宽、高和收纳筐布局。',
                'guidance': [{'kind': 'calligraphy_cabinet'}]}
    cards = []
    answers = []
    if re.search(r'端盖.*(厚|尺寸)|端盖多厚', text):
        answers.append('端盖厚度为4mm。')
    if re.search(r'喷砂', text):
        answers.append('所有型材默认都是喷砂的，包括银白色型材。')
    if re.search(r'截面图|壁厚|断面图|cross.section|wall thickness', text, re.I):
        models = [m['id'] for m in CATALOG['variants'] if m['id'] in text]
        cards.append({'kind':'section','model':max(models,key=len) if models else '2020'})
        answers.append('请看下方P2同款截面图，壁厚和槽口尺寸以图中标注为准。未指定型号时先展示2020；可以告诉我其他型号。')
    if re.search(r'运费|邮费|shipping|freight', text, re.I) and re.search(r'怎么算|怎么计算|如何|规则|划算|按|how|calcula', text, re.I):
        answers.append('运费按收货地区、计费重量和运输方式计算。普通快递：首重1kg，超过部分向上取整按续重计费；型材长度超过1500mm加20元加长费。安能：首重15kg，超过部分向上取整按续重计费。系统比较可用方式。合并发货通常能减少重复首重费，但最终要比较重量和长度。铝板、洞洞板、相框及铝框门按现有报价规则包邮。')
        _, example = quote_single({'model':'2020','color':'natural','section':'natural','tapping':'none','length':1000,'quantity':1,'province':'上海'}, 'standard')
        if example:
            answers.append(f'按现有报价模块，2020银白色1米1根、无加工发上海：预计重量{example["weight_kg"]}kg，运费¥{example["shipping_fee"]}。')
        rate = CATALOG['shipping']['standard'].get('上海')
        if rate:
            answers.append(f'例如发上海，普通快递首重¥{rate["first"]}，续重¥{rate["next"]}/kg；1米型材不触发加长费。具体重量由型号、米数和数量计算。')
    if re.search(r'柜|架子|小推车|手推车|设计|wardrobe|cabinet|trolley', text, re.I) and not re.search(r'洞洞板|铝板',text):
        defaults = {'wheels': bool(re.search(r'推车|trolley',text,re.I))}
        for field, word in [('length','长'),('width','宽'),('height','高')]:
            match = re.search(word + r'(?:度)?\s*(\d+)\s*(mm|毫米|cm|厘米)',text,re.I)
            if match:
                defaults[field] = int(match[1]) * (10 if match[2].lower() in ('cm','厘米') else 1)
        cards.append({'kind':'wardrobe','defaults':defaults})
        answers.append('可以先用下方衣柜模块调整长、宽、高、层板和门板，查看方案。' + ('小推车可先考虑带轮方案，再核对轮子和安装方式。' if re.search(r'推车|trolley',text,re.I) else '') + '已提供的尺寸可作为初稿；鱼缸承重、抽拉层等特殊结构需要进一步核对，不能仅凭外形保证承载。')
        cards.append({'kind':'contact'})
    if not re.search(r'报价|下单|加入购物车|\d+\s*(个|套|颗)',text) and re.search(r'配件|角码|螺丝|光轴|L型|T型|连接件', text, re.I) and not re.search(r'不要配件|不需要配件|不配螺丝',text):
        cards.append({'kind':'accessories'})
        answers.append('下方是配件选择器，可直接看图片选编号、系列及数量，按网站价格计算后加入购物车。' + ('光轴先按目录现有光轴方案查看，只需再确定长度和数量；连接件请对照图片选择。' if '光轴' in text else '') + '不会自动添加未选择的螺丝。')
    if re.search(r'玻璃|耐力板|聚碳酸酯',text):
        answers.append('玻璃及耐力板目前不提供，需要自行采购。可考虑我们提供的铝框门和海洋板作为替代，具体外观、厚度和用途需要你确认。')
        cards.extend([{'kind':'alternatives'}, {'kind':'contact'}])
    if not answers:
        return None
    if any(c['kind']=='contact' for c in cards): answers.append(CONTACT)
    return {'id':'sales-advice','version':1,'answer':'\n\n'.join(answers),'guidance':cards}
