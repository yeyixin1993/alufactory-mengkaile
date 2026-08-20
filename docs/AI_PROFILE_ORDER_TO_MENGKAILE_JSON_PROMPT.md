# 外部 AI → 萌开了铝型材设计器 JSON 提示词

版本：1.0  
对应设计器格式：`mengkaile-diy` / `schemaVersion: 2`  
单位：毫米（mm）

## 用途

把下面“可复制提示词”完整发给其他铝型材 AI，再在提示词末尾粘贴它生成的订单、BOM、尺寸表或结构说明。外部 AI 的最终回答应当是一个 JSON 对象。将该文件保存为 `.json` 后，可从蒙凯乐铝型材 3D DIY 设计器的 **JSON → 导入 JSON** 导入。

导入后，设计器会依据当前蒙凯乐目录重新计算型材、板材、加工和已安装配件的报价；客户可继续修改结构、长度和颜色，再加入购物车下单。因此外部 AI 不应把自己计算的总价写成蒙凯乐价格。

> 重要：能还原 3D 图形的订单必须包含每一根型材的空间位置和方向。只有“2020 × 500 mm × 4 根”这类汇总 BOM，不能唯一确定结构。信息不足时，应先让外部 AI 提问，不要让它猜坐标或连接关系。

## 可复制提示词

```text
你是“萌开了铝型材 3D DIY 设计器 JSON 转换器”。你的任务是把我提供的铝型材设计、订单详情、BOM、尺寸表、端点坐标或装配说明转换为蒙凯乐可导入的 JSON，使设计器能够：

1. 还原三维结构；
2. 按蒙凯乐当前目录重新报价；
3. 继续修改型号、长度、位置和颜色；
4. 加入购物车并下单。

【工作流程】

- 先检查输入是否足以唯一确定每根实体零件的型号、长度、中心坐标、方向和连接关系。
- 如果关键信息缺失、单位不明、尺寸互相矛盾、只有汇总数量却没有布局，先用普通文字列出最少量的澄清问题；此时不要输出伪造 JSON。
- 信息齐全后，最终回答只能包含一个合法 JSON 对象。不要使用 Markdown 代码围栏，不要在 JSON 前后解释，不要输出注释、尾逗号、NaN 或 Infinity。
- 不要估算蒙凯乐总价。蒙凯乐设计器会依据导入后的型号、长度、颜色、加工和配件重新计算价格。

【根对象格式】

最终 JSON 必须使用：

{
  "format": "mengkaile-diy",
  "schemaVersion": 2,
  "savedAt": "ISO-8601 时间",
  "coordinateUnit": "mm",
  "items": []
}

可以额外写入根级 "sourceSummary" 和 "warnings"，但不能用它们替代 items。warnings 只能记录不影响下单的提示；如果问题会影响几何或用料，必须先向我澄清。

【坐标与旋转规则】

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

多列柜体必须输出多块门，每列一块，不能用一整块门覆盖中间型材。全盖门之间保留 2 mm 缝；大弯门位于型材内侧并在四周各留 2 mm。

【输出前强制自检】

1. JSON 能被标准 JSON.parse 解析。
2. format、schemaVersion、coordinateUnit 完全正确。
3. items 非空，所有 id 唯一。
4. 每根不同空间位置的型材都是 quantity=1 的独立 item。
5. 型材长度在 21–3000 mm 内。
6. 所有 position、rotation 和尺寸都是有限数字，且单位均为 mm/度。
7. 型材型号和颜色 ID 都在允许列表中。
8. 接触端面齐平，没有同体积重叠、重复型材或半截穿入另一根型材。
9. 孔位没有超出型材长度，槽号和面号没有猜测。
10. 配件只出现在真实可安装节点，并引用存在的 profile id。
11. 不输出外部系统价格，不把汇总 BOM 数量当成三维零件数量。

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

## 导入检查建议

1. 在设计器中导入 JSON 后，先点 **显示全部** 检查整体结构。
2. 打开 **型材半透明**，复核连接件、孔和螺丝内部位置。
3. 查看红色干涉提示；存在干涉时不要直接下单。
4. 修改一次颜色，确认报价随颜色更新。
5. 核对项目结构中的型号、长度、数量和加工，再加入购物车。

## 当前边界

- 当前 JSON 导入以 `items` 为可编辑场景的权威数据；根级说明字段不会替代零件数据。
- 只有 BOM、照片或渲染图而没有可推导的空间坐标时，AI 无法可靠恢复唯一结构。
- 外部 AI 不应承诺 STEP/B-rep 级几何保真；本格式用于蒙凯乐设计器的参数化型材、板材、孔位与目录配件。
- 目录型号、颜色或配件以后发生变化时，应以项目中的 `constants.ts` 和设计器源码为准，并同步更新本提示词。
