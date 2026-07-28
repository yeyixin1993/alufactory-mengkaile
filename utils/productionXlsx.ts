type WorkbookCell = string | number | null | undefined;

export interface ProductionWorkbookData {
  parts: Array<{
    line: number;
    id: string;
    type: string;
    model: string;
    lengthMm?: number;
    widthMm?: number;
    heightMm?: number;
    thicknessMm?: number;
    color: string;
    quantity: number;
    positionMm: number[];
    rotationDeg: number[];
    remark: string;
  }>;
  holes: Array<{
    partLine: number;
    model: string;
    holeLine: number;
    entryFace: string;
    entryGroove: string;
    exitFace: string;
    exitGroove: string;
    physicalGrooveId: string;
    leftDistanceMm: number;
    rightDistanceMm: number;
    holeType: string;
    threadSize: string;
    verification: string;
  }>;
}

type SheetDefinition = {
  name: string;
  title: string;
  headers: string[];
  rows: WorkbookCell[][];
  widths: number[];
};

const encoder = new TextEncoder();

const xmlEscape = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const columnName = (index: number) => {
  let current = index + 1;
  let result = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
};

const cellXml = (value: WorkbookCell, rowIndex: number, columnIndex: number, style: number) => {
  const reference = `${columnName(columnIndex)}${rowIndex}`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
  }
  const escaped = xmlEscape(value);
  const preserve = /^\s|\s$|\n/.test(String(value ?? '')) ? ' xml:space="preserve"' : '';
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t${preserve}>${escaped}</t></is></c>`;
};

const worksheetXml = (sheet: SheetDefinition) => {
  const columnCount = sheet.headers.length;
  const titleCell = cellXml(sheet.title, 1, 0, 1);
  const headerCells = sheet.headers.map((value, index) => cellXml(value, 2, index, 2)).join('');
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const isNumber = typeof value === 'number' && Number.isFinite(value);
      const isLongText = columnIndex === row.length - 1 || String(value ?? '').length > 28;
      return cellXml(value, rowIndex + 3, columnIndex, isLongText ? 5 : isNumber ? 4 : 3);
    }).join('');
    return `<row r="${rowIndex + 3}" ht="${row.some((value) => String(value ?? '').length > 42) ? 32 : 22}" customHeight="1">${cells}</row>`;
  }).join('');
  const columns = sheet.widths.map((width, index) => (
    `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`
  )).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${columns}</cols>
  <sheetData>
    <row r="1" ht="30" customHeight="1">${titleCell}</row>
    <row r="2" ht="28" customHeight="1">${headerCells}</row>
    ${rows}
  </sheetData>
  <mergeCells count="1"><mergeCell ref="A1:${columnName(columnCount - 1)}1"/></mergeCells>
  <autoFilter ref="A2:${columnName(columnCount - 1)}${Math.max(2, sheet.rows.length + 2)}"/>
  <pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
</worksheet>`;
};

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="10"/><name val="Arial"/></font>
    <font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
  </fonts>
  <fills count="4">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top style="thin"><color rgb="FFE2E8F0"/></top><bottom style="thin"><color rgb="FFE2E8F0"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
    <xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

const crc32 = (bytes: Uint8Array) => {
  let crc = 0xffffffff;
  bytes.forEach((byte) => {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  });
  return (crc ^ 0xffffffff) >>> 0;
};

const concatBytes = (chunks: Uint8Array[]) => {
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });
  return output;
};

const zipStore = (entries: Array<{ name: string; content: string }>) => {
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;
  const now = new Date();
  const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((Math.floor(now.getSeconds() / 2)) & 0x1f);
  const dosDate = (((now.getFullYear() - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);

  entries.forEach((entry) => {
    const name = encoder.encode(entry.name);
    const content = encoder.encode(entry.content);
    const checksum = crc32(content);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, dosTime, true);
    localView.setUint16(12, dosDate, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, content.length, true);
    localView.setUint32(22, content.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    localChunks.push(local, content);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, dosTime, true);
    centralView.setUint16(14, dosDate, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, content.length, true);
    centralView.setUint32(24, content.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, localOffset, true);
    central.set(name, 46);
    centralChunks.push(central);
    localOffset += local.length + content.length;
  });

  const centralDirectory = concatBytes(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralDirectory.length, true);
  endView.setUint32(16, localOffset, true);
  return concatBytes([...localChunks, centralDirectory, end]);
};

export const buildProductionXlsx = (production: ProductionWorkbookData) => {
  const guideRows: WorkbookCell[][] = [
    ['核心规则', 'physicalGrooveIndex（P1/P2…）是3D、客户图和工厂图的唯一物理槽位基准。'],
    ['2040示例', 'B面第一槽 = 物理P1 = D面第二槽；B面第二槽 = 物理P2 = D面第一槽。'],
    ['生产核对', '加工前同时核对入口面/槽、出口面/槽、物理槽ID及距左右端尺寸。'],
  ];
  const partRows = production.parts.map((part) => [
    part.line, part.id, part.type, part.model, part.lengthMm ?? '', part.widthMm ?? '', part.heightMm ?? '',
    part.thicknessMm ?? '', part.color, part.quantity, part.positionMm.join(', '), part.rotationDeg.join(', '), part.remark,
  ]);
  const holeRows = production.holes.map((hole) => [
    hole.partLine, hole.model, hole.holeLine, hole.entryFace, hole.entryGroove, hole.exitFace, hole.exitGroove,
    hole.physicalGrooveId, hole.leftDistanceMm, hole.rightDistanceMm, hole.holeType, hole.threadSize, hole.verification,
  ]);
  const sheets: SheetDefinition[] = [
    {
      name: '核对说明',
      title: '萌开了 3D DIY 生产核对说明',
      headers: ['项目', '说明'],
      rows: guideRows,
      widths: [18, 88],
    },
    {
      name: '零件明细',
      title: '萌开了 3D DIY 零件明细',
      headers: ['序号', '零件ID', '类型', '型号', '长度mm', '宽度mm', '高度mm', '厚度mm', '颜色', '数量', '位置XYZ(mm)', '旋转XYZ(°)', '备注'],
      rows: partRows,
      widths: [8, 25, 14, 14, 12, 12, 12, 12, 15, 9, 20, 20, 38],
    },
    {
      name: '打孔明细',
      title: '萌开了 3D DIY 打孔明细',
      headers: ['零件序号', '型号', '孔序号', '入口面', '入口二维槽位', '出口面', '出口二维槽位', '物理槽ID', '距左端mm', '距右端mm', '孔类型', '螺纹', '客户/工厂核对'],
      rows: holeRows,
      widths: [11, 14, 10, 10, 15, 10, 15, 12, 13, 13, 14, 10, 42],
    },
  ];

  const workbookSheets = sheets.map((sheet, index) => (
    `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )).join('');
  const workbookRelationships = sheets.map((_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('');
  const contentOverrides = sheets.map((_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('');

  const entries = [
    {
      name: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${contentOverrides}
</Types>`,
    },
    {
      name: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000"/></bookViews>
  <sheets>${workbookSheets}</sheets>
</workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRelationships}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    },
    { name: 'xl/styles.xml', content: stylesXml },
    ...sheets.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      content: worksheetXml(sheet),
    })),
  ];
  return zipStore(entries);
};
