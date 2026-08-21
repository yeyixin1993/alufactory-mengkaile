"""Accessory inventory catalog, public stock and lightweight XLSX interchange."""
from datetime import datetime
from io import BytesIO
from xml.etree import ElementTree as ET
from zipfile import ZIP_DEFLATED, ZipFile

from app.models.user import AccessoryInventory, db
from app.profile_inventory import _cell_value, _column_name, _xlsx_cell


ACCESSORY_CATALOG = {
    '1': {'code': '1', 'name': '1号角码配螺丝', 'sizes': ('2020', '3030')},
    '2': {'code': '2', 'name': '2号挤压角码', 'sizes': ('1515', '2020', '3030')},
    '5': {'code': '5', 'name': '5号隐藏角码配顶丝', 'sizes': ('2020', '3030')},
    '7L': {'code': '7L', 'name': '7号L型连接板', 'sizes': ('1515', '2020', '3030', '4040')},
    '7T': {'code': '7T', 'name': '7号T型连接板', 'sizes': ('1515', '2020', '3030', '4040')},
    '9': {'code': '9', 'name': '9号三通', 'sizes': ('1515', '2020', '3030')},
    'end_cap_2020': {'code': '端盖', 'name': '2020铝型材端盖', 'sizes': ('2020',)},
    'end_cap_3030': {'code': '端盖', 'name': '3030铝型材端盖', 'sizes': ('3030',)},
    '10_1515_m4x6_cap': {'code': '10', 'name': '304 M4*6 圆柱头内六角', 'sizes': ('1515',)},
    '10_1515_m4x12_cap': {'code': '10', 'name': '304 M4*12 圆柱头内六角', 'sizes': ('1515',)},
    '10_1515_m4x10_cs': {'code': '10', 'name': '304 M4*10 沉头内六角', 'sizes': ('1515',)},
    '10_1515_m4_tnut': {'code': '10', 'name': '304 1515 M4 T型螺母', 'sizes': ('1515',)},
    '10_2020_m5x14_cap': {'code': '10', 'name': '304 M5*14 圆柱头内六角', 'sizes': ('2020',)},
    '10_2020_m5x8_cap': {'code': '10', 'name': '304 M5*8 圆柱头内六角', 'sizes': ('2020',)},
    '10_2020_m6x20_cs': {'code': '10', 'name': '304 M6*20 沉头内六角', 'sizes': ('2020',)},
    '10_2020_m5_tnut': {'code': '10', 'name': '304 2020 M5 T型螺母', 'sizes': ('2020',)},
    '10_3030_m6x18_cap': {'code': '10', 'name': '304 M6*18 圆柱头内六角', 'sizes': ('3030',)},
    '10_3030_m6x12_cap': {'code': '10', 'name': '304 M6*12 圆柱头内六角', 'sizes': ('3030',)},
    '10_3030_m8x20_cs': {'code': '10', 'name': '304 M8*20 沉头内六角', 'sizes': ('3030',)},
    '10_3030_m6_tnut': {'code': '10', 'name': '304 3030 M6 T型螺母', 'sizes': ('3030',)},
}

ACCESSORY_FINISH_ID = 'natural'
ACCESSORY_INVENTORY_HEADERS = ('配件ID', '编号', '配件名称', '适配型号', '库存数量')


def serialize_accessory_inventory(row):
    data = row.to_dict()
    data.pop('color_id', None)
    definition = ACCESSORY_CATALOG.get(row.accessory_id, {})
    data.update({
        'code': definition.get('code', row.accessory_id),
        'accessory_name': definition.get('name', row.accessory_id),
    })
    return data


def seed_accessory_inventory():
    removed = AccessoryInventory.query.filter(
        AccessoryInventory.color_id != ACCESSORY_FINISH_ID,
    ).delete(synchronize_session=False)
    existing = {
        (row.accessory_id, row.profile_size, row.color_id)
        for row in AccessoryInventory.query.filter_by(color_id=ACCESSORY_FINISH_ID).all()
    }
    additions = []
    for accessory_id, definition in ACCESSORY_CATALOG.items():
        for profile_size in definition['sizes']:
            key = (accessory_id, profile_size, ACCESSORY_FINISH_ID)
            if key not in existing:
                additions.append(AccessoryInventory(
                    accessory_id=accessory_id,
                    profile_size=profile_size,
                    color_id=ACCESSORY_FINISH_ID,
                    quantity=0,
                ))
    if additions:
        db.session.add_all(additions)
    if removed or additions:
        db.session.commit()
    return len(additions)


