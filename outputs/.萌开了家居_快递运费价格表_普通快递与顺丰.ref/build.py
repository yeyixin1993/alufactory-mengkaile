"""萌开了家居 运费价格表（普通快递 / 顺丰 / 安能）——从 constants.ts 现读费率生成 Excel。

口径与 App.tsx 的 calcShippingForMethod 完全一致：
  普通/顺丰：首重1kg + (ceil(重量)-1) × 续重，超长（型材>1500mm）+¥20
  安能：≤15kg 收首重一口价；>15kg 收 首重 + ceil(重量-15) × 续重，不加超长费
用法：python build.py   （环境变量 STATIC=1 时改输出纯静态值、不含公式）
"""
import math
import os
import re
import sys
from pathlib import Path

# STATIC=1：不写任何 Excel 公式，全部由 Python 算好落值（没有 recalc 引擎时用它出货）
STATIC = os.environ.get("STATIC") == "1"

try:
    import openpyxl
except ImportError:
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "openpyxl>=3.1.0"])
    import openpyxl

from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path("/Users/eliye/mengkaile/alufactory-mengkaile")
OUTPUT_XLSX = ROOT / "outputs/萌开了家居_运费价格表_普通快递-顺丰-安能.xlsx"
CONSTANTS = ROOT / "constants.ts"
APP_TSX = ROOT / "App.tsx"
TITLE = "萌开了家居 运费价格表（普通快递·顺丰·安能）"
EXPORT_DATE = "2026-10-25"
ANNENG_FREE_KG = 15  # 安能首重包含的重量（≤15kg 一口价）
W_LIGHT, W_HEAVY = 5, 20  # 对照重量（轻件 / 重件）


def xl_color(css_hex: str) -> str:
    value = css_hex.removeprefix("#").upper()
    if len(value) != 6:
        raise ValueError(f"Expected #RRGGBB, got: {css_hex}")
    return "FF" + value


XL_PRIMARY = xl_color("#4472C4")
XL_PRIMARY_DARK = xl_color("#2F5597")
XL_HEADER_TEXT = xl_color("#FFFFFF")
XL_INPUT = xl_color("#D9E2F3")
XL_CALC = xl_color("#F2F2F2")
XL_AN_BG = xl_color("#E2EFDA")
XL_WARN_BG = xl_color("#FFEB9C")
XL_WARN_TEXT = xl_color("#9C6500")
XL_BORDER = xl_color("#BFBFBF")
XL_NOTE = xl_color("#FFF7E6")
XL_STD_BG = xl_color("#F2F6FC")
XL_SF_BG = xl_color("#FDF0E8")

thin_side = Side(style="thin", color=XL_BORDER)
thin_box = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

MONEY = "¥#,##0.00"

# ---------------------------------------------------------------- 读取费率
def _fb(var_name: str) -> tuple:
    """从 App.tsx 的 calcShippingForMethod 里现读某家「省份查不到时的兜底价」，避免与代码漂移。"""
    app = APP_TSX.read_text(encoding="utf-8")
    pattern = (
        re.escape(f"{var_name}[province] || {{ first: ")
        + r"([\d.]+)"
        + re.escape(", next: ")
        + r"([\d.]+)"
    )
    m = re.search(pattern, app)
    if not m:
        raise SystemExit(f"App.tsx 里找不到 {var_name} 的兜底价")
    return float(m.group(1)), float(m.group(2))


