"""用 formulas 引擎把 xlsx 里所有公式算一遍，把结果写回 <c> 的缓存值 <v>，避免预览/部分阅读器显示空白。

用法：python recalc.py <xlsx路径>
幂等：重复执行只是覆盖同样的缓存值。
"""
import re
import shutil
import sys
import zipfile
from pathlib import Path


def main(path: Path) -> None:
    import formulas

    xl = formulas.ExcelModel().loads(str(path)).finish()
    sol = xl.calculate()

    values = {}  # ("SHEETNAME", "A1") -> python 值
    for key, val in sol.items():
        m = re.match(r"^'\[[^\]]+\]([^']+)'!([A-Z]+\d+)$", key)
        if not m:
            continue
        sheet, addr = m.group(1).upper(), m.group(2)
        try:
            v = val.value[0, 0]
        except Exception:
            try:
                v = val.value
            except Exception:
                continue
        values[(sheet, addr)] = v

    tmp = Path(str(path) + ".tmp.xlsx")
    sheet_order = {}
    with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        names = zin.namelist()
        # 读 workbook.xml 拿 sheet 名 -> sheet 文件顺序
        wbxml = zin.read("xl/workbook.xml").decode("utf-8")
        sheet_order = re.findall(r'<sheet[^>]*name="([^"]+)"[^>]*r:id="rId(\d+)"', wbxml)
        relxml = zin.read("xl/_rels/workbook.xml.rels").decode("utf-8")
        relmap = {}
        for tag in re.findall(r"<Relationship[^>]*/>", relxml):
            rid = re.search(r'Id="([^"]+)"', tag)
            tgt = re.search(r'Target="([^"]+)"', tag)
            if rid and tgt:
                relmap[rid.group(1)] = tgt.group(1)
        # (sheetname, sheetfile) 列表
        pairs = [(nm, relmap.get("rId" + rid, "").lstrip("/")) for nm, rid in sheet_order]

        for name in names:
            data = zin.read(name)
            target = None
            for nm, sf in pairs:
                if sf == name:
                    target = nm.upper()
                    break
            if target:
                xml = data.decode("utf-8")
                xml = inject(xml, target, values)
                data = xml.encode("utf-8")
            zout.writestr(name, data)

    hits = []  # noqa: F841

    shutil.move(str(tmp), str(path))
    # 统计
    total = sum(1 for (s, _) in values)
    print(f"computed cells: {total}; rewritten: {path}")


CELL_RE = re.compile(r"<c r=\"([A-Z]+\d+)\"([^>]*)>(.*?)</c>", re.S)
F_RE = re.compile(r"<f[ >].*?</f>", re.S)
V_RE = re.compile(r"<v\s*/>|<v>.*?</v>", re.S)


def fmt(v) -> str | None:
    if v is None:
        return None
    if isinstance(v, bool):
        return str(int(v))
    if isinstance(v, str):
        return v
    if isinstance(v, (int, float)):
        return repr(float(v)) if isinstance(v, float) else str(v)
    return str(v)


def inject(xml: str, sheet: str, values: dict) -> str:
    def repl(m):
        addr, attrs, body = m.group(1), m.group(2), m.group(3)
        if "<f" not in body:
            return m.group(0)
        key = (sheet, addr)
        if key not in values:
            return m.group(0)
        text = fmt(values[key])
        if text is None:
            return m.group(0)
        # 去掉旧缓存值
        newbody = V_RE.sub("", F_RE.sub(lambda fm: fm.group(0), body))
        # 把 <v> 插到 </f> 之后
        newbody = F_RE.sub(lambda fm: fm.group(0) + f"<v>{escape(text)}</v>", newbody, count=1)
        # 根据类型调整 t 属性
        if isinstance(values[key], str):
            attrs = re.sub(r'\s*t="[^"]*"', '', attrs)
            newattrs = attrs + ' t="str"'
        else:
            attrs = re.sub(r'\s*t="[^"]*"', '', attrs)
            newattrs = attrs
        return f'<c r="{addr}"{newattrs}>{newbody}</c>'

    return CELL_RE.sub(repl, xml)


def escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