def public_accessory_stock():
    return [
        serialize_accessory_inventory(row)
        for row in AccessoryInventory.query.filter_by(color_id=ACCESSORY_FINISH_ID).order_by(
            AccessoryInventory.accessory_id.asc(),
            AccessoryInventory.profile_size.asc(),
        ).all()
    ]


def build_accessory_inventory_xlsx(rows):
    data_rows = [ACCESSORY_INVENTORY_HEADERS]
    data_rows.extend((
        row.accessory_id,
        ACCESSORY_CATALOG[row.accessory_id]['code'],
        ACCESSORY_CATALOG[row.accessory_id]['name'],
        row.profile_size,
        int(row.quantity or 0),
    ) for row in rows if row.color_id == ACCESSORY_FINISH_ID)
    sheet_rows = []
    for row_index, values in enumerate(data_rows, start=1):
        cells = ''.join(
            _xlsx_cell(
                f'{_column_name(column_index)}{row_index}', value,
                1 if row_index == 1 else (2 if column_index == 5 else 0),
            )
            for column_index, value in enumerate(values, start=1)
        )
        sheet_rows.append(f'<row r="{row_index}">{cells}</row>')

    worksheet = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:E{len(data_rows)}"/>
  <sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <cols><col min="1" max="1" width="28" customWidth="1"/><col min="2" max="2" width="10" customWidth="1"/><col min="3" max="3" width="34" customWidth="1"/><col min="4" max="5" width="16" customWidth="1"/></cols>
  <sheetData>{''.join(sheet_rows)}</sheetData><autoFilter ref="A1:E{len(data_rows)}"/>
</worksheet>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF7C3AED"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'''
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'''
    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'''
    workbook = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="配件库存" sheetId="1" r:id="rId1"/></sheets></workbook>'''
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


def parse_accessory_inventory_xlsx(file_stream):
    namespace = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    with ZipFile(file_stream) as archive:
        shared_strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            root = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            shared_strings = [''.join(node.text or '' for node in item.findall('.//m:t', namespace)) for item in root.findall('m:si', namespace)]
        root = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
        parsed_rows = []
        for row in root.findall('.//m:sheetData/m:row', namespace):
            values = {}
            for cell in row.findall('m:c', namespace):
                ref = cell.attrib.get('r', '')
                column = ''.join(ch for ch in ref if ch.isalpha())
                values[column] = _cell_value(cell, shared_strings)
            parsed_rows.append([values.get(column, '') for column in ('A', 'B', 'C', 'D', 'E')])
    if not parsed_rows:
        raise ValueError('Excel中没有库存数据')
    if [str(value).strip() for value in parsed_rows[0]][:5] != list(ACCESSORY_INVENTORY_HEADERS):
        raise ValueError('Excel列格式不正确，请先下载配件库存模板后再编辑上传')
    records = []
    for row_number, values in enumerate(parsed_rows[1:], start=2):
        if not any(str(value).strip() for value in values):
            continue
        accessory_id = str(values[0]).strip()
        profile_size = str(values[3]).strip()
        try:
            quantity = int(float(values[4]))
        except (TypeError, ValueError):
            raise ValueError(f'第{row_number}行库存数量不是有效整数')
        definition = ACCESSORY_CATALOG.get(accessory_id)
        if not definition:
            raise ValueError(f'第{row_number}行配件ID不支持：{accessory_id}')
        if profile_size not in definition['sizes']:
            raise ValueError(f'第{row_number}行配件不支持{profile_size}型材')
        if quantity < 0:
            raise ValueError(f'第{row_number}行库存数量不能为负数')
        records.append((accessory_id, profile_size, quantity))
    return records


def apply_accessory_inventory_records(records):
    updated = 0
    for accessory_id, profile_size, quantity in records:
        row = AccessoryInventory.query.filter_by(
            accessory_id=accessory_id,
            profile_size=profile_size,
            color_id=ACCESSORY_FINISH_ID,
        ).first()
        if row is None:
            row = AccessoryInventory(
                accessory_id=accessory_id,
                profile_size=profile_size,
                color_id=ACCESSORY_FINISH_ID,
            )
            db.session.add(row)
        row.quantity = quantity
        row.updated_at = datetime.utcnow()
        updated += 1
    db.session.commit()
    return updated