def read_rates():
    text = CONSTANTS.read_text(encoding="utf-8")

    def grab(name):
        start = text.index(f"export const {name}")
        end = text.index("};", start)
        body = text[start:end]
        out = re.findall(r"(\S+):\s*\{\s*first:\s*([\d.]+),\s*next:\s*([\d.]+)\s*\}", body)
        return [(k, float(a), float(b)) for k, a, b in out]

    std = grab("SHIPPING_RATES:")
    sf = grab("SHIPPING_RATES_SF:")
    an = grab("SHIPPING_RATES_AN:")
    if not (len(std) == len(sf) == len(an) == 31):
        raise SystemExit(f"费率解析异常：普通 {len(std)} / 顺丰 {len(sf)} / 安能 {len(an)}")
    keys_std = [k for k, _, _ in std]
    if keys_std != [k for k, _, _ in sf] or keys_std != [k for k, _, _ in an]:
        raise SystemExit("三套费率的地区顺序不一致，请核对 constants.ts")
    # App.tsx calcShippingForMethod 里省份查不到时的兜底值（现读源码，避免与代码漂移）
    fallback = {
        "standard": _fb("SHIPPING_RATES"),
        "sf": _fb("SHIPPING_RATES_SF"),
        "anneng": _fb("SHIPPING_RATES_AN"),
    }
    return std, sf, an, fallback


STD, SF, AN, FALLBACK = read_rates()
REGIONS = [k for k, _, _ in STD]
FALLBACK_LABEL = "未列出地区（系统兜底）"
LOOKUP_REGIONS = REGIONS + [FALLBACK_LABEL]

wb = openpyxl.Workbook()
wb.properties.title = TITLE
wb.properties.creator = "萌开了家居"
# 让 Excel/WPS 打开即重算，改输入单元格后结果自动更新
wb.calculation.fullCalcOnLoad = True

SHEET_RATE = "运费价格表"
SHEET_CALC = "运费试算"
SHEET_NOTE = "计费说明"
WB = SHEET_RATE  # 公式里引用的工作表名

# ============================================================ Sheet 1 价格表
ws = wb.active
ws.title = SHEET_RATE

HEADER_ROW = 3
FIRST_DATA_ROW = 4
HEADERS = [
    "序号",
    "省份 / 地区",
    "普通快递 首重1kg(¥)",
    "普通快递 续重每kg(¥)",
    "顺丰快递 首重1kg(¥)",
    "顺丰快递 续重每kg(¥)",
    f"安能物流 {ANNENG_FREE_KG}kg内(¥)",
    f"安能物流 超{ANNENG_FREE_KG}kg每kg(¥)",
    f"{W_LIGHT}kg 普通(¥)",
    f"{W_LIGHT}kg 顺丰(¥)",
    f"{W_LIGHT}kg 安能(¥)",
    f"{W_HEAVY}kg 普通(¥)",
    f"{W_HEAVY}kg 顺丰(¥)",
    f"{W_HEAVY}kg 安能(¥)",
    f"{W_LIGHT}kg 更便宜",
    f"{W_HEAVY}kg 更便宜",
]
NCOL = len(HEADERS)

# 列所属分组（用于底色区分三家）
GROUP_BG = {"std": XL_STD_BG, "sf": XL_SF_BG, "an": XL_AN_BG}


def group_of(col_idx: int):
    if col_idx in (3, 4, 9, 12):
        return "std"
    if col_idx in (5, 6, 10, 13):
        return "sf"
    if col_idx in (7, 8, 11, 14):
        return "an"
    return None


ws["A1"] = TITLE
ws["A1"].font = Font(size=15, bold=True, color=XL_PRIMARY_DARK)
ws["A2"] = (
    f"数据来源：网站 constants.ts（SHIPPING_RATES / SHIPPING_RATES_SF / SHIPPING_RATES_AN），导出日期 {EXPORT_DATE}；"
    f"运费算法同 App.tsx 的 calcShippingForMethod。{W_LIGHT}kg / {W_HEAVY}kg 对照列均不含超长费。"
)
ws["A2"].font = Font(size=9, color=XL_WARN_TEXT)

for col, name in enumerate(HEADERS, start=1):
    c = ws.cell(row=HEADER_ROW, column=col, value=name)
    grp = group_of(col)
    if grp:
        c.fill = PatternFill("solid", fgColor=GROUP_BG[grp])
        c.font = Font(bold=True, color=XL_PRIMARY_DARK)
    else:
        c.fill = PatternFill("solid", fgColor=XL_PRIMARY)
        c.font = Font(bold=True, color=XL_HEADER_TEXT)
    c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    c.border = thin_box

last_row = FIRST_DATA_ROW + len(LOOKUP_REGIONS) - 1


