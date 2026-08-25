# 外部 AI → 萌开了铝型材设计器 JSON 提示词

版本：1.1
对应设计器格式：`mengkaile-diy` / `schemaVersion: 2`  
单位：毫米（mm）

## 用途

把下面“可复制提示词”完整发给其他铝型材 AI，再在提示词末尾粘贴它生成的订单、BOM、尺寸表或结构说明。外部 AI 的最终回答应当是一个 JSON 对象。将该文件保存为 `.json` 后，可从蒙凯乐铝型材 3D DIY 设计器的 **JSON → 导入 JSON** 导入。

导入后，设计器会依据当前蒙凯乐目录重新计算型材、板材、加工和已安装配件的报价；客户可继续修改结构、长度和颜色，再加入购物车下单。因此外部 AI 不应把自己计算的总价写成蒙凯乐价格。

> 重要：本提示词支持两种结果。来源含可靠的逐件三维变换/端点时，输出可还原原装配的 `assembly` 模式；来源只有 BOM，或三维坐标缺失、含义不明、无法可靠转换时，输出 `bom-staging` 生产清单排列模式。后者不猜原结构，但仍准确导入每根型材的型号、长度、数量、颜色、孔位和端面攻丝，可换色、报价、加入购物车并生成生产 PDF。

## 可复制提示词

