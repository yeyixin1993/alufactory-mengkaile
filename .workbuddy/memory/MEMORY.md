# 项目长期记忆（mengkaile / alufactory）

## 环境 / 验证 / 坑

- **Node**：托管版 `/Users/eliye/.workbuddy/binaries/node/versions/22.22.2-6/bin`（升级会删旧目录，跑前 `ls` 确认）。**Python**：托管 venv `/Users/eliye/.workbuddy/binaries/python/envs/default`（已装 openpyxl、**formulas 1.3.4** 可重算 Excel 公式）。
- **浏览器**：`agent-browser` 在 `/Users/eliye/node_modules/.bin/`，需 `AGENT_BROWSER_EXECUTABLE_PATH=<系统 Chrome>`（CDP closed → `close --all` 再 open）；React 按钮用 `eval "...el.click()"` 比 native click 稳。
- **回归**：`vite build --ssr scripts/verify-*.ts` + node；凳子全套 `npm run test:stool-all`。verify 脚本用 `path.resolve('.')` 不用 `__dirname`（ESM）。`vite.config.ts` 的 SSR `copyPublicDir: false` **别删**（否则 public/ 210M 被复制进产物）。
- **多个 `--emptyOutDir` 或 `git push` 前必须 `export CODEBUDDY_SAFE_DELETE_BULK_THRESHOLD=5000`**（`pre-push` 的 `package:dist` 会 emptyDir(dist/assets) 244 文件被沙箱守卫拦；行内前缀传不进子进程钩子）。
- `tsc --noEmit` **既有 8 个报错**（`@/config`、App `setTimeout`、AIChatBar `phone`×3、PrintableCatalog `key`×3），不是你改坏的。
- `.git/index.lock` **0 字节僵尸锁**反复出现：元凶是 GitHub Desktop 的 `git status --untracked-files=all` 进程在 55MB 单行 catalog 上卡死。排查 `pgrep -fl git`（`-f` 才有完整命令行；`ps` 沙箱不许），`lsof` 为空 → 直接 `rm -f`。读不受影响，只有 add/commit 被挡。
- **`public/catalog/mengkaile-catalog-2026-jp.html`（55MB 单行、被 git 跟踪）出现在 status 时先查 NUL**（`python3 -c "print(open(p,'rb').read().count(0))"`，只对文本扩展名查）：曾出现等长 16KB 全 0 空洞却看不出差异，极易误提交 → `git checkout --` 重建。
- `npm run dev` 曾因 `.venv-local` 符号链接 ELOOP 崩；冒烟用 `vite preview --port 4173`。3000/5001 可能被占用**别杀**。hash 路由 `#/diy-designer`。
- **后端测试**：`alufactory-backend/.venv-tests/bin/python -m pytest tests -q`（旧 `.venv-local` 已废）。**基线 118 项 / 117 passed / 1 failed**，失败项 `test_free_allowance_applies_locally_too` 是既有问题（`AI_LOCAL_UNLIMITED` 开关与 10-09「已删」的决定冲突），别当成自己改坏的。纯逻辑测试 `python3 scripts/test-ai-sales-advice.py` 不需要 Flask。`curl` 本地必加 `--noproxy '*'`。
- 用户日常生成 Excel（单据/价格表）：流程 = **脚本现读源数据 → openpyxl 写公式 → `formulas` 重算 → 把结果以 `<v>` 回写 sheet XML → 公式与缓存值都在**（可复用 `outputs/.萌开了家居_*价格表*.ref/recalc.py`；坑：`<Relationship>` 的 Target 在 Id 之前、Target 有前导 `/`、workbook.xml 捕获组是 `rId(\d+)` 需拼回 `"rId"+rid`；另设 `wb.calculation.fullCalcOnLoad=True`）。生成后**别再用本地 office 编辑器保存**（会把公式写成 `<f>=...` 导致 Excel 报错）。

## 部署 / 发布

