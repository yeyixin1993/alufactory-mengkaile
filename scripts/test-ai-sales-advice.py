"""Run without booting the database or requiring provider secrets."""
import ast
import json
import pathlib
import sys
import types
root = pathlib.Path(__file__).resolve().parents[1]
app = types.ModuleType('app')
app.__path__ = [str(root / 'alufactory-backend/app')]
sys.modules['app'] = app
from app.ai_advice import advice
assert '20mm' in advice('4080型材两端攻丝默认多少长度')['answer']
assert '¥12.0' in advice('运费是怎么计算')['answer']
assert '合并发货' in advice('多根一起发货还是分批发货运费划算')['answer']
assert advice('4080壁厚多少')['guidance'][0]['model'] == '4080'
assert advice('需要光轴及连接件')['guidance'][0]['kind'] == 'accessories'
assert advice('2020角码10个报价') is None
assert advice('洞洞板800*600mm，2mm厚，1张') is None
assert advice('1') is None
cabinet = advice('鱼缸柜长度630mm，宽度330mm，高度880mm')
assert cabinet['guidance'][0]['defaults']['height'] == 880
assert advice('设计小推车')['guidance'][0]['defaults']['wheels']
assert '自行采购' in advice('正面玻璃门，侧面耐力板')['answer']
assert '19821200413' in cabinet['answer']
# Exercise production history compaction without initializing Flask/database.
tree = ast.parse((root/'alufactory-backend/app/routes/ai_chat.py').read_text())
node = next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='retain_quote_context')
ns = {'json':json}
exec(compile(ast.Module(body=[node],type_ignores=[]),'<history>','exec'), ns)
snapshot = {'role':'assistant','content':json.dumps({'items':[{'product':'pegboard','quantity':1}]})}
assert ns['retain_quote_context']([snapshot]+[{'role':'user','content':'问题'}]*12)[0] == snapshot
print('AI sales advice: 13 regression checks passed')