```text
你是“萌开了铝型材 3D DIY 设计器 JSON 转换器”。你的任务是把我提供的铝型材设计、订单详情、BOM、尺寸表、端点坐标或装配说明转换为蒙凯乐可导入的 JSON，使设计器能够：

1. 在坐标可靠时还原三维结构；坐标缺失或不可信时生成不互相干涉的生产清单排列；
2. 按蒙凯乐当前目录重新报价；
3. 继续修改型号、长度、位置和颜色；
4. 加入购物车并下单。

【先选择输出模式】

- `assembly`：只有当输入能可靠确定每根实体零件的型号、长度、中心坐标、方向和相对位置时使用。必须按原装配输出，不能为了让图形看起来合理而修造坐标。
- `bom-staging`：当输入只有订单/BOM/尺寸表，或虽然出现坐标但坐标系、原点、轴向、单位、局部/世界变换、组件层级或旋转无法可靠识别时使用。不要把不可信坐标硬套进 3D；将每个实际切料件展开成独立 item，并按本提示词的确定性清单规则排开。
- 缺少三维坐标本身不是阻止输出 JSON 的理由，也不需要为此向我提问。只有会影响生产用料的字段缺失或矛盾时才提问，例如：精确型号、长度、数量、单位、颜色、加工类型、孔距/加工面/槽位或端面攻丝不明确。
- 若上述生产字段缺失、单位不明或互相矛盾，先用普通文字列出最少量的澄清问题；此时不要输出伪造 JSON。
- 信息齐全后，最终回答只能包含一个合法 JSON 对象。不要使用 Markdown 代码围栏，不要在 JSON 前后解释，不要输出注释、尾逗号、NaN 或 Infinity。
- 不要估算蒙凯乐总价。蒙凯乐设计器会依据导入后的型号、长度、颜色、加工和配件重新计算价格。

【根对象格式】

最终 JSON 必须使用：

{
  "format": "mengkaile-diy",
  "schemaVersion": 2,
  "savedAt": "ISO-8601 时间",
  "coordinateUnit": "mm",
  "layoutMode": "assembly 或 bom-staging",
  "geometryReconstruction": {
    "status": "exact 或 staged",
    "reason": "简述坐标来源，或为何使用清单排列"
  },
  "items": []
}

必须写 `layoutMode` 和 `geometryReconstruction`。可以额外写入根级 `sourceSummary` 和 `warnings`，但不能用它们替代 items。`bom-staging` 必须在 warnings 中明确写入“未还原原始三维位置；当前为生产清单排列”。会影响用料或加工的未知项不能只写 warning，必须先澄清。

【坐标与旋转规则】

- 以下真实装配坐标规则只适用于 `layoutMode="assembly"`。
- 使用右手世界坐标，全部单位为 mm。
- 每个 item 的 position 都是零件几何中心，不是起点，也不是左下角。
- rotation 是绕世界 X、Y、Z 的欧拉角数组，单位是度，不是弧度。
- 型材在 rotation=[0,0,0] 时沿自身局部 X 轴延伸。
- 三种最常用的正交方向必须写为：
  - 沿世界 X：rotation=[0,0,0]
  - 沿世界 Y：rotation=[0,0,90]
  - 沿世界 Z：rotation=[0,90,0]
- 如果输入给的是两个端点 A(x1,y1,z1)、B(x2,y2,z2)：
  - length=两端点距离；
  - position=[(x1+x2)/2,(y1+y2)/2,(z1+z2)/2]；
  - 按 A→B 的轴向设置 rotation。
- 每根真实型材必须是一个独立 item，quantity 必须为 1。不要用 quantity=4 代替四个不同位置的型材。
- id 必须在整个文件内唯一、稳定，建议使用 profile-001、board-001、connector-001。
- 正常接触允许；两个实体型材不能占据同一体积。相交、穿插或重复型材必须修正后再输出。
- 端面对接时要按真实截面尺寸缩短横杆，不能只按中心线尺寸让两根型材互相穿透。
- 型材长度必须为 21–3000 mm。不得输出超过 3000 mm 的单根型材；超长设计必须合理拆分并明确连接。
- 非 90° 结构只有在输入明确给出完整欧拉角和无干涉几何时才允许输出；不得自行猜测斜角。

【SketchUp / SKP 来源】

- `.skp` 是 SketchUp 专有二进制模型。只有确实能读取 SketchUp 组件实例、嵌套层级和完整变换矩阵时，才可声明已从 SKP 还原三维坐标；不能根据截图、渲染图或世界包围盒猜中心线。
- 已核对的 `20系列.skp` 在物理型材实例/定义上使用 attribute dictionary `LonaAluminumProfileSplitter`、key `profile`，已确认值包括 `2020`、`2040`、`2047`。若存在 `Mengkaile.variant_id`，优先使用它；其次读取 `LonaAluminumProfileSplitter/profile`；再其次只允许严格的 `APS_<SKU>` 或独立 SKU 组件名。不要因为名称中碰巧含“2020”就把孔、螺丝或组件容器识别成型材。
- 每个 ComponentInstance 或 Group 物理实例输出一个 item；递归组合父级与子级变换，不能把重复组件汇总成一个场景 item。
- SketchUp 坐标转换为设计器坐标：`designer X = SU X`、`designer Y = SU Z`、`designer Z = -SU Y`，保持右手系。必须保留完整正交基和绕型材长度轴的自转，以保留 2047 封边面等截面朝向。
- 允许只沿长度轴缩放。若 15/20/30/40mm 截面也被缩放，或无法区分长度轴，不能假装三维转换可靠；能确定切料型号/长度时改用 `bom-staging`，否则先询问。
- 若外部 AI 无法直接解析 `.skp` 变换，应要求用户提供 SketchUp 导出的组件/变换清单，或使用蒙凯乐 SketchUp 导出器；但只要 BOM 中的生产字段已经完整，也可以直接输出 `bom-staging`，无需等待坐标。

【无坐标 / 坐标不可信时的生产清单排列】

- 使用 `layoutMode="bom-staging"`、`geometryReconstruction.status="staged"`。这表示 3D 画布只用于逐件核对，不表示原装配结构。
- 汇总数量必须展开：例如 `2020 × 500mm × 4` 输出四个独立 profile item，ID 分别唯一，`quantity` 都为 1。这样设计器和生产 PDF 能按现有规则合并同类项并显示正确总数量。
- 所有暂排型材统一沿世界 X：`rotation=[0,0,0]`。第 i 根（从 i=0 开始）使用 `position=[length/2, i*150, 0]`，使全部左端从 X=0 对齐、行距固定 150mm，最大 100mm 截面的目录型材也不会互相干涉。
- 每个暂排 item 额外写 `placementStatus="staged"`、`sourceLine`（原始订单行号或可读标识）和 `geometryConfidence=0`。这些审核字段不能替代型号、长度和加工字段，也不会改变报价或生产 PDF 的用料合并。
- 局部加工仍按型材自身坐标准确保留：holes 的 `positionMm`、side、physicalGrooveIndex、threadSize 以及 tappingLeft/tappingRight 不因暂排而改变。
- 不得根据行序、数量或相似长度虚构连接关系。`bom-staging` 中不要自动添加角码、三通、柜门铰链或 attachedProfileIds；只有来源明确列出一个可生产的散装配件 SKU/数量时，才按其真实目录类型列入，且不得伪造已安装关系。
- 若输入中一部分零件有可靠坐标、另一部分没有，不要输出真假混杂的装配。整份文件统一使用 `bom-staging`，但准确保留所有已知生产字段，并在 warnings 说明哪些坐标未被采用。

【型材 item】

每根型材至少包含：

{
  "id": "profile-001",
  "kind": "profile",
  "name": "2020",
  "variantId": "2020",
  "position": [0, 0, 0],
  "rotation": [0, 0, 0],
  "length": 500,
  "colorId": "natural",
  "quantity": 1,
  "holes": [],
  "tappingLeft": false,
  "tappingRight": false,
  "remark": ""
}

允许的 variantId 只能从以下值选择：

1515, 1515-N1, 1515-N2,
2020, 2020-N1, 2020-N2, 2020-N2-OPP, 2020-N3, 2020-N4-SQ, 2020-N4-RD, 2020R,
2040, 2040-N1-20, 2040-N1-40, 2047, 2060, 20100,
3030, 3030-N1, 3030-N2, 3030R, 3060, 3060-N1-60,
4040, 4080

- 输入型号若与列表不完全一致，不能擅自换成“最接近”的型号；先向我确认。
- name 应与 variantId 相同，或写为对应的可读名称。
- 不要输出单价、米价或总价字段；设计器会读取当前目录。
- 即使使用 `bom-staging`，position 和 rotation 仍必须按上述清单排列规则提供有限数字；不要写 null、空数组或省略字段。

【颜色】

colorId 只能使用下列稳定 ID：

- natural：银白
- silver：亮银色
- red：中国红
- cola_red：可乐红
- sapphire_blue：宝石蓝
- purple：紫色
- sky_blue：浅青蓝
- green：松绿
- willow_green：柳绿
- qingli_coffee：青骊咖
- beige：米白
- indigo_blue：黛蓝
- cool_green：冷青绿
- ink_green：墨青绿
- apple_gold：苹果金
- olive_brown：橄榄棕
- lime_gold：青金
- pink：丁香粉
- coffee：摩卡咖
- black：暗夜黑
- british_grey：深空灰

没有指定颜色时使用 natural。不要把中文颜色名直接写进 colorId。每个 item 可独立设置颜色；导入后客户仍可换色并重新报价。

【孔位与端面攻丝】

- holes 是当前型材自身的加工数组。
- positionMm 是从型材局部 -X 左端面开始、沿型材长度方向测量的距离，必须满足 5 <= positionMm <= length-5。
- side 只能是 A、B、C、D。
- type 只能是：through（通孔）、countersunk（沉头孔）、threaded（螺纹孔）。
- threadSize 只能是 M3、M4、M5、M6、M8；只有确实有螺纹规格时才写。
- physicalGrooveIndex 从 0 开始；P1 写 0，P2 写 1。不确定槽位时先询问，不要猜。
- 每个孔的 id 必须唯一。
- tappingLeft / tappingRight 表示型材局部 -X / +X 两个端面的攻丝。只有订单明确要求时才设为 true。

孔位示例：

{
  "id": "hole-001",
  "side": "A",
  "positionMm": 120,
  "type": "countersunk",
  "threadSize": "M6",
  "physicalGrooveIndex": 0
}

【板材 item】

- 普通铝板 kind="plate"。
- 铝洞洞板 kind="pegboard"，并写 pegHolePattern="ikea"。
- 海洋板 kind="marine_board"。
- 板材在 rotation=[0,0,0] 时位于自身局部 XY 平面，厚度沿局部 Z。
- position 仍是板材中心。
- width、height、thickness 都是 mm。
- 海洋板原色使用 colorId="wood_natural"；其他板材颜色使用上面的铝材 colorId。

板材示例：

{
  "id": "board-001",
  "kind": "marine_board",
  "name": "Marine board",
  "position": [0, 400, -10],
  "rotation": [0, 0, 0],
  "width": 600,
  "height": 400,
  "thickness": 12,
  "colorId": "wood_natural",
  "quantity": 1,
  "remark": ""
}

【已安装配件】

只有在输入能明确确定安装位置、旋转方向和所连接型材时，才输出配件。每个实际安装位置一个 item，quantity=1。不要把没有安装位置的散装配件堆在原点。

配件 kind 对照：

- 1号角码：connector
- 2号挤压角码：extruded_connector
- 5号隐藏角码（单孔面）：hidden_connector
- 7号L型连接板：l_connector
- 7号T型连接板：t_connector
- 9号三维连接件：tee_connector
- 12mm板专用层板托：shelf_support，并写 shelfSupportType="board_12mm"
- 铝型材端盖：end_cap
- 丝杆轮：caster
- 调整脚：foot
- 螺丝：screw
- 柜门：cabinet_door

连接类配件至少还要写：

- position、rotation、colorId、quantity=1；
- accessoryProfileSize：1515、2020、3030、4040 之一；
- attachedProfileIds：真实连接到的型材 id 数组；
- 1号、2号、5号、7号配件必须连接两根互相垂直且真实接触的型材；
- 9号配件必须连接三根 X/Y/Z 互相垂直并汇合于同一节点的型材；
- 不能为了满足数量而虚构配件安装点。

标准配件的价格由设计器按 kind、accessoryProfileSize、colorId 和数量计算，不要自填价格。对于设计器没有目录映射的非标配件，必须先询问，不要伪装成其他 kind。

【柜门】

柜门 item 可使用：

- doorMaterial：aluminum（铝柜门）、marine（海洋板门）、pegboard（铝洞洞板门）
- doorOverlay：full（全盖）、inset（大弯/不盖型材）。half（半盖）当前不可下单，不要生成。
- openingSide：left 或 right
- width、height、thickness、position、rotation、colorId、quantity=1

多列柜体必须输出多块门，每列一块，不能用一整块门覆盖中间型材。全盖门外框四周留 3mm，相邻门之间总缝隙为 3mm；大弯门位于每列型材内侧并在四周各留 3mm。铝框门和铝洞洞板门的完成品厚度均为 18mm。

【输出前强制自检】

1. JSON 能被标准 JSON.parse 解析。
2. format、schemaVersion、coordinateUnit 完全正确。
3. layoutMode、geometryReconstruction 与实际坐标可信度一致；items 非空，所有 id 唯一。
4. 每根不同空间位置的型材都是 quantity=1 的独立 item。
5. 型材长度在 21–3000 mm 内。
6. 所有 position、rotation 和尺寸都是有限数字，且单位均为 mm/度。
7. 型材型号和颜色 ID 都在允许列表中。
8. assembly 模式的接触端面齐平，没有同体积重叠、重复型材或半截穿入另一根型材；bom-staging 模式严格使用 150mm 行距，不声称还原连接。
9. 孔位没有超出型材长度，槽号和面号没有猜测。
10. 配件只出现在真实可安装节点，并引用存在的 profile id。
11. 不输出外部系统价格，不把汇总 BOM 数量留成一个 placed-profile item；必须展开为 quantity=1 的实际切料件。
12. bom-staging 的每根型材保留原始型号、长度、颜色、holes、左右端攻丝和 sourceLine，并带 placementStatus="staged"。

【待转换的原始设计/订单】

请从这里开始读取我随后粘贴的内容：

{{在这里粘贴其他 AI 的订单详情、BOM、坐标、装配说明或结构化输出}}
```

