# SketchUp → 萌开了设计器 JSON

版本：1.0  
目标格式：`mengkaile-diy` / `schemaVersion: 2`  
SketchUp 内部单位：任意；导出统一转换为毫米

## 目标

SketchUp 用户可以使用萌开了型材组件搭建装配，随后在 SketchUp 内导出原生设计器 JSON。该 JSON 导入 `#/diy-designer` 后，每根型材仍是独立可编辑实体，设计器会按当前目录重新计算报价；客户可检查结构、换颜色、加入购物车、付款并生成生产 PDF。

网页不直接解析 `.skp`。SketchUp 的二进制模型必须由 SketchUp 自己通过 Ruby API 展开组件定义、嵌套实例和变换矩阵，避免浏览器根据包围盒或截图猜型号、长度和朝向。

## 安装导出器

源文件位于：

- `tools/sketchup/mengkaile_json_exporter.rb`
- `tools/sketchup/mengkaile_json_exporter/main.rb`

开发安装：把上面的 `.rb` 文件和同名目录一起复制到 SketchUp 的 `Plugins` 目录，重启 SketchUp。在菜单 **扩展程序 → 萌开了** 中会出现：

- **检查当前模型…**
- **标记选中对象为萌开了型材…**
- **导出设计器 JSON…**

仓库中的 `tools/sketchup/mengkaile-json-exporter.rbz` 是相同文件的安装包，可从 SketchUp **扩展程序管理器 → 安装扩展程序** 安装。

## 当前 20 系列文件

已核对样本 `20系列.skp`（SketchUp 26.0.429）。其中型材实例带有：

- attribute dictionary：`LonaAluminumProfileSplitter`
- key：`profile`
- 已发现的值：`2020`、`2040`、`2047`

导出器直接读取这个属性，不依赖模型颜色或屏幕外观识别。`APS_2040`、`APS_2047` 等严格组件/材质命名可作为旧文件的后备识别方式。

## SU 建模要求

1. 每根真实型材必须是独立的 ComponentInstance 或 Group；不能把多根型材炸开并合成一个原始网格。
2. 相同组件可以重复实例化；导出时每个物理实例会得到一个独立、稳定的 `profile-su-<persistent_id>`，`quantity` 固定为 `1`。
3. 可以嵌套组件。导出器会递归组合父子变换，只导出识别到的最内层物理型材，装配容器本身不会变成一根型材。
4. 可以沿长度轴缩放型材，但不得缩放 15/20/30/40mm 截面。导出器按 SKU 核对实际截面，误缩放会产生警告。
5. 自动长度轴取组件定义包围盒经实例变换后的最长轴。如定义特殊或型材很短，可通过菜单把 `length_axis` 明确写成 `X`、`Y` 或 `Z`。
6. SketchUp 的 X/Y/Z 会转换为设计器的 X宽/Y高/Z深，并保持右手坐标：
   - 设计器 X = SketchUp X
   - 设计器 Y = SketchUp Z
   - 设计器 Z = -SketchUp Y
7. 导出器保留完整正交基，而不只保留型材中心线；因此 2047 的封边面、单面/双面封槽型材的朝向可以随组件自转进入设计器。
8. 全部实体按真实包围盒平移到设计器原点附近，只改变整体原点，不改变型材之间的相对位置、端面接触或间距。
9. 单根型材允许长度为 21–3000mm。超限对象仍会导出供检查，但会显示强制复核警告，不能把警告当成可生产确认。

## 型材属性合同

推荐在实例上使用 `Mengkaile` attribute dictionary。现有 Lona 属性仍兼容。

| Key | 示例 | 说明 |
| --- | --- | --- |
| `variant_id` | `2047` | 萌开了精确 SKU；也读取现有 `LonaAluminumProfileSplitter/profile` |
| `color_id` | `natural` | 设计器稳定颜色 ID；缺省为银白 |
| `finish` | `oxidized` | `oxidized` / `electrophoretic` / `powder` |
| `length_axis` | `Y` | 可选；`X` / `Y` / `Z`，缺省自动识别 |
| `remark` | `左侧立柱` | 客户/生产备注 |
| `tapping_left` | `true` | 型材局部 -X 端面攻丝 |
| `tapping_right` | `true` | 型材局部 +X 端面攻丝 |
| `holes_json` | 见下 | 明确加工孔数组，必须是合法 JSON 字符串 |

`holes_json` 示例：

```json
[
  {
    "side": "A",
    "type": "countersunk",
    "positionMm": 120,
    "physicalGrooveIndex": 0,
    "threadSize": "M6"
  }
]
```

孔位只在属性明确存在时导出。导出器不会根据两根型材看似接触就猜通孔、沉头孔、端面攻丝或连接件，因为这会把视觉推断错误带进生产单。

## 型号识别顺序

1. 实例/定义上的 `Mengkaile.variant_id`；
2. 实例/定义上的 `LonaAluminumProfileSplitter.profile`；
3. 严格的 `APS_<SKU>` 或独立 SKU 组件/图层/材质名；
4. 未识别对象不导出，可先选择对象并使用 **标记选中对象为萌开了型材…**。

不会把仅仅含有“2020”字样的孔、螺丝或连接件误识别成型材。

## 输出和下单边界

- 输出根对象固定为 `format: "mengkaile-diy"`、`schemaVersion: 2`、`coordinateUnit: "mm"`。
- 不输出 SU 中的价格。设计器依据当前型材、颜色、长度、加工和会员规则重新报价。
- 当前 1.0 导出器只导出已识别型材及明确写入型材属性的孔/攻丝。板材、门和连接配件以后必须通过各自明确的 SKU/安装关系属性扩展，不能从形状猜测。
- JSON 根级 `warnings` 不代表生产许可。导入后必须确认型号、颜色、加工、连接方式和干涉提示，再进入购物车。

## 命令行预检

仓库提供与导入合同一致的静态预检：

```bash
npm run validate:diy-json -- /absolute/path/to/export.json
```

预检会检查格式版本、唯一 ID、型号、颜色、有限坐标、长度范围、孔位范围和被引用型材。预检通过只说明数据合同完整；3D 设计器中的结构、接触、干涉和加工确认仍是下单前的最终检查。

