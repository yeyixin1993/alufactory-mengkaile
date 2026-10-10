# 项目长期记忆（mengkaile / alufactory）

## 运行与验证

- Node 用托管版 `/Users/eliye/.workbuddy/binaries/node/versions/22.22.2-6/bin`（加 PATH 前）；升级会删旧目录，跑前 `ls` 确认。
- `agent-browser` 副本在 `/Users/eliye/node_modules/.bin/`，必须 `AGENT_BROWSER_EXECUTABLE_PATH=<系统 Chrome>`（否则 CDP closed；closed → `close --all` 再 open）。native click 对 React 按钮偶发不生效，改 `eval "...el.click()"`（IIFE 包 const）。
- 回归统一 `vite build --ssr scripts/verify-*.ts` + node；多个 `--emptyOutDir` 先 **export** `CODEBUDDY_SAFE_DELETE_BULK_THRESHOLD=5000`（链式命令里前缀赋值只对第一条生效）。凳子全套 `npm run test:stool-all`。verify 脚本不能用 `__dirname`（ESM），用 `path.resolve('.')`。产物 `.verify-*/` 已一条 gitignore 覆盖；`vite.config.ts` 对 SSR 构建设了 `copyPublicDir: false`（否则每次回归都把 `public/` 210M 复制进产物目录，GitHub Desktop 会当成几百张新图片）——**别删这行**。
- `tsc --noEmit` 既有报错 9 个（2026-10-10 核对）：FRONTEND_SERVICE `@/config`、App.tsx `setTimeout`、AIChatBar `phone`×3、AIProfile3D `createChatProfilePreview`、PrintableCatalog `key`×3。
- `npm run dev` 曾因 watcher 在 `.venv-local` 符号链接 ELOOP 崩溃；冒烟可改 `vite preview --port 4173`。3000/5001 可能被业主占用，**别杀**。
- 后端测试：`alufactory-backend/.venv-local/bin/python -m pytest tests -q`（基线 105）。`curl` 本地必加 `--noproxy '*'`。验 dist 新旧：工作区 clean + dist mtime 晚于最后 commit + grep 特征串。
- `git push` 跑 pre-push 钩子（先 package:dist，慢）→ `dangerouslyDisableSandbox` + 后台。**上线 = 手工上传 ZIP 内 dist/**，push 不部署。

## AI 聊天（只在 codex/ai-sales-assistant worktree：`/Users/eliye/.codex/worktrees/ai-sales-assistant/alufactory-mengkaile`）

- 调试用 `npm run dev:deepseek`（Flask 5001 + Vite 3000；端口被占直接退出）。后端起不来 = 缺 `DEEPSEEK_API_KEY`。
- **游客/账号额度完全独立**：游客 3 条、同 IP 每日 10 个新游客；真发消息扣 DeepSeek 余额，验证用 FAQ 命中问题（免费）。引导词须 FAQ 精确命中；`seed_faq_rules()` 只补缺不更新。停服用 `reason` 码。SQLite 加列用 `db.session.execute(text(...))+commit()`。

## 设计文件合同 mengkaile-diy（docs §13.6）

- v2 = 每件自带完整网格（SketchUp 插件继续产 v2）；v3 = 顶层 `sourceGeometries`（FNV-1a 键）共享重复几何。只真去重才写 v3；导入端先 `expandImportedSourceGeometries` 再预检；**绝不取整/降采样**。

## 产品与计价约定

- 配件目录唯一来源 `data/accessoryCatalog.ts`（客户端用 `CUSTOMER_ACCESSORY_ROWS` 过滤）；本色/彩色两档、20 件批量价；`ACCESSORY_CODE_IMAGE_MAP` 归 catalog，**实物 JPG 绝不被 SVG 覆盖**。
- **设计器（2026-10-10 三改）**：① 连接配件两级选择——一级一条配件、二级展开选型号（2020/3030…），二级 testid `diy-add-<kind>-<series>`。② 右侧报价加省份下拉（`diy-estimate-province` / `diy-estimate-landed`），纯函数 `utils/designerLandedEstimate.ts` 镜像购物车运费规则，**省份不进设计文件**；回归 `test:designer-shipping-estimate`（凳子发浙江 = ¥952）。③ 一级配件行用配件区实物照片（`utils/designerAccessoryImages.ts` 唯一映射 6 个连接 kind→1/2/5/7L/7T/9.jpg；catalog 的 8/10.jpg 键 public 下无文件，勿扩）；回归 `test:designer-library-images`。产品决策改动同步 `docs/DIY_DESIGNER_PROJECT_KNOWLEDGE.md`。
- 导入件计价 `utils/designerComponentPricing.ts`；源件→目录配件链接唯一来源 `data/designerSourceAccessoryLinks.ts`（系列由包络推，fail-closed 回 ¥2）。螺丝 `utils/designerScrewPricing.ts`。**¥952 落地基线**由 pricing/screw-pricing/stool-landed-total 冻结（安能 ¥33）。
- 制造门禁：`blocking`（确认清不掉）vs `advisories`（勾一次放行）；`decideDesignerReleaseGate` 纯函数，声明一变确认失效。**几何容差统一 1 µm**；文件里 `productionRelease` 只是历史，导入后重算。
- `toCartItems` 每个 kind 都要分支（漏过会线上崩）；相同件并一行，行 id = 分组键（源件 id 含包络尺寸）。型材按长度计价，加工费按件，20–100mm 短件 +¥5/根；板材 0.2m² 起计。库存 UTC、界面东八区。

## 分支 / 用户

- 用户用 **GitHub Desktop**：切分支自动 `git stash`，工作区 clean ≠ 改动丢了。

## 浏览器冒烟配方

- 静态 dist：`run_in_background` 跑 `python3 -m http.server 4180 --directory dist`；hash 路由 `#/diy-designer`；首屏外按钮先 `scrollIntoView` 再 click。
