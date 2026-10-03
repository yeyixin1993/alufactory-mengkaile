# 凳子来源的三个独立配件

三个固定尺寸配件直接取自本轮只读核验的`凳子.skp`，源SHA-256为`c8dcb2a4f1c9f452b87225a1e98c34323cb75a6b14bd92db7e97f52b27ab0166`。完整凳子模板与独立零件使用同一份几何，不因建立目录而变成采购SKU或取得制造放行。

| 目录id | 几何依据 | 材质与用途 |
| --- | --- | --- |
| decorative_8080_30 | 原节点root/groups-31；局部XYZ包络30×80×80mm | 8080装饰短料，截面80×80、切长30；不可视为框架结构型材，铝合金牌号/工艺待核 |
| stainless_handle_126 | 原节点root/instances-41；包络126×52×43mm；CAD孔距112mm、孔Ø5.4mm | 用户确认不锈钢类别；源文件名中的304不构成牌号证明；实物孔距、螺纹、螺丝长度、采购SKU待核 |
| brake_caster_source | 原节点root/instances-37；包络69.652046×82.585972×16.34304mm | 原脚轮金属与轮面可见几何；轮面材料、轮径、承重、螺纹和采购SKU待核，不使用商品照片规格替换源几何 |

`data/stoolAccessoryCatalog.ts`提供名称、规格、来源、资产、BOM件数身份及待补资料；价格显式为pending/null，SKU为null。装饰短料和拉手属于other_accessory，脚轮属于foot_caster。三者都可用于设计放置，保持source_geometry_only和productionEligible:false。

`utils/stoolAccessoryAssets.ts`提供加载、精确识别、目录引用和标签标准化。加载时核验文件SHA、源模型SHA、几何合同、固定尺寸和几何签名。独立配件的semanticType为`stool_accessory:<id>`；原模板的handle/caster/decorative_profile也可在源SHA、尺寸、完整几何签名均匹配时识别。标记只改componentName/semanticType，保留每个原instancePath、hierarchy与网格数组。原凳子13件（8装饰块、1拉手、4脚轮）因此可共享目录身份，仍各有自己的来源实例路径。

同步解析器不信任现存partCatalogRef或名称。FNV-1a数值签名覆盖所有顶点、法线、UV、三角索引、材质、纹理、材质组和包络，只用于固定几何目录匹配，不是采购或生产安全凭证。缓存依赖源网格数组不可变合同；新导入JSON使用新数组重新验证。源顶点或材质变化后不能继续绑定该固定目录。

每种资产位于`public/models/stool-accessories/<id>/`：

- source-mesh-v1.json：原生ImportedSourceMesh；局部毫米、Y向上、居中。
- design-v1.json：可直接导入的单件mengkaile-diy schemaVersion2文件，默认落地。
- source-v1.glb：源网格视觉资产，数值单位毫米，并在extras中声明；正反面材质、纹理与原三角面保留。
- thumbnail-source-v1.png：真实源网格的512×512正交渲染，使用原法线、材质颜色、纹理及正反面；不是实物照片或AI生成图片。

构建脚本`build-stool-accessory-assets.py`只读已核验的source-v1.json，不读取或改写原SKP。manifest-v1.json绑定源哈希、JSON/GLB/缩略图哈希，记录零减面。GLB使用float32编码的最大坐标误差小于0.000002mm。

验证脚本`verify-stool-accessory-assets.ts`核对三个独立JSON的原生导入合同、资产哈希、精确签名、GLB包络和三角数、PNG，以及原模板13件同目录识别。源哈希伪造和0.00001mm顶点改动会被拒绝；零件价格不会被补为0。GLB数值单位为本站惯例的mm，外部软件导入时应按该声明处理。