def fee_std(first, nxt, w):
    return round(first + (max(1, math.ceil(w)) - 1) * nxt, 2)


def fee_an(first, nxt, w):
    if w <= ANNENG_FREE_KG:
        return round(first, 2)
    return round(first + math.ceil(w - ANNENG_FREE_KG) * nxt, 2)


def cheapest(std_v, sf_v, an_v):
    # 与 App.tsx 的 cheapest 判定一致
    if std_v <= sf_v and std_v <= an_v:
        return "普通快递"
    if sf_v <= an_v:
        return "顺丰快递"
    return "安能物流"


for i, region in enumerate(LOOKUP_REGIONS):
    r = FIRST_DATA_ROW + i
    if region == FALLBACK_LABEL:
        std_first, std_next = FALLBACK["standard"]
        sf_first, sf_next = FALLBACK["sf"]
        an_first, an_next = FALLBACK["anneng"]
    else:
        idx = REGIONS.index(region)
        _, std_first, std_next = STD[idx]
        _, sf_first, sf_next = SF[idx]
        _, an_first, an_next = AN[idx]

    ws.cell(row=r, column=1, value="—" if region == FALLBACK_LABEL else i + 1).alignment = Alignment(horizontal="center")
    ws.cell(row=r, column=2, value=region).alignment = Alignment(horizontal="left")
    for col_i, val in ((3, std_first), (4, std_next), (5, sf_first), (6, sf_next), (7, an_first), (8, an_next)):
        ws.cell(row=r, column=col_i, value=val).number_format = MONEY

    if STATIC:
        vals = {
            9: fee_std(std_first, std_next, W_LIGHT),
            10: fee_std(sf_first, sf_next, W_LIGHT),
            11: fee_an(an_first, an_next, W_LIGHT),
            12: fee_std(std_first, std_next, W_HEAVY),
            13: fee_std(sf_first, sf_next, W_HEAVY),
            14: fee_an(an_first, an_next, W_HEAVY),
        }
        for col_i, v in vals.items():
            ws.cell(row=r, column=col_i, value=v).number_format = MONEY
        ws.cell(row=r, column=15, value=cheapest(vals[9], vals[10], vals[11])).alignment = Alignment(horizontal="center")
        ws.cell(row=r, column=16, value=cheapest(vals[12], vals[13], vals[14])).alignment = Alignment(horizontal="center")
    else:
        ws.cell(row=r, column=9, value=f"=C{r}+({W_LIGHT}-1)*D{r}").number_format = MONEY
        ws.cell(row=r, column=10, value=f"=E{r}+({W_LIGHT}-1)*F{r}").number_format = MONEY
        ws.cell(row=r, column=11, value=f"=G{r}").number_format = MONEY
        ws.cell(row=r, column=12, value=f"=C{r}+({W_HEAVY}-1)*D{r}").number_format = MONEY
        ws.cell(row=r, column=13, value=f"=E{r}+({W_HEAVY}-1)*F{r}").number_format = MONEY
        ws.cell(row=r, column=14, value=f"=G{r}+({W_HEAVY}-{ANNENG_FREE_KG})*H{r}").number_format = MONEY
        for out_col, (a, b, c3) in ((15, ("I", "J", "K")), (16, ("L", "M", "N"))):
            ws.cell(
                row=r,
                column=out_col,
                value=f'=IF(AND({a}{r}<={b}{r},{a}{r}<={c3}{r}),"普通快递",IF({b}{r}<={c3}{r},"顺丰快递","安能物流"))',
            ).alignment = Alignment(horizontal="center")

    for col_i in range(1, NCOL + 1):
        cell = ws.cell(row=r, column=col_i)
        cell.border = thin_box
        if region == FALLBACK_LABEL:
            cell.fill = PatternFill("solid", fgColor=XL_WARN_BG)
            cell.font = Font(bold=True, color=XL_WARN_TEXT)
        elif group_of(col_i):
            cell.fill = PatternFill("solid", fgColor=GROUP_BG[group_of(col_i)])

