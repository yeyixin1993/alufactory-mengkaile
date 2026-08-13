"""Profile inventory catalog, stock aggregation and small XLSX interchange helpers."""
from collections import defaultdict
from datetime import datetime
from io import BytesIO
from xml.etree import ElementTree as ET
from zipfile import ZIP_DEFLATED, ZipFile

from app.models.user import ProfileInventory, db


PROFILE_VARIANTS = (
    '1515', '1515-N1', '1515-N2', '2020', '2020-N1', '2020-N2', '2020-N2-OPP',
    '2020-N3', '2020-N4-SQ', '2020-N4-RD', '2020R', '2040', '2040-N1-20',
    '2040-N1-40', '2047', '2060', '20100', '3030', '3030-N1', '3030-N2',
    '3030R', '3060', '3060-N1-60', '4040', '4080',
)

PROFILE_COLORS = {
    'natural': '银白', 'silver': '亮银色', 'red': '中国红', 'cola_red': '可乐红',
    'sapphire_blue': '宝石蓝', 'purple': '紫色', 'sky_blue': '浅青蓝', 'green': '松绿',
    'willow_green': '柳绿', 'qingli_coffee': '青骊咖', 'beige': '米白',
    'indigo_blue': '黛蓝', 'cool_green': '冷青绿', 'ink_green': '墨青绿',
    'apple_gold': '苹果金', 'olive_brown': '橄榄棕', 'lime_gold': '青金',
    'pink': '丁香粉', 'coffee': '摩卡咖', 'black': '暗夜黑', 'british_grey': '深空灰',
}

RAW_MATERIAL_COLOR_ID = 'raw_material'
INVENTORY_COLORS = {**PROFILE_COLORS, RAW_MATERIAL_COLOR_ID: '坯料'}
ALLOWED_BAR_LENGTHS = (3.15,)
INVENTORY_HEADERS = ('型材型号', '颜色ID', '颜色名称', '单支长度(米)', '库存支数', '库存总米数')


def seed_profile_inventory():
    """Ensure every supported model/color/bar-length combination can be edited immediately."""
    existing = {
        (row.variant_id, row.color_id, round(float(row.bar_length_m), 2))
        for row in ProfileInventory.query.all()
    }
    additions = []
    for variant_id in PROFILE_VARIANTS:
        for color_id in INVENTORY_COLORS:
            for bar_length in ALLOWED_BAR_LENGTHS:
                key = (variant_id, color_id, round(bar_length, 2))
                if key not in existing:
                    additions.append(ProfileInventory(
                        variant_id=variant_id,
                        color_id=color_id,
                        bar_length_m=bar_length,
                        bar_count=0,
                    ))
    if additions:
        db.session.add_all(additions)
        db.session.commit()
    return len(additions)


def aggregate_public_stock():
    totals = defaultdict(float)
    for row in ProfileInventory.query.filter(
        ProfileInventory.color_id.in_(PROFILE_COLORS),
        ProfileInventory.bar_length_m.in_(ALLOWED_BAR_LENGTHS),
    ).all():
        totals[(row.variant_id, row.color_id)] += row.total_meters
    return [
        {
            'variant_id': variant_id,
            'color_id': color_id,
            'total_meters': round(total_meters, 3),
        }
        for (variant_id, color_id), total_meters in sorted(totals.items())
    ]


