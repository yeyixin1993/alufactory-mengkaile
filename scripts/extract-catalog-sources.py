"""Read original customer workbooks for the reproducible catalog export.

Usage: bundled-python scripts/extract-catalog-sources.py [source-directory]
This does not modify the original XLSX files.
"""
import json
import sys
import zipfile
from pathlib import Path
import openpyxl

source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / 'Downloads'
names = ['萌开了板子价格计算.xlsx', '铝型材及配件价格表260325.xlsx']
result = {}
for name in names:
    book = openpyxl.load_workbook(source / name)
    result[name] = {sheet.title: [[cell.value for cell in row] for row in sheet] for sheet in book}
Path('/private/tmp/mengkaile-source-workbooks.json').write_text(json.dumps(result, ensure_ascii=False, default=str))
work = Path('/private/tmp/mengkaile-workbooks')
work.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(source / names[1]) as archive:
    (work / 'original-accessories.png').write_bytes(archive.read('xl/media/image1.png'))