ws.cell(
    row=last_row + 1,
    column=2,
    value="↑ 系统里没匹配到省份时用这一行的价格（App.tsx 兜底值），平时不应对客户使用。",
).font = Font(size=9, color=XL_WARN_TEXT)

ws.freeze_panes = "C4"
ws.auto_filter.ref = f"A{HEADER_ROW}:{get_column_letter(NCOL)}{last_row}"
for i, w in enumerate([6, 22, 15, 15, 15, 15, 15, 15, 12, 12, 12, 13, 13, 13, 13, 13], start=1):
    ws.column_dimensions[get_column_letter(i)].width = w
ws.row_dimensions[HEADER_ROW].height = 34

# ============================================================ Sheet 2 运费试算
ws2 = wb.create_sheet(SHEET_CALC)
ws2["A1"] = "运费试算（三家同时比价）"
ws2["A1"].font = Font(size=15, bold=True, color=XL_PRIMARY_DARK)
ws2["A2"] = "改蓝色区域的三个输入值，下方运费自动算出，口径与下单时系统算的完全一致。"
ws2["A2"].font = Font(size=9, color=XL_WARN_TEXT)

ROW_PROVINCE, ROW_WEIGHT, ROW_OVER = 4, 5, 6
INPUT_ROWS = [
    ("收货省份 / 地区", "浙江", "从下拉里选"),
    ("计费重量（kg）", 2.5, "普通/顺丰向上取整到整数 kg；安能只有 >15kg 部分才计续重"),
    ("是否超长（型材>1500mm）", "否", "是 / 否；仅普通与顺丰每件加 ¥20，安能不加"),
]
for r, (label, default, hint) in zip((ROW_PROVINCE, ROW_WEIGHT, ROW_OVER), INPUT_ROWS):
    ws2.cell(row=r, column=2, value=label).font = Font(bold=True)
    cell = ws2.cell(row=r, column=3, value=default)
    cell.fill = PatternFill("solid", fgColor=XL_INPUT)
    cell.alignment = Alignment(horizontal="center")
    cell.border = thin_box
    ws2.cell(row=r, column=4, value=hint).font = Font(size=9, color=XL_WARN_TEXT)
ws2.cell(row=ROW_WEIGHT, column=3).number_format = "0.0"

dv_province = DataValidation(type="list", formula1=f'="{",".join(LOOKUP_REGIONS)}"', allow_blank=True)
ws2.add_data_validation(dv_province)
dv_province.add(ws2.cell(row=ROW_PROVINCE, column=3))
dv_yesno = DataValidation(type="list", formula1='"是,否"', allow_blank=True)
ws2.add_data_validation(dv_yesno)
dv_yesno.add(ws2.cell(row=ROW_OVER, column=3))

RESULT_ROW = 8
for col, name in ((2, "项目"), (3, "金额 / 结论")):
    c = ws2.cell(row=RESULT_ROW, column=col, value=name)
    c.font = Font(bold=True, color=XL_HEADER_TEXT)
    c.fill = PatternFill("solid", fgColor=XL_PRIMARY)
    c.alignment = Alignment(horizontal="center")
    c.border = thin_box

PROV = f"$C${ROW_PROVINCE}"
WEIGHT = f"$C${ROW_WEIGHT}"
OVER = f"$C${ROW_OVER}"
RANGE_RATE = f"{WB}!$B:$H"
CEIL_W = f"MAX(1,CEILING({WEIGHT},1))"
HEAD_STD = f"VLOOKUP({PROV},{RANGE_RATE},2,FALSE)"
TAIL_STD = f"VLOOKUP({PROV},{RANGE_RATE},3,FALSE)"
HEAD_SF = f"VLOOKUP({PROV},{RANGE_RATE},4,FALSE)"
TAIL_SF = f"VLOOKUP({PROV},{RANGE_RATE},5,FALSE)"
HEAD_AN = f"VLOOKUP({PROV},{RANGE_RATE},6,FALSE)"
TAIL_AN = f"VLOOKUP({PROV},{RANGE_RATE},7,FALSE)"
OVER_FEE = f'IF({OVER}="是",20,0)'
STD_FEE = f"IFERROR({HEAD_STD}+({CEIL_W}-1)*{TAIL_STD},0)+{OVER_FEE}"
SF_FEE = f"IFERROR({HEAD_SF}+({CEIL_W}-1)*{TAIL_SF},0)+{OVER_FEE}"
AN_FEE = f"IFERROR(IF({WEIGHT}<={ANNENG_FREE_KG},{HEAD_AN},{HEAD_AN}+CEILING({WEIGHT}-{ANNENG_FREE_KG},1)*{TAIL_AN}),0)"
R_STD, R_SF, R_AN = f"C{RESULT_ROW+1}", f"C{RESULT_ROW+2}", f"C{RESULT_ROW+3}"