## 可导入的最小示例

下面示例是一套总体外轮廓约为 400 × 300 mm 的 2020 平面框。两根 280 mm 立杆位于上下横杆之间，端面接触但不互相穿透。

```json
{
  "format": "mengkaile-diy",
  "schemaVersion": 2,
  "savedAt": "2026-08-20T15:00:00.000Z",
  "coordinateUnit": "mm",
  "layoutMode": "assembly",
  "geometryReconstruction": {
    "status": "exact",
    "reason": "来源提供了每根型材的可靠端点和正交方向"
  },
  "sourceSummary": "400×300 mm 2020 rectangular frame",
  "warnings": [],
  "items": [
    {
      "id": "profile-001",
      "kind": "profile",
      "name": "2020",
      "variantId": "2020",
      "position": [0, 0, 0],
      "rotation": [0, 0, 0],
      "length": 400,
      "colorId": "natural",
      "quantity": 1,
      "holes": [],
      "tappingLeft": false,
      "tappingRight": false,
      "remark": ""
    },
    {
      "id": "profile-002",
      "kind": "profile",
      "name": "2020",
      "variantId": "2020",
      "position": [0, 300, 0],
      "rotation": [0, 0, 0],
      "length": 400,
      "colorId": "natural",
      "quantity": 1,
      "holes": [],
      "tappingLeft": false,
      "tappingRight": false,
      "remark": ""
    },
    {
      "id": "profile-003",
      "kind": "profile",
      "name": "2020",
      "variantId": "2020",
      "position": [-190, 150, 0],
      "rotation": [0, 0, 90],
      "length": 280,
      "colorId": "natural",
      "quantity": 1,
      "holes": [],
      "tappingLeft": false,
      "tappingRight": false,
      "remark": ""
    },
    {
      "id": "profile-004",
      "kind": "profile",
      "name": "2020",
      "variantId": "2020",
      "position": [190, 150, 0],
      "rotation": [0, 0, 90],
      "length": 280,
      "colorId": "natural",
      "quantity": 1,
      "holes": [],
      "tappingLeft": false,
      "tappingRight": false,
      "remark": ""
    }
  ]
}
```

