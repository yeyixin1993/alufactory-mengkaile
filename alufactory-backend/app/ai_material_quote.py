"""QuickQuote material tariffs exported from the frontend's shared catalog."""
import math

KINDS = {'cabinet_door':'铝框门','aluminum_plate':'铝板','pegboard':'洞洞板','marine_board':'海洋板','frame':'画框','accessory':'配件'}
ALIASES = {**{v:k for k,v in KINDS.items()}, '铝型材':'profile', '型材':'profile', '相框':'frame', '铝框门':'cabinet_door', 'aluminium_plate':'aluminum_plate'}

def product_kind(row):
    value = row.get('product') or row.get('product_type') or row.get('category') or 'profile'
    return ALIASES.get(value, value)

def describe(row):
    kind = product_kind(row)
    name = KINDS.get(kind, str(kind))
    if kind == 'accessory': return f"{row.get('name') or name} × {row.get('quantity') or '?'}件"
    if kind == 'frame': return f"{name} / 内宽{row.get('inner_width') or '?'} × 内高{row.get('inner_height') or '?'}mm × {row.get('quantity') or '?'}个"
    return f"{name} / {row.get('width') or '?'} × {row.get('height') or '?'} × {row.get('thickness') or '?'}mm × {row.get('quantity') or '?'}张"

def quote_material(row, membership, catalog, rounded):
    row = dict(row)
    kind = product_kind(row)
    row['product'] = kind
    rules = catalog['quickQuote']
    questions = []
    def integer(field, label, low=1, high=10000):
        value = row.get(field)
        if type(value) is not int or not low <= value <= high:
            questions.append(f'请提供{label}（{low}–{high}）。')
            return None
        return value
    qty = integer('quantity', '数量')
    weight = 0
    shipping_known = kind in ('aluminum_plate','pegboard','frame','cabinet_door','accessory')
    extra = {}
    if kind in ('aluminum_plate','pegboard','marine_board','cabinet_door'):
        marine = kind == 'marine_board'
        door = kind == 'cabinet_door'
        if door: row['thickness'] = 2
        width = integer('width','宽度mm',1,rules['MAX_DOOR_WIDTH_MM'] if door else (2440 if marine else 2400))
        height = integer('height','高度mm',1,rules['MAX_DOOR_HEIGHT_MM'] if door else (1220 if marine else 2400 if kind == 'pegboard' else 1200))
        if kind == 'pegboard' and width and height and min(width, height) > 1200:
            questions.append('洞洞板短边不能超过1200mm，长边不能超过2400mm。')
        thickness = row.get('thickness')
        allowed = (12,18) if marine else tuple(rules['ENABLED_METAL_BOARD_THICKNESSES'])
        if type(thickness) is not int or thickness not in allowed:
            questions.append('需要多厚？可选 ' + '/'.join(map(str,allowed)) + 'mm。')
        if marine:
            spec_id = row.get('marine_spec')
            if spec_id not in rules['MARINE_BOARD_SPEC_PRICE_PER_SQM']:
                questions.append('海洋板要 BBB素板，还是 BBB两面UV清漆+覆膜？')
            color = row.get('color')
            colors = {c['id'] for c in catalog['colors']} | {c['id'] for c in catalog.get('marineColors',[])}
            if color not in colors: questions.append('海洋板要原木本色，还是其他颜色？请告诉我颜色。')
            if not questions:
                rate = rules['MARINE_BOARD_SPEC_PRICE_PER_SQM'][spec_id][str(thickness)] + (rules['MARINE_BOARD_COLORED_SURCHARGE_PER_SQM'] if color not in ('natural','wood_natural') else 0)
                weight = width*height/1e6*qty*rules['MARINE_BOARD_WEIGHT_PER_SQM'][str(thickness)]
                shipping_known = True
        else:
            key = ('VIP_PLUS_' if membership == 'vip_plus' else '') + ('PEGBOARD' if kind=='pegboard' else 'ALUMINUM_PLATE') + '_PRICE_PER_SQM'
            if not questions: rate = rules[key][str(thickness)]
        if not questions:
            area = width*height/1e6
            charged = max(rules['MIN_BOARD_CHARGE_AREA_SQM'],area)
            unit = rounded(charged*rate)
            if door:
                hinges = 2 if height <= 1500 else 3 if height <= 2000 else 4 if height <= 2500 else 5
                unit = rounded(unit + hinges * rules['DOOR_HINGE_UNIT_PRICE'])
                extra['hinge_count'] = hinges
            extra.update({'area_sqm':area,'charged_area_sqm':charged,'min_area_applied':area<charged})
    elif kind == 'frame':
        width = integer('inner_width','相框内宽mm')
        height = integer('inner_height','相框内高mm')
        if row.get('frame_type') not in ('wood','aluminum','alu_wood'):
            questions.append('画框要木框、铝框还是铝木框？')
        if not questions: unit = rounded((width+height)/10)  # QuickQuote frameCalculated formula.
    elif kind == 'accessory':
        choices = [a for a in catalog['accessories'] if a['key'] == row.get('accessory_key')]
        if not choices:
            questions.append('需要哪种配件、哪个系列（如2020/3030）？可以发名称、编号或图片。')
        else:
            item = choices[0]
            row['name'] = item['name']['cn']
            row['names'] = item['name']
            if not item.get('naturalOnly') and row.get('color') not in ('natural','colored'):
                questions.append('配件要本色还是彩色？')
            length = integer('length','轴的长度mm',1,3000) if item.get('lengthPriced') else None
            if not questions:
                tier = 'natural' if item.get('naturalOnly') or row.get('color') == 'natural' else 'colored'
                if not item.get('naturalOnly') and qty >= catalog['accessoryBulkThreshold']: tier += 'Bulk'
                unit = item['price'][tier]
                if item.get('lengthPriced'): unit = math.floor(unit*length/1000*100+0.5)/100
    else:
        questions.append('需要哪一类商品：型材、铝板、洞洞板、海洋板、画框或配件？请告诉我品类及尺寸数量。')
    if questions: return '\n'.join(questions), None
    subtotal = rounded(unit*qty)
    return '', {'spec':row,'unit_price':unit,'subtotal':subtotal,'weight_kg':weight,'shipping_weight_known':shipping_known,'free_shipping':kind in ('aluminum_plate','pegboard','frame','cabinet_door'),**extra}