results = [
    ("普通快递运费", f'=IF({PROV}="","",{STD_FEE})', MONEY, None),
    ("顺丰快递运费", f'=IF({PROV}="","",{SF_FEE})', MONEY, None),
    ("安能物流运费", f'=IF({PROV}="","",{AN_FEE})', MONEY, XL_AN_BG),
    (
        "系统自动选哪家",
        f'=IF({PROV}="","",IF(AND({R_STD}<={R_SF},{R_STD}<={R_AN}),"普通快递",IF({R_SF}<={R_AN},"顺丰快递","安能物流")))',
        None,
        None,
    ),
    ("最低运费", f'=IF({PROV}="","",MIN({R_STD},{R_SF},{R_AN}))', MONEY, None),
    ("比最贵的一家省", f'=IF({PROV}="","",MAX({R_STD},{R_SF},{R_AN})-MIN({R_STD},{R_SF},{R_AN}))', MONEY, None),
    ("其中超长费（普通/顺丰才收）", f'=IF({PROV}="","",{OVER_FEE})', MONEY, None),
]
for i, (label, formula, fmt, bg) in enumerate(results, start=1):
    r = RESULT_ROW + i
    c = ws2.cell(row=r, column=2, value=label)
    c.font = Font(bold=True)
    c.border = thin_box
    cell = ws2.cell(row=r, column=3, value=formula)
    cell.fill = PatternFill("solid", fgColor=bg or XL_CALC)
    cell.border = thin_box
    cell.alignment = Alignment(horizontal="center")
    if fmt:
        cell.number_format = fmt

note_row = RESULT_ROW + len(results) + 2
ws2.cell(row=note_row, column=2, value="计费口径：").font = Font(bold=True, size=9, color=XL_WARN_TEXT)
ws2.cell(
    row=note_row,
    column=3,
    value=(
        f"普通/顺丰 = 首重 + (向上取整到整数kg − 1) × 续重 + 超长费；"
        f"安能 = ≤{ANNENG_FREE_KG}kg 收首重一口价，超过部分 = 首重 + 向上取整(重量−{ANNENG_FREE_KG}) × 续重，安能不收超长费。"
    ),
).font = Font(size=9, color=XL_WARN_TEXT)

ws2.column_dimensions["A"].width = 3
ws2.column_dimensions["B"].width = 24
ws2.column_dimensions["C"].width = 20
ws2.column_dimensions["D"].width = 52

# ============================================================ Sheet 3 计费说明
ws3 = wb.create_sheet(SHEET_NOTE)
ws3["A1"] = "计费说明与数据来源"
ws3["A1"].font = Font(size=15, bold=True, color=XL_PRIMARY_DARK)

_an = dict((k, (a, b)) for k, a, b in AN)
_std = dict((k, (a, b)) for k, a, b in STD)
_sf = dict((k, (a, b)) for k, a, b in SF)


def demo(prov):
    (s0, s1), (f0, f1), (a0, a1) = _std[prov], _sf[prov], _an[prov]
    return (
        f"{prov}为例：{W_HEAVY}kg 时普通 ¥{s0 + (W_HEAVY - 1) * s1:.0f}、顺丰 ¥{f0 + (W_HEAVY - 1) * f1:.0f}、"
        f"安能只要 ¥{a0 + (W_HEAVY - ANNENG_FREE_KG) * a1:.0f}（含 {ANNENG_FREE_KG}kg 内一口价 ¥{a0:.0f}）；"
        f"反过来 3kg 时普通 ¥{s0 + 2 * s1:.0f}、安能仍是 ¥{a0:.0f}，所以小件几乎不会走安能。"
    )