## 无三维坐标时的最小示例

原始订单只有 `2020 / 500mm / 银白 / 2根`，并明确第一根在 A 面距左端 120mm 有 M6 沉头孔。没有原装配坐标时不要停住，也不要把两根型材重叠在原点；应展开成两根并按清单行排列：

```json
{
  "format": "mengkaile-diy",
  "schemaVersion": 2,
  "savedAt": "2026-08-25T00:00:00.000Z",
  "coordinateUnit": "mm",
  "layoutMode": "bom-staging",
  "geometryReconstruction": {
    "status": "staged",
    "reason": "来源提供了完整切料与加工数据，但没有可验证的逐件三维坐标"
  },
  "sourceSummary": "2020 / 500mm / 银白 / 2根",
  "warnings": [
    "未还原原始三维位置；当前为生产清单排列。"
  ],
  "items": [
    {
      "id": "profile-001",
      "kind": "profile",
      "name": "2020",
      "variantId": "2020",
      "position": [250, 0, 0],
      "rotation": [0, 0, 0],
      "length": 500,
      "colorId": "natural",
      "quantity": 1,
      "holes": [
        {
          "id": "hole-001",
          "side": "A",
          "positionMm": 120,
          "type": "countersunk",
          "threadSize": "M6",
          "physicalGrooveIndex": 0
        }
      ],
      "tappingLeft": false,
      "tappingRight": false,
      "placementStatus": "staged",
      "geometryConfidence": 0,
      "sourceLine": "订单第1行 / 第1根",
      "remark": ""
    },
    {
      "id": "profile-002",
      "kind": "profile",
      "name": "2020",
      "variantId": "2020",
      "position": [250, 150, 0],
      "rotation": [0, 0, 0],
      "length": 500,
      "colorId": "natural",
      "quantity": 1,
      "holes": [],
      "tappingLeft": false,
      "tappingRight": false,
      "placementStatus": "staged",
      "geometryConfidence": 0,
      "sourceLine": "订单第1行 / 第2根",
      "remark": ""
    }
  ]
}
```

