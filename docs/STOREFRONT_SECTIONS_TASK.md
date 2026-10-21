# 任务：网站新增三个销售板块（洞洞板配件 / 成品家具 / 样品购买）

- 任务来源：eshop 主数据「缺口 B · 网店有、网站缺」28 条
- 建立时间：2026-10-20
- 状态：**已上线代码，待发布**（`npm run build` 通过；页面可访问；价格 3 项待老板确认）
- 关联仓库：`eshop`（主数据/缺口判定） ↔ `alufactory-mengkaile`（真相源/售价）

---

## 1. 为什么要做

主数据把网店缺口分成两类：网站有网店缺（缺口 A）、网店有网站缺（缺口 B）。
缺口 B 原本有 28 条商品只能在淘宝/小红书/1688 卖，网站算不出价、加不进购物车 —— 意味着官网没有这些入口，
客户搜到的是店铺而不是官网，复购也回不到官网。

这 28 条按销售形态天然分成三块，所以不是零散补 28 个商品，而是补三个板块。

## 2. 交付物

| 类型 | 文件 |
| --- | --- |
| 数据（唯一来源） | `data/storefrontSections.ts` |
| 组件 | `components/StorefrontSections.tsx` |
| 路由 | `/#/section/:sectionId`（`App.tsx`） |
| 购物车行 | `ProductType.STOREFRONT_SKU` 分支（`App.tsx`、`components/FactorySheet.tsx`） |
| 价格导出 | `scripts/export-printable-catalog.tsx` → `.catalog-export/prices.json#storefrontSections` |
| 网店侧联动 | `eshop/products/website-sections.json` + `.workbuddy/build_master_v2.py` |

## 3. 三个板块与商品

### 洞洞板配件（6 款，`pegboard-accessories`）
挂杆 ¥12/支（100 支起 ¥8）· 短挂钩 ¥2.5 · 长挂钩 ¥5 · 托盘 ¥25 · 自锁挂杆套装（询价）· 螺丝堵盖（询价）

- 价格来源：**网站画册已公示价**（PrintableCatalog 第 20 页），可信。
- 图片：`/images/accessories/pegboard-01..06.jpg`，实拍，一张对一款。

### 成品家具（6 款，`finished-furniture`）
手机支架 ¥29 · LED 台灯 ¥549 · 婴儿护理台推车 ¥1099 —— 固定价，可直接加购
设备树底座 ¥60–919 · 铝型材床 ¥1600–1980 · 自行车收纳柜 ¥1098–1998 —— 区间价，走「按配置报价」

- 价格来源：**网店现售价**（官网从未定过），页面上标「价待确认」，不静默当官网价。
- 图片：**暂无实拍**，页面上是占位并标「产品图待补」。

### 样品购买（7 款，`samples`）
17 色样品套装 ¥35 · 2020 样段 ¥6 · 3030 样段 ¥10 · 阳极氧化样板 ¥10 · 高定漆样板 ¥10 · 海洋板样板（原木）¥49 · 海洋板样板（3 色/套）¥59

- 前 5 项价格来自网店（待确认），后 2 项来自网站画册（可信）。

## 4. 关键设计决定（别轻易改）

1. **区间价不给加购按钮。** 设备树 ¥60–919 这种，直接加购等于告诉客户 60 元能买整台。
   所以 `purchase: 'quote'` 的条目只出「复制询价单」，把规格拼成一段可发微信的文字。
2. **「价待确认」是可见的。** `needsReview: true` 会在卡片上打蓝标，并且写进购物车 config。
   这是为了防止半年后有人拿官网截图说「你们官网就卖 549」而实际成本变了。
3. **不复用 `ACCESSORY` 类型。** 配件类型绑着「配件专属运费规则/配件明细渲染/工厂单明细」，
   塞进去会把 549 元的台灯按配件运费算。新建 `STOREFRONT_SKU` 只做「单价×数量」，生产端当外购件。
4. **图片宁缺勿错。** 没有实拍的（家具 6 款里 5 款）走占位，不拿别的品类图凑，也不拿 3D 图冒充实拍。

## 5. 待办（下一个接手的人从这里开始）

- [ ] **产品图**：成品家具 5 款缺实拍（手机支架、LED 台灯、护理台推车、设备树底座、铝型材床、自行车柜）。
      拿到图后放 `public/images/storefront/`，改 `imageUrl` 即可，不用动组件。
- [ ] **价格确认**：台灯 549 / 护理台推车 1099 / 手机支架 29 / 各类样板 6–10 元 / 17 色套装 35。
      确认后把 `priceSource` 改 `'website'`、删 `needsReview`。
- [ ] **画册同步**：`PrintableCatalog.tsx` 还没排这三个板块（现在只在网站首页与 `/#/section/...` 可见）。
      画册加页要重排页码，单独一次改动。
- [ ] **AI 目录同步**：`ai_catalog.json` 尚未包含 `storefrontSections`（只在 `prices.json` 里）。
      如果后台报价/客服机器人要引用这三块，再加。
- [ ] **下发到网店**：网站价定稿后，用 eshop 的 `sync_inventory.py` 反向把官网价推回三个店。

## 6. 联动约定（两个仓库之间）

`eshop` 不硬编码这 28 条，而是读 `alufactory-mengkaile/.catalog-export/prices.json#storefrontSections`，
配合 `eshop/products/website-sections.json` 的 `groupToSection` 映射，把缺口 B 的行改判成 `已补到网站`。

所以：**网站改板块，eshop 重跑 `build_master_v2.py` 就自动跟上**，不需要两边手工对表。
反过来说，如果改了板块 id 或缺口分组名，必须同步改 `website-sections.json`，否则会退回「待补」。

## 7. 验收

```bash
npm run catalog:html          # 重新导出 prices.json（含 storefrontSections）
npx vite build --outDir .verify-storefront-sections-dist --emptyOutDir
# 起静态服务后看：
#   /#/                    首页三张板块卡
#   /#/section/pegboard-accessories
#   /#/section/finished-furniture
#   /#/section/samples
```

已验：三个板块页渲染正常；固定价加购进购物车显示「规格 / 单价 / 数量 / 小计」；工厂单把这类行标成「外购件（不加工）」并按声明的单件重量计运费。