notes = [
    ("数据来源", "constants.ts → SHIPPING_RATES（普通快递）、SHIPPING_RATES_SF（顺丰）、SHIPPING_RATES_AN（安能）；各 31 个省份/地区，本表与其逐字一致。"),
    ("普通 / 顺丰", "运费 = 首重价 + (向上取整到整数的计费重量 − 1) × 续重价 + 超长费。重量不足 1kg 按 1kg 计（例如 2.5kg 按 3kg 算）。"),
    ("安能物流", f"≤{ANNENG_FREE_KG}kg 一律收「首重」这一口价；>{ANNENG_FREE_KG}kg 时 = 首重 + 向上取整(重量−{ANNENG_FREE_KG}) × 续重。安能不收超长费，所以长型材、重货走安能往往更划算。"),
    ("超长费", "型材长度 > 1500mm 时，普通快递与顺丰每件加收 ¥20；安能不加。到付（sf_collect）系统运费为 0，由收货方自付。"),
    ("代码实现", "App.tsx 的 calcShippingForMethod（standard / sf / anneng / sf_collect）；cheapest 判定为「普通 ≤ 顺丰 且 普通 ≤ 安能 → 普通，否则顺丰 ≤ 安能 → 顺丰，否则安能」，本表同一口径。"),
    ("下单时实际收多少", "购物车会在三者里自动取最低价给客户；客户选「到付」时系统运费为 0，收货时自付。"),
    ("典型拐点", demo("浙江")),
    ("港澳台与境外", "不在本表 31 个地区内。走转运仓发货：运费按转运仓所在省份计算，内地到转运仓段由我方承担，转运仓到境外段由客户承担。"),
    ("✅ 已修正（2026-10-29）", f"安能山西原录 ¥110，店主确认应为 ¥38（与福建、广东同为 38 档），已改 constants.ts；江苏顺丰由 ¥19/¥7 改为 ¥18/¥6（同上海、浙江）；本表已是修正后的价格。"),
    ("⚠ 仍需核对 1", f"山西顺丰 ¥{_sf['山西'][0]:.0f}/¥{_sf['山西'][1]:.0f}，同片陕西 ¥{_sf['陕西'][0]:.0f}/¥{_sf['陕西'][1]:.0f}，偏高 1 元，至今未确认是否笔误。"),
    ("✅ 兜底价已修正（2026-10-29）", f"省份在表里查不到时，系统兜底用「普通 ¥{FALLBACK['standard'][0]:.0f}/¥{FALLBACK['standard'][1]:.0f}、顺丰 ¥{FALLBACK['sf'][0]:.0f}/¥{FALLBACK['sf'][1]:.0f}、安能 ¥{FALLBACK['anneng'][0]:.0f}/¥{FALLBACK['anneng'][1]:.0f}」——顺丰兜底首重原为 ¥15、普通兜底首重原为 ¥18（均按店主 10-29 确认调整），现在不会再因未匹配省份而明显多收/少收运费。"),
]
row = 3
for label, text in notes:
    ws3.cell(row=row, column=1, value=label).font = Font(bold=True, color=XL_PRIMARY_DARK)
    ws3.cell(row=row, column=1).alignment = Alignment(vertical="top")
    c = ws3.cell(row=row, column=2, value=text)
    c.alignment = Alignment(wrap_text=True, vertical="top")
    c.fill = PatternFill("solid", fgColor=XL_NOTE)
    ws3.row_dimensions[row].height = 34
    row += 1

ws3.column_dimensions["A"].width = 18
ws3.column_dimensions["B"].width = 92

wb.save(OUTPUT_XLSX)
print("saved:", OUTPUT_XLSX, "| sheets:", wb.sheetnames, "| STATIC:", STATIC)