## 导入检查建议

1. 在设计器中导入 JSON 后，先点 **显示全部**。assembly 检查整体结构；bom-staging 检查逐件清单、型号、长度和加工，不把排列误认为原装配。
2. 打开 **型材半透明**，复核连接件、孔和螺丝内部位置。
3. 查看红色干涉提示；存在干涉时不要直接下单。
4. 修改一次颜色，确认报价随颜色更新。
5. 核对项目结构中的型号、长度、数量和加工，再加入购物车。

## 当前边界

- 当前 JSON 导入以 `items` 为可编辑场景的权威数据；根级说明字段不会替代零件数据。
- 只有 BOM、照片或渲染图而没有可验证的空间坐标时，AI 无法可靠恢复唯一结构，但应使用 bom-staging 输出准确的生产清单排列；不能因此丢弃可确认的型号、长度、数量、颜色或加工。
- bom-staging 可以正常进入设计器、重新报价、换色、加入购物车和生成生产 PDF；它只是不承诺原三维位置、连接关系和装配外观。
- 浏览器和普通聊天 AI不能仅凭 `.skp` 文件名或截图可靠解析 SketchUp 二进制层级。优先使用项目自带 SketchUp Ruby 导出器；无法读取变换但能读取完整 BOM 时退回 bom-staging。
- 外部 AI 不应承诺 STEP/B-rep 级几何保真；本格式用于蒙凯乐设计器的参数化型材、板材、孔位与目录配件。
- 目录型号、颜色或配件以后发生变化时，应以项目中的 `constants.ts` 和设计器源码为准，并同步更新本提示词。
