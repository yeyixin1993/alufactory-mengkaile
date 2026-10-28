"""Sales questions are not incomplete purchase orders. Only trusted UI actions leave here."""
import re
from app.ai_quote import CATALOG, quote_single

CONTACT = '复杂设计或需要进一步确认，可以加微信 19821200413，发送图片一起沟通。'

def advice(message):
    text = message.strip()
    cards = []
    answers = []
    if re.search(r'海洋板|BBB', text, re.I) and re.search(r'整张|整板', text) and re.search(r'多少钱|价格|什么价|怎么卖', text) and not re.search(r'下单|加入|改成|换成|要\s*\d|买\s*\d', text):
        prices = CATALOG['quickQuote']['MARINE_BOARD_FULL_SHEET_PRICE']
        uv, plain = prices['marine_bbb_uv_film'], prices['marine_bbb_plain']
        answers.append(f"BBB整张海洋板为原色，尺寸2440×1220mm。18mm两面UV清漆+覆膜{uv['18']}元/张，素板{plain['18']}元/张；12mm两面UV清漆+覆膜{uv['12']}元/张，素板{plain['12']}元/张。按张计价，所有会员同价，运费另算。定制裁切按原平方米价计费。")
    if re.search(r'攻丝.*(深|默认|多长|长度)|tapp.*depth', text, re.I):
        answers.append('型材端面攻丝深度统一为20mm。两端攻丝指左右两个端面加工，不是型材切割长度；多孔端面还需确认攻哪些孔位。')
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