- **前端**：Mac 侧 `~/WorkBuddy/2026-10-11-00-37-18/sync-frontend.sh`（构建 → rsync 到 `/home/alufactory/frontend-staging` → 触发远端发布）；桌面上也有 `更新前端网站.command`。服务器侧 `/home/alufactory/deploy-frontend.sh`（git pull → build → 发布到 `/www/mengkaile-frontend` → md5 校验）。二者与后端 `/home/alufactory/update.sh` **完全独立，不要动 update.sh**。
- **铁律：不删除任何文件**。deploy 脚本里 4 处 `rm` 全部注释；rsync 不带 `--delete`（`SYNC_DELETE=0`）；不提供任何清理/删除开关（用户对这点极敏感，宁可功能少）。站点里 143 个孤儿 bundle / 17 张旧图一律保留。
- ECS `47.98.229.152`（Ubuntu 22.04，2vCPU/**1.6G 内存/无 swap/未装 Node**，root 登录，部署密钥 `~/.ssh/mengkaile_deploy`）。所以**前端在 Mac 上构建**。站点根 `/www/mengkaile-frontend`（实测生效），nginx 80→443，`/api/` → 127.0.0.1:5000；`/etc/nginx/conf.d/mengkaile.conf` 有 4 个同名 server block 重复粘贴，靠「先定义者胜」侥幸选对，**待清理**。ECS 无 `www` 用户，脚本不改属主。
- `dist` 本身 gitignore，push 只构建不部署；手工部署 = 上传 ZIP 内 dist（ZIP 产物固定 `/Users/eliye/Downloads/mengkaile-dist-latest.zip`，159MB）。验线上新旧：工作区 clean + dist mtime 晚于最后 commit + grep 特征串。

## 后端 / AI（只在 codex worktree：`/Users/eliye/.codex/worktrees/ai-sales-assistant/alufactory-mengkaile`）

- **线上**：systemd 服务 `alufactory`，目录 `/home/alufactory/alufactory-mengkaile/alufactory-backend`，venv 名 `venv`，重启 `sudo systemctl restart alufactory`；**入口是 `run_prod.py`（不是 wsgi.py）**，只有 bare `load_dotenv()` → 只读工作目录 `.env`，所以 `.env.deepseek.production` 不生效。真修法：systemd drop-in `EnvironmentFile=`（推荐）或追加进 `.env`。本地 file = `.env.deepseek.local`。**总开关是 DB `AISettings(id=1).enabled`**（默认 false），在 `/admin/ai.html` 勾选。调试 `npm run dev:deepseek`（Flask 5001 + Vite 3000）。
- **admin 页只能走 `http://47.98.229.152/admin/`（非安全上下文）**：禁用 `crypto.randomUUID`，统一用 `newId()`（曾因 `newId()` 递归自身导致 localhost 打开时栈溢出白屏）。Flask 把 `alufactory-backend/admin/` 当静态目录，改完同步文件即可。
- **应答级联（2026-10-20 起）**：本地话术 → `match_faq` 精确 → `ai_knowledge.pick()` 近似（`source='knowledge'`，免费）→ 模型。近似 = 二元组 Dice×0.6 + SequenceMatcher×0.4，阈值 0.68 / 覆盖率 0.55 / 与次优分差 <0.06 视为歧义不答；`_strip_wrappers` 剥开头 `老板/买家问/请问/在吗` 后再比。长句是固有短板（~36%），别再调阈值。
- **钱类护栏**：报价咨询 / 付款与充值 / 账户与额度三类**永不由近似命中回答**。
- 生产库（606MB SQLite，DATABASE_URL 是相对路径 `sqlite:///alufactory.db` → `instance/alufactory.db`）。**真实表名/列名与 ORM 不同**：`ai_faq_rules`（复数）、备注列 `notes`；`ai_knowledge_misses(id/question/normalized/count/candidates/status/...)`。ECS 上临时脚本要 `load_dotenv()` + 设 `DATABASE_URL=sqlite:///alufactory.db`（否则 ProductionConfig 去连 MySQL）。
- **知识导入不会自动发生**：`update.sh` 只 pull + pip + restart。必须手动 `python import_ai_knowledge.py ../outputs/客服知识库-可导入.csv --database "sqlite:////home/alufactory/.../instance/alufactory.db"`（先 `--dry-run` → 默认草稿 → `--update --publish` 批量启用；不加 `--update` 重跑全 skip）。导入后**无需重启**。新增知识前先 grep `app/ai_faq_seed.json` 的 question/aliases（撞车整行静默跳过）。
- 2026-10-21 上线：规则总数 73（36 种子 + 37 新增）全启用，`AISettings.enabled=True`。
- 游客（3 条 / 同 IP 每日 10 个新游客）与账号额度独立；`seed_faq_rules()` 只补缺不更新；SQLite 加列用 `text(...)+commit()`。

## 产品与计价

- 配件目录唯一来源 `data/accessoryCatalog.ts`（`CUSTOMER_ACCESSORY_ROWS` 过滤，`ACCESSORY_CODE_IMAGE_MAP` 归 catalog，**实物 JPG 绝不被 SVG 覆盖**）。
- 设计器：连接配件两级选择；省份下拉预览到手价（`utils/designerLandedEstimate.ts`，**省份不进设计文件**）；配件行用实物照片（`designerAccessoryImages.ts`，只有 1/2/5/7L/7T/9.jpg）。导入件计价 `utils/designerComponentPricing.ts`、螺丝 `designerScrewPricing.ts`、链接表 `data/designerSourceAccessoryLinks.ts`。**¥952 落地基线**已冻结（凳子发浙江，安能 ¥33）。
- **运费（三种方式，`constants.ts` + `App.tsx: calcShippingForMethod`）**：普通/顺丰 = 首重 + (ceil(kg)−1)×续重，**型材 >1500mm 每件 +¥20**；**安能 = ≤15kg 首重一口价，超过部分 ceil(kg−15)×续重，不收超长费**；到付 = 0。购物车自动取最低。费率表导出脚本 `outputs/.萌开了家居_快递运费价格表_普通快递与顺丰.ref/build.py`（成品 `outputs/萌开了家居_运费价格表_普通快递-顺丰-安能.xlsx`）。2026-10-29 店主确认已修：安能山西 110→38、江苏顺丰 19/7→18/6、**省份兜底 = 普通 12/5、顺丰 18/5**（兜底字面量每个快递 channel 都有 3 处：App.tsx:1100/1109/1114、QuickQuote.tsx:163-165、FactorySheet.tsx:354/357/361，改动必须三处同步）；价表脚本 `build.py` 的兜底值已改为现读 App.tsx，不再手抄。**仅剩山西顺丰 19/6 待确认**（陕西 18/5）。
- **运费表成品更新在资料库云端（2026-10-29 用户指定）**：node `3wRrX7AQby1XA8HGKx8XXC` / https://www.workbuddy.cn/space/d/3wRrX7AQby1XA8HGKx8XXC ，改法 = 本地脚本重生成后用 `drive/upload_drive_file.py --node-id 3wRrX7AQby1XA8HGKx8XXC` 整体替换（保同一链接）。**不要在云端/本地 office 里直接手改单元格**（会把公式变成单格 array 形式）。
- 制造门禁 `blocking` vs `advisories`（`decideDesignerReleaseGate` 纯函数，声明一变确认失效）；**几何容差 1 µm**；`toCartItems` 每个 kind 都要分支（漏一个线上崩）。型材按长度计价、加工费按件、20–100mm 短件 +¥5/根、板材 0.2m² 起、加工报价非 VIP+ 且 ≤100mm +¥5/根、长度上限 3000mm。库存 UTC、界面东八区。
- **加工单价唯一出处 `utils/quickQuoteProfile.ts:10`**：攻丝 ¥1.5/端、通孔 ¥1、沉头孔 ¥1.8、螺纹孔 ¥1.8、45°斜切 ¥1/刀（店主 2026-10-21 确认螺纹孔是 1.8）。
- **加工公差（店主确认）**：开孔正公差 +1~3 丝；光轴负公差 −3~5 丝（1 丝 = 0.01mm），外购轴的公差不替厂商保证。
- **两条对外口径**：① 外购轴**以实物实测为准**（配孔前先卡尺量）；②「会不会倒」= 重量较轻、不太偏离重心一般不会倒，偏重或探出多建议配重/上墙固定。

## 设计文件合同 mengkaile-diy（docs §13.6）

- v2 每件自带完整网格；v3 顶层 `sourceGeometries`（FNV-1a 键）共享重复几何。只真去重才写 v3；导入端先 `expandImportedSourceGeometries` 再预检；**绝不取整/降采样**。

## 用户习惯

- 用 **GitHub Desktop**：切分支自动 stash，工作区 clean ≠ 改动丢了。
- `outputs/chat-dump/` 已 gitignore（群聊原文含外包客服发言），只提交 CSV 与待答清单。
- 报价单/采购单成品放 `/Users/eliye/mengkaile/price-list`；单据模板在 `~/WorkBuddy/2026-10-15-19-10-48/`。
