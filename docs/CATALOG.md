# 产品与价格画册

本任务分支：`codex/catalog-price-refresh`。为现有网站增加画册，不改变订单报价或上线站点。

## 页面与交付文件

- 首页新增画册入口：`#/catalog`。
- 可单独托管的离线 HTML：`public/catalog/mengkaile-catalog-2026.html`。图片内嵌，打开文件即可浏览、打印，不依赖外部字体或网络加载图片。
- PDF：`output/pdf/mengkaile-catalog-2026.pdf`，16 页 A4 横向。
- 两份客户 Excel：`outputs/catalog-2026/`。
- 客户点击“打印 / 保存 PDF”，选择 A4 横向、100% 缩放、关闭浏览器页眉页脚，打印机选择“另存为 PDF”。

## 数据与更新

`PrintableCatalog.tsx` 和报价器共用 `constants.ts` 的型材价格、`data/boardPricing.ts` 的板材价格、`data/accessoryCatalog.ts` 的配件定义。后两者从原报价器中原样抽出，没有改动计价行为。

`npm run build` 的 `prebuild` 自动运行 `npm run catalog:html`。离线 HTML 使用同一 React 组件服务端渲染，并将图片嵌入；同时向忽略提交的 `.catalog-export/prices.json` 写入 Excel 导出所用价格。

更新价格后应更新 `CATALOG_EDITION`，重建 HTML，重新导出并检查 PDF 与 Excel。PDF 和 Excel 是有版本的静态快照，不会在下载后自动更新。

Excel 导出使用 Codex bundled runtime 中的 `@oai/artifact-tool`：

1. 用 bundled Python 运行 `scripts/extract-catalog-sources.py [原始文件所在目录]`，默认读取 Downloads。原始文件不被修改。
2. `npm run catalog:html`。
3. 在 `/private/tmp/mengkaile-workbooks` 中将 `node_modules` 链接到 bundled runtime 的包目录，复制 `scripts/build_customer_price_workbooks.mjs` 到该目录。
4. 从仓库根目录使用 bundled Node 运行该副本。输出两份 XLSX；渲染检查图在临时目录。

## 价格核对

2026-09-08 下载线上首页引用的 `https://mengkaile.top/assets/index-wyqYng2g.js`，仅解析静态 AST，不执行该脚本。与本地源码完整比较：25 个型材、75 个型材价格数值、24 个板材费率、20 种配件定义及其 32 组适配型号价格（128 个阶梯价数值），差异为 0。

关键规则：

- 型材 VIP 每米减 2 元，VIP+ 每米减 4 元。加工费另计；长度大于20mm，最长3000mm。
- 普通/VIP铝板与洞洞板仅可选2mm、5mm；VIP+可选1–5mm。
- 海洋板仅12mm、18mm，素板与UV覆膜分别计价；彩色另加100元/㎡。
- 每块板至少计0.2㎡，单块金额保留一位小数后乘数量。
- 配件按同一明细20件门槛，原Excel的同色100件规则已过时。
- 首页 `basePrice` 不是定制产品的最终报价，未作为画册单价。

原Excel中的过时或不匹配信息在历史参考页保留并注明不作为当前报价。包括6/9/15mm海洋板、整张海洋板、部分4040配件、未明确长度/头型的螺丝以及原大货条件。型材旧米价和壁厚按网站更新，补齐原表未列出的4个型号；新增会员价公式引用当前零售价。

## 品牌与图片来源

公司介绍依据新提供的《上海至绘艺术品有限公司简介.docx》：按用户最新要求使用“20多年经验”，山东临沂生产基地、30000多平方米生产车间。旧画册中“江苏南通”的信息与新简介不一致，未沿用。没有将企业简介中的精度宣称转为本画册所有产品的制造公差承诺。

《南瓜皮企业画册.pdf》仅作结构参考，没有使用其文字、品牌或图片。品牌应用图片来自用户原画册及仓库现有实物图片。`public/images/catalog-editorial/` 中 home/detail/pegboard/factory 分别来自原画册的收纳柜、相框、彩色洞洞板和数控设备照片。既有产品 JPG 保持不变。