def _column_name(index):
    result = ''
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def _xml_escape(value):
    return (str(value).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;'))


def _xlsx_cell(ref, value, style=0):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f'<c r="{ref}" s="{style}"><v>{value}</v></c>'
    return f'<c r="{ref}" s="{style}" t="inlineStr"><is><t>{_xml_escape(value)}</t></is></c>'


def build_inventory_xlsx(rows):
    data_rows = [
        INVENTORY_HEADERS,
        *[
            (
                row.variant_id,
                row.color_id,
                INVENTORY_COLORS.get(row.color_id, row.color_id),
                float(row.bar_length_m),
                int(row.bar_count),
                row.total_meters,
            )
            for row in rows
        ],
    ]
    sheet_rows = []
    for row_index, values in enumerate(data_rows, start=1):
        cells = ''.join(
            _xlsx_cell(f'{_column_name(column_index)}{row_index}', value, 1 if row_index == 1 else (2 if column_index >= 4 else 0))
            for column_index, value in enumerate(values, start=1)
        )
        sheet_rows.append(f'<row r="{row_index}">{cells}</row>')

    worksheet = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:F{len(data_rows)}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="18" customWidth="1"/><col min="2" max="2" width="20" customWidth="1"/><col min="3" max="3" width="16" customWidth="1"/><col min="4" max="6" width="16" customWidth="1"/></cols>
  <sheetData>{''.join(sheet_rows)}</sheetData>
  <autoFilter ref="A1:F{len(data_rows)}"/>
</worksheet>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts>
  <fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>'''
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'''
    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'''
    workbook = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="型材库存" sheetId="1" r:id="rId1"/></sheets></workbook>'''
    workbook_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'''

    output = BytesIO()
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        archive.writestr('[Content_Types].xml', content_types)
        archive.writestr('_rels/.rels', root_rels)
        archive.writestr('xl/workbook.xml', workbook)
        archive.writestr('xl/_rels/workbook.xml.rels', workbook_rels)
        archive.writestr('xl/styles.xml', styles)
        archive.writestr('xl/worksheets/sheet1.xml', worksheet)
    output.seek(0)
    return output


def _cell_value(cell, shared_strings):
    namespace = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    cell_type = cell.attrib.get('t')
    if cell_type == 'inlineStr':
        return ''.join(node.text or '' for node in cell.findall('.//m:t', namespace))
    value_node = cell.find('m:v', namespace)
    raw = value_node.text if value_node is not None else ''
    if cell_type == 's':
        try:
            return shared_strings[int(raw)]
        except (ValueError, IndexError):
            return ''
    return raw


def parse_inventory_xlsx(file_stream):
    namespace = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with ZipFile(file_stream) as archive:
        shared_strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            shared_strings = [''.join(node.text or '' for node in item.findall('.//m:t', namespace)) for item in root.findall('m:si', namespace)]
        sheet_path = 'xl/worksheets/sheet1.xml'
        root = ET.fromstring(archive.read(sheet_path))
        parsed_rows = []
        for row in root.findall('.//m:sheetData/m:row', namespace):
            values = {}
            for cell in row.findall('m:c', namespace):
                ref = cell.attrib.get('r', '')
                column = ''.join(ch for ch in ref if ch.isalpha())
                values[column] = _cell_value(cell, shared_strings)
            parsed_rows.append([values.get(column, '') for column in ('A', 'B', 'C', 'D', 'E', 'F')])

    if not parsed_rows:
        raise ValueError('Excel中没有库存数据')
    header = [str(value).strip() for value in parsed_rows[0]]
    if header[:5] != list(INVENTORY_HEADERS[:5]):
        raise ValueError('Excel列格式不正确，请先下载库存模板后再编辑上传')

    records = []
    for row_number, values in enumerate(parsed_rows[1:], start=2):
        if not any(str(value).strip() for value in values):
            continue
        variant_id = str(values[0]).strip()
        color_id = str(values[1]).strip()
        try:
            bar_length = round(float(values[3]), 2)
            bar_count = int(float(values[4]))
        except (TypeError, ValueError):
            raise ValueError(f'第{row_number}行的单支长度或库存支数不是有效数字')
        if variant_id not in PROFILE_VARIANTS:
            raise ValueError(f'第{row_number}行型材型号不支持：{variant_id}')
        if color_id not in INVENTORY_COLORS:
            raise ValueError(f'第{row_number}行颜色ID不支持：{color_id}')
        if bar_length not in ALLOWED_BAR_LENGTHS:
            raise ValueError(f'第{row_number}行单支长度只能是3.15米')
        if bar_count < 0:
            raise ValueError(f'第{row_number}行库存支数不能为负数')
        records.append((variant_id, color_id, bar_length, bar_count))
    return records


def apply_inventory_records(records):
    updated = 0
    for variant_id, color_id, bar_length, bar_count in records:
        row = ProfileInventory.query.filter_by(
            variant_id=variant_id,
            color_id=color_id,
            bar_length_m=bar_length,
        ).first()
        if row is None:
            row = ProfileInventory(variant_id=variant_id, color_id=color_id, bar_length_m=bar_length)
            db.session.add(row)
        row.bar_count = bar_count
        row.updated_at = datetime.utcnow()
        updated += 1
    db.session.commit()
    return updated