## 验证

- 生产构建成功。
- PDF逐页渲染检查，共16页，长表格、色卡与页脚无重叠。
- Excel全部工作表渲染检查，150个会员价格公式逐个核对，并测试基础价格变动后联动，恢复原值后导出。
- 原配件识别图保留在历史参考页。

本分支未发布到 mengkaile.top。按现有网站部署流程发布构建产物即可启用画册入口，也可单独托管离线HTML。

## 画册展示规则

普通用户和 VIP 使用完全相同的 16 页常规画册，不显示会员权益。登录 VIP+ 账户时额外增加第 17 页专属权益，标注账号手机号（User.id，不取收货地址电话）。打印和离线 HTML 下载均包含当前可见页面；公共静态 HTML 始终为常规版，不包含个人信息。下载时内嵌图片；准备过程中账户变化会取消过时快照。

整册使用 A4 横向；封面直接复用原画册完整首页，按比例完整显示。所有照片及截面图均不裁切。第 3 页使用原画册的阳极氧化、水性喷漆照片，以及网站整张色卡图。25 个型号新增截面列；现有 23 张截面原图直接复用，3060-N1-60 和 4080 缺少准确原图，标注“截面图待补”。

身份隔离与导出检查：`npx vite build --ssr scripts/check-catalog.tsx --outDir .catalog-export/check --emptyOutDir && node .catalog-export/check/check-catalog.js`。

2026-09-08 更新：型材分为左右短表，截面图高度由8mm增加至15mm；铝框门图片、规格、价格与计价示例移到铝板同页。新增6页原画册案例（User Stories、极简铝框 & 实木框、Gallery View、Custom Details、Luxury Living、他们都选择了我们），使用原照片重新排版，沿用深绿色品牌风格。常规版16页，VIP+版17页。

配件1515/2020/3030/4040全规格合并为第8页，展示银白、彩色零售价及银白批量价。彩色批量价格与门槛说明仅放在VIP+账号专属末页，普通及VIP版不显示。相框页按用户明确指定新增周长定价：50元/米，公式2×(宽+高)/1000×50，500×700mm示例为120元；此为画册定价内容，未修改网站相框报价器。

海洋板页新增用户提供的 IMG_9117.jpg 原图，保存为 marine-board-real.jpg；连接件表头与说明统一使用“本色／本色批量”，同页加入网站既有 accessory_codes.jpg 的1–10号配件识别图。图片均完整显示，配件价格仍集中一页。

工艺与色彩页新增截面处理对比，复用 profile-section-natural-vs-colored.jpg 完整原图：截面本色保留切口铝材银白本色；截面彩色（价格表称截面同色）使表面与切口均为所选颜色。说明与网站 ProfileSectionGuide 保持一致。


## 三语画册

画册使用 App.tsx 的既有 language 状态，跟随主页中文 / EN / 日本語切换，无独立语言状态。正文、表格、说明、图片替代文本、工具栏和 VIP+ 权益均提供中英日版本；价格与手机号不变。原封面与照片中的文字保留原图。

翻译位于 data/catalogTranslations.json；utils/catalogLocalization.ts 将画册的无状态展示树本地化，并复用产品、配件已有翻译。新增展示组件必须保持无 hooks，新增文案需同步补齐翻译。网页下载保存当前语言与当前会员可见页面，lang 标记和文件名同步。

构建生成三个公共离线文件：mengkaile-catalog-2026.html（中文）、mengkaile-catalog-2026-en.html（英文）、mengkaile-catalog-2026-jp.html（日文）。均为16页常规版，无私人手机号。检查覆盖三语正文、工具栏、页数和会员隔离；英日文17页VIP+测试样本仅输出临时目录用于打印排版检查，不作为公共文件。

联系页集中展示官方网站 mengkaile.top、微信、淘宝店与小红书。淘宝二维码来自用户 IMG_9118.jpg，小红书二维码来自 381.JPG，原图分别保存在 catalog-editorial/taobao-qr.jpg 与 xiaohongshu-qr.jpg，完整嵌入三语离线画册。标题和说明跟随主页语言切换，二维码内容不做改动。
