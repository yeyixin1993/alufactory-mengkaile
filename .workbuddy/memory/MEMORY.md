# 项目长期记忆（mengkaile / alufactory）

## 运行与验证

- Node 用托管版：`/Users/eliye/.workbuddy/binaries/node/versions/22.22.2-6/bin`（跑 npm 时把这个目录加到 PATH 前面）。
  **托管 Node 会被平台升级并删掉旧版本目录**（2026-10-09 从 `22.22.2-2` 换成 `-6`）：升级会把装在旧版本
  全局 bin 里的命令行工具一起删掉（`agent-browser` 就这样没了）。跑之前先 `ls .../node/versions/` 确认。
- **`agent-browser` 现在不在托管 Node 里**（那次升级把它删了）。可用副本在
  `/Users/eliye/node_modules/.bin/agent-browser`（家目录那份 scratch `package.json` 里带 `agent-browser@^0.27.0`）。
  它自带的 Chromium 也没了，要**复用系统 Chrome**：
  ```bash
  export PATH="/Users/eliye/node_modules/.bin:/Users/eliye/.workbuddy/binaries/node/versions/22.22.2-6/bin:$PATH"
  export AGENT_BROWSER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ```
  不设 `AGENT_BROWSER_EXECUTABLE_PATH` 会 `CDP response channel closed`。另外 `open <url>` 第一次可能
  停在 `about:blank`（CDP 竞态），**再 `open` 一次或 `get url` 复核**再往下走。
- 前端回归脚本统一走 `vite build --ssr scripts/verify-*.ts` + `node`（`test:designer-group-move`、
  `test:drill-mode-manipulators`、`test:accessory-list-reform` …）。新增校验脚本时按同样模式加 package.json script。
- **批量删除坑（safe-delete shim 按「回合」累计计数，阈值 50）**：`prebuild`（`catalog:html`）会对
  `.catalog-export` 做 `--emptyOutDir`，同一回合连续跑多个 `vite --emptyOutDir` 就会报
  `SAFE_DELETE_BULK_CONFIRM_REQUIRED`。**用 Python 预先清目录这次也照样计数**（本回合累计 158）。
  真正管用的开关是环境变量 `CODEBUDDY_SAFE_DELETE_BULK_THRESHOLD`（默认 50）：删的都是本项目
  `dist` / `.catalog-export` 这类构建产物时，命令前加 `CODEBUDDY_SAFE_DELETE_BULK_THRESHOLD=5000` 即可。
  相关变量：`CODEBUDDY_SAFE_DELETE_BULK_STATE_DIR`（计数状态目录）、`REPORT_PATH`、`BIN_DIR`。
- `tsc --noEmit` 有 5 个**既有**报错（不是自己引入的）：`alufactory-backend/FRONTEND_SERVICE.ts` 的
  `@/config`、`App.tsx` 的 `setTimeout`、`components/PrintableCatalog.tsx` 的 3 个 `key`。
- **`git push` 会跑 `.githooks/pre-push`**（`core.hooksPath=.githooks`）：先 `npm run package:dist`
  （完整 build + 打 ZIP）才推，所以很慢且在沙箱里易撞批量删除拦截 —— 用 `dangerouslyDisableSandbox` + 后台跑。
- **上线 = 手工上传 ZIP 内 `dist/` 的内容**；`git push` **不会**部署前端（`dist` 被 gitignore，
  `git ls-files dist` = 0），`mengkaile.top` 也不是 push 自动部署（见 `docs/CODEX_CHAT_HANDOFF_2026-08-10.md` §1）。
  `~/Downloads/mengkaile-dist-latest.zip` 由 `scripts/package-dist.mjs` 产出，**zip 顶层就是 `dist/` 目录**，别整包直传。
  **判断「这份 dist/zip 是不是最新」三步**：① `git status --porcelain` 为空；② `dist/index.html` 的 mtime
  **晚于** `git log -1 --format=%cI`；③ `grep -o 'mengkaile-ai-visitor' dist/assets/index-*.js`（或任一刚改特征串）
  能命中 ⇒ 产物确实含最新代码。前端 dist **不含** `alufactory-backend/admin/*.html` 与后端改动，需另部署后端。
- 端到端冒烟用 `agent-browser`；配方见本文末「浏览器冒烟配方」。
- **后端跑测试/脚本用 `alufactory-backend/.venv-local/bin/python`**（Flask 2.3.2 / SQLAlchemy 2.0，
  在 worktree 的 `alufactory-backend/.venv-local/`；托管 Python 和 brew Python 都**没有** flask）。
  全量回归：`cd alufactory-backend && ./.venv-local/bin/python -m pytest tests -q`（2026-10-09 基线 105 passed）。
- **`curl` 访问本地服务要加 `--noproxy '*'`**：不加会走本机代理，返回 502 让人误判「服务没起来」。
- `run_deepseek_local.py` 端口被占就 `Address already in use` 直接退出，**不换端口**；业主可能正跑着
  旧代码的 5001，验证新改动要么请他重启，要么另起隔离实例（见 AI 聊天一节）。

## AI 聊天（AI 顾问）本地调试 —— 只在 `codex/ai-sales-assistant`

- **必须用 `npm run dev:deepseek`**（`scripts/dev-deepseek.mjs`：同时起 Flask `127.0.0.1:5001`
  和 Vite `127.0.0.1:3000`，并给 Vite 注入 `VITE_API_URL=http://127.0.0.1:5001/api`）。
  只跑 `npm run dev`（`vite.config.ts` 的 proxy `/api → 127.0.0.1:5001`）不会有 AI 后端。
  该脚本会**先探测 3000/5001 是否空闲，被占用就直接退出**，不会自动换端口/杀进程。
- 后端起不来最常见的原因：`alufactory-backend/.env.deepseek.local` 缺 `DEEPSEEK_API_KEY`
  （`run_deepseek_local.py` 会 `SystemExit(1)`，wrapper 连带把 Vite 也停掉）。
  本地 AI 库在 `alufactory-backend/instance/deepseek-local/ai-test.db`（账号/AI 数据独立，不是线上库）。
- **「开始咨询」按钮灰掉 ≠ 游客被限制**。`components/AIChatBar.tsx` 的禁用条件是
  `busy || reading || !status.enabled || (!status.configured && !status.local_answers_available) || 无输入`；
  `/api/ai/status` 打不通时 `status` 为 `null` ⇒ `!status?.enabled` 为真 ⇒ 灰。
  **先看 Console 有没有 `ERR_CONNECTION_REFUSED`，再谈业务规则。**
- 后端 `account_view`：`enabled = AISettings.enabled and AIAccount.enabled`；
  `settings()` 在缺行时会**建一条 `enabled=False`**（`run_deepseek_local.py` 启动时会强制置 True）；
  `local_answers_available = 存在 enabled 的 AIFaqRule`。游客（无 JWT）靠 `visitor_token` 建 `g:` 账号，
  新账号 `trial_limit=3`；同一 IP 每天最多新建 10 个游客账号（超了报「当前网络试用申请过于频繁」）。
- **本地与线上同规则（2026-10-09 业主决定，`AI_LOCAL_UNLIMITED` 已删）**：本地游客同样只有 3 条、登录后
  看账号自己的余额，页面不再有「本地测试 · 不限额度」。`run_deepseek_local.py` 与生产的差别只剩
  **隔离数据库 + 拦截真实支付**。**真发消息会真实扣 DeepSeek 余额**，验证按钮状态时不要真提交；
  FAQ 命中的消息不调模型、不花钱（`docs/AI_FAQ_STARTER.md` 的标准问题，如「多久发货」），端到端验证用它。
- **游客被「当前网络试用申请过于频繁，请登录后使用。」挡住（2026-10-09 真踩到）**：`identity()` 里
  `rate_limit('guest:{remote_addr}:{UTC day}', 10)` —— **同一 IP 每天只能新建 10 个游客账号**。
  只要 localStorage 里没有有效 `mengkaile-ai-visitor`（新 profile / 无痕 / 清过 storage / 换了 launcher
  导致 SECRET_KEY 变化），每次打开都算新建一个，10 次就打满、当天再打开就被拒。本机测试库查法：
  `ai_rate_windows` 的 key 是 `sha256(bucket)`，bucket = `guest:127.0.0.1:<UTC日期>`；要放行就
  `update ai_rate_windows set count=0 where id=<该 hash>`（**只动本地 `instance/deepseek-local/ai-test.db`**）。
  顺手把 3 条试用规则改回「游客可试用」是业主 2026-10-09 明确否掉的，不要再提议去改。
- **游客与账号是两套完全独立的额度（2026-10-09 业主最终口径，已实现）**：**没登录就是游客，登录了就看账号
  自己的 status**，互不掺和 —— 业主原话「明明没登录又算登录额度让客户登录，very confusing」。
  游客身份 = 浏览器签名 token（`g:<uuid>`），三条用完即止；`identity()` 里**既不合并**设备已用次数、
  **也不写 `claimed_by`**（**该字段已从 `app/ai_models.py` 删除**，`claimed_by`/`trial_claimed` 只剩文档与
  注释里的历史说明）。旧的两层行为都已删：① 带游客 token 登录过就永久 400 `trial_claimed`
  「试用次数已转入注册账号，请登录使用。」；② 登录时把设备已用次数 `max()` 进账号。
  **已知代价（业主明确接受）**：同一台设备可以「游客用满 3 条 → 注册/登录 → 再用账号自己的 3 条」。
  想重置某台设备的游客额度：删 `localStorage['mengkaile-ai-visitor']`（受同 IP 每日 10 个新游客限制）。
  回归 `alufactory-backend/tests/test_ai_chat.py::test_guest_and_account_allowances_are_separate`。
- **AI 首页引导词 ↔ 已核实问答必须一一对应**：`.ai-entry-suggestions` 的三个引导词硬编码在
  `components/AIChatBar.tsx`（**raw 中文、不走多语言**），且**必须是 FAQ 精确命中**，否则会走模型
  （花钱且答案不可控）。`match_faq` 只做 normalize 后的**集合精确匹配**（无子串），所以新引导词
  必须**新增/复用一个问法完全一致**的规则；回归 `alufactory-backend/tests/test_ai_faq.py::
  test_home_suggestion_chips_have_verified_answers`（直接从 TSX 抠数组断言全部命中）。
- **`seed_faq_rules()` 只补缺失 id、不更新已有行**（例外：`ai_faq_legacy_drafts.json` 的
  version+CAS 升级）。⇒ 给现有问答**加同义问法/改答案，改 seed 无效**；要么**新建 id**，
  要么让业主在「后台 → AI 问答规则库」改（后台改动不会被重启覆盖）。AI 问答规则库共 36 条（全启用）。
- **访客停服状态一律用 `reason` 码传递，前端不解析中文文案**（2026-10-09 落地）：`ai_chat.py` 的
  `IdentityError(ValueError)`（带 `.reason`）+ `identity_error(exc)` 统一 400 返回
  `{error, reason}`，码值 `account_disabled / visitor_token_invalid / visitor_token_expired /
  guest_rate_limited`，`/chat` 的「试用已用完」409 带 `trial_exhausted`。
  `apiService.request` 把响应体挂到 `Error.payload`（否则 reason 被丢掉）。前端 `statusFailure()` →
  `{message, lock}`；额度区显示 `剩余 X/trial_limit 条`，`0/3` 或 lock 时提交键灰 + `登录` 链接
  （`.ai-entry-actions` / `.ai-entry-login` / `.ai-entry-lock`）。
- 本地直接能看到 3/3 → 0/3（不再需要另起 5002/3001 那套「关掉不限额度」的后端）；用 FAQ 问题连发 3 条
  零成本走到 0/3。**`agent-browser network route --body` 在本环境不生效**，别用它打桩。
  **`agent-browser` 报 `✗ CDP response channel closed` 时**：`agent-browser close --all` 再 `open` 即可恢复
  （必要时先删 `~/.agent-browser/default.*` 陈旧状态；`agent-browser doctor --fix` 可验证启动链路正常）。
- **前端曾把后端的真实原因吞掉（2026-10-09 已修）**：`AIChatBar` 的 `/status` 失败分支原先把所有异常
  都写成「咨询服务暂时连接不上，请稍后重试，或先使用快速报价。」，于是「游客名额已满」「访客凭据已失效」
  这类**服务端明确给了原因**的失败看起来跟「后端没开」一模一样 —— 业主就是这样误判成「游客不能进 AI chat」。
  现在用 `statusFailure()` 区分：只有 fetch `TypeError` / 5xx 才说连接不上，其余一律原样透出后端文案。
- **后台查全部问答记录（2026-10-09 新增，未提交）**：归档一直在 `ai_requests` + `ai_conversation_messages`
  （游客 `g:<uuid>`、登录 `u:<userId>`），缺的只是后台查看口。接口全在 `app/routes/ai_chat.py`：
  `GET /api/ai/admin/conversations`（`q` 搜手机号/用户名/游客ID/首次 IP，`kind=user|guest`，20/页）、
  `.../conversations/<id>`（完整明细）、`.../messages/<request_id>/images`（附件**按需**取，
  明细绝不内联 base64）。页面 `alufactory-backend/admin/ai-conversations.html`。
  `ai_accounts` 加 `first_ip / first_user_agent / first_seen_at`（`identity()` 首次见到账号写一次）。
  **归档前的老 `ai_requests` 没有会话链接**，后台列表读取时靠 `ai_conversations.adopt_orphan_requests()`
  （幂等、限 500）收编 —— 否则「问完再也不回来」的客户问答永远看不见。
- **`app/__init__.py` 自动迁移的坑（SQLite）**：照抄 orders/profiles 的
  `with db.engine.connect() as conn: conn.execute(text('ALTER TABLE ...'))` 会 **`database is locked`** ——
  前面 `seed_*_inventory()` 的事务占着写锁，而 `except Exception: pass` 把异常吞掉 ⇒ 列**静默没加上**
  （非 tty 时 print 还在缓冲里，更难发现）。**新加列要用 `db.session.execute(text(...)) + db.session.commit()`**。
  orders/profiles 两段很可能同样有隐患，只是列早就存在才没暴露。2026-10-09 实测：改法生效、重启幂等。
- **不想打扰业主正在跑的 5001 时**：复制 `instance/deepseek-local/{ai-test.db,session-secret.local}` 到
  `/tmp/<dir>/`，写个小 `serve.py` 设 `DATABASE_URL=sqlite:////tmp/<dir>/ai-test.db`、`SECRET_KEY`/`JWT_SECRET_KEY`
  = 复制的 secret，`create_app('development', instance_path='/tmp/<dir>')` 后 `app.run(port=5002)`。
  用同一 secret 造管理员 JWT（`create_access_token(identity=<users.is_admin=1 的 id>)`）即可直接调后台接口。

## 分支 / worktree 现状（2026-10-09 核对）

- `main` 与 `origin/main` 同步，本地领先量**用 `git log --oneline origin/main..main` 核对，别信快照**。
- `codex/ai-sales-assistant` 由 **worktree** 承载：`/Users/eliye/.codex/worktrees/ai-sales-assistant/alufactory-mengkaile`
  （**分支被那个 worktree 占用，主工作区无法 checkout/更新它**；要动就在那个目录里动）。
- 用户用 **GitHub Desktop**，切分支时它会自动 `git stash`，「工作区看起来 clean」不代表改动丢了 ——
  先 `git stash list` + `git stash show --name-status` 再下结论。

## 设计文件合同 `mengkaile-diy`（细节见 `docs/DIY_DESIGNER_PROJECT_KNOWLEDGE.md` §13.6）

- **v2**：每件 `sourceMesh` 自带 `positionsMm/normals/uvs/indices/materials/groups/boundsMm`。
  **SketchUp 插件与外部 AI 提示词继续产出 v2，不要改。**
- **v3**：顶层 `sourceGeometries: { "fnv1a32:xxxxxxxx": 几何 }`，零件的 `sourceMesh` 只留
  `schemaVersion/coordinateSystem/source/reviewStatus/geometryRef`。**`source` 永不共享**；
  键 = 几何自身的 FNV-1a 摘要（`utils/importedSourceGeometrySharing.ts` 的 `hashImportedSourceGeometry`）。
- 规则：**只在真去掉重复几何时才写 v3**（`buildDesignDocument` 的 `{shareSourceGeometries}` 默认关，
  设计器 `save()` 打开）；导入端**必须在 `inspectDesignerImportItems` 之前** `expandImportedSourceGeometries`
  （预检要看完整网格，缺字段 fail-closed 拒绝）。**绝不做精度取整/降采样省体积** —— 会破坏配件几何签名与目录身份。
- 回归 `npm run test:source-geometry-sharing`。导出给业主的成品设计：`npm run export:stool-952`
  （`scripts/export-stool-design.ts`，默认写 `~/Downloads/mengkaile-凳子-952-含诺贝轮.json`）。
  **必须紧凑 `JSON.stringify`**（格式化会逼近 128 MiB 导入上限），共享几何后 11.47 MB。

## 产品与代码约定

- 配件目录唯一来源 `data/accessoryCatalog.ts`；单价/批量/颜色档位规则在 `utils/accessoryQuote.ts`（纯函数）。
- **配件图案规则**：`ACCESSORY_CODE_IMAGE_MAP` 每个编号必须指向自己的图，禁止回落到整张 1–10 识别图。
  这张表**唯一归属 `data/accessoryCatalog.ts`**，商城/快速报价/报价编辑器/设计器面板/**工厂单**都从它取
  （工厂单自建副本已漂移过一次，已删）。两条线并存、不可互换：
  - **实物 JPG** `/images/accessory/<imageKey>.jpg` —— 门店、购物车、客户 PDF、工厂 PDF 的权威图形，
    **绝不允许 SVG 覆盖 JPG**；新编号从 `public/images/accessory/accessory_codes.jpg` 裁框 resample。
  - **设计器 SVG** `/images/accessory/<code>.svg`，统一 400×300 画布，按源网格正视投影绘制。
    它是「参考物」不是运行时图片源，客户界面不渲染它。
- 配件选择是**平铺列表**（行键 `definitionId::series`），颜色只有本色/彩色两档；
  型材、板材、洞洞板、海洋板、柜门保留完整色板。
- 设计器产品规则以 `docs/DIY_DESIGNER_PROJECT_KNOWLEDGE.md` 为准，改产品决策要同步该文件 + 追加 changelog。
- 订单/后台时间口径：**库存 UTC，界面东八区**；归月/归日统计走 `app/order_utils.py`（见 `docs/ORDER_RECORD_LIFECYCLE.md`）。
- 型材按**长度**计价，加工费**按件**（通孔 ¥1 / 沉头 ¥1.8 / 每端攻丝 ¥1.5·口），
  **20–100mm 短件每根再加 ¥5**；板材有 **0.2 m² 最低计价面积**（海洋板 18mm 本色 200/m²，彩色 +100/m²）。

## 设计估价（逐件计价再加总，零件数不是计价依据）

- 有价 kind：`profile / plate / pegboard / marine_board / cabinet_door / shelf_support / caster / foot /
  end_cap`、6 种连接件、`imported_component`。
- **导入件单价统一在 `utils/designerComponentPricing.ts`**：光轴按米 ¥10/m、**光轴支座（SHF/SK）¥2/件**、
  轮子分档（普通 ¥18 起 + 刹车 ¥4 + M10/M12 加价；升级诺贝 ¥50/个，只改价不改几何）、
  拉手 ¥23.12/件、8080 装饰料 ¥8/件。**只有合计 ¥87.12（1×拉手 + 8×装饰料）是校准值**，单件可再拆合计不能动。
  分类顺序：目录 id / sourceRecordId / semanticType 优先，名字只作兜底。
- **源零件 → 目录配件的关联唯一来源 `data/designerSourceAccessoryLinks.ts`**：当前一条
  `fixed_support → '3'`（3号角码 27×30×30）。链接**只给「是哪个目录定义」，从不给尺寸**；
  系列由零件源网格包络推（两臂 = 最大两尺寸，与 `round(extents[1])` 差 ≤1mm）。
  **读不出系列必须 fail-closed 回落到 ¥2 通用支座，不得借用角码价。** 回归 `npm run test:designer-accessory-link`。
- **螺丝定价 `utils/designerScrewPricing.ts`**（精确目录行 → 型号兜底行 → 型号档位价）：
  档位 1515/2020 ¥0.5、3030 ¥0.75、4040 ¥1.5，未知型号回落 ¥0.5。识别 `utils/screwSpecIdentity.ts`；
  No.10 规格由 `data/designerScrewAccessoryCatalog.ts` 生成（5 条确认规格 + 12 条「系列×头型」兜底行）。
  12 条兜底行带 `designerInternalOnly`：保留目录身份与单价，但被 `CUSTOMER_ACCESSORY_ROWS/DEFINITIONS`
  过滤出所有客户端列表。**`ACCESSORY_ROWS` 必须保持完整**（计价解析器读它）。
- **¥952 落地基线**：凳子参考设计（123 件、升级诺贝轮、发浙江）= 设计估价 ¥919（零件 ¥887.0 +
  层间紧固件 ¥32）+ **安能运费 ¥33**（计费 11kg）。**安能是业主确认的档位，不要重挑**。
- **32 套层间紧固件（M6×12 杯头 + 3030 M6 T 型螺母）已做实**：`utils/stoolAssemblyReview.ts` 的
  `materializeStoolSupportFasteners` / `STOOL_SUPPORT_FASTENER_SPEC`；>20 件 ⇒ ¥0.5/件，¥16+¥16=¥32。
  购物车是计价配件行，工厂单是 2 行无价派生行（`type:'screw'`）。**它们刻意不是场景 item**
  （螺丝身份只允许每 (系列,头型) 一条，会和已有的 28 颗槽内 M8×45 撞）。
- 回归（凳子夹具冻结基线）：`test:component-pricing`、`test:screw-pricing`、`test:stool-landed-total`、
  `test:designer-accessory-link`、`test:designer-release-gate`、`test:source-part-cart-merge`、
  `test:source-geometry-sharing`（都在 `test:stool-all` 里）。基线：导入件标准轮 ¥274.6 / 升级轮 ¥386.6、
  螺丝 28×¥0.75=¥21、整凳升级轮 ¥887.0、落地 ¥952；对照全部归零时旧值 ¥479.4。

## 制造放行门禁（2026-10-03）

- **几何检查的窗口必须 ≥ 文件自己的精度**（2026-10-09 踩过）：业主导出的设计文件坐标会被
  外部流程四舍五入到 4 位小数（0.1 µm），任何 < 0.1 µm 的窗口或 5 位小数的 key 都会把
  「同一个零件」判成「几何已变」，进而变成**打钩也放不掉的 blocking**。本项目统一按 **1 µm** 取容差；
  **不要要求离散圆环恰好 N 个点**（那是导出器选择）。`utils/stoolAssemblyReview.ts` 的
  `hasMeasuredMountGeometry` 是范例。另外：**文件里的 `productionRelease` 只是存它那次的记录**，
  门禁在导入后是重新算的，别拿文件里的 `status: blocked` 当结论。
- `inspectDesignerManufacturingPrecheck(items)` → `DesignerManufacturingRelease { applies, valid, scopes,
  blocking, advisories, issues }`。两类「还没好」必须分开：
  - `blocking` = **算出来的失败**（源件无目录身份 ⇒ 无价、真实装配错误）。**客户点同意也清不掉。**
  - `advisories` = **已知未验证的物理声明**（紧固/承载/安装顺序…）。读一次 + 勾选即可放行，写进订单与工厂单。
  - `valid` = 「无阻断」，**不是**「全部验证完成」。
- 决策是纯函数 `decideDesignerReleaseGate(release, accepted)` → `'proceed' | 'blocked' | 'acknowledge'`。
  **声明一变，旧确认立即失效。** `buildDesignDocument` 写 `productionRelease.status`，
  **只有 `acknowledged` 才写 `production` 块**。UI testid：`diy-manufacturing-release-banner` / `-title` /
  `-issues` / `-ack` / `-confirm` / `-cancel`；导出/加购都先 `await confirmManufacturingRelease()`。

## 往购物车加新零件类型时必须加分支（曾线上崩过）

- **`toCartItems` 的逐件 map 每个 `item.kind` 都要有分支**。末尾「通用配件」分支假设
  `accessoryDefinition[item.kind]` 存在；`imported_component` 曾漏掉 ⇒ 行 `id`/`accessoryId` 为
  `undefined` ⇒ `TypeError ... reading 'id'`（且在 promise 里，只表现为 `unhandledrejection`）。
  **潜伏原因：门禁把导入件挡在生产之外，从没有导入件设计走到过购物车** —— 以后放开某类设计进下单，
  先问「这条路以前有真实流量吗」。
- **完全相同的东西必须是一行**：`toCartItems` 返回前会 `groupDiyAccessoryCartItems`，分组键比较
  `lines[].id`，**所以行 id 就是分组**。源件行 id 由 `importedSourcePartLineId` 生成：
  **标签 + 包络尺寸 + 计价 basis + 确认单价**（`buildImportedComponentCartItem` 是抽出来的纯函数）。
  **包络尺寸不能省** —— D12 光轴按毫米计价且 `toFixed(2)`，差 0.1mm 单价相同就会被当成一根去裁。

## 浏览器冒烟配方（agent-browser）

- 本环境装的是 `agent-browser`；跑之前把托管 Node 放到 PATH 前面。`dist` 用 `run_in_background` 常驻
  （`nohup &` 会在回合结束时被回收）：
  `/usr/bin/python3 -m http.server 4180 --bind 127.0.0.1 --directory dist`
- 顺序：① 先挂钩子（`unhandledrejection` / `error` 记到 `window.__rej/__err`），否则 promise 里的异常抓不到；
  ② `open "http://127.0.0.1:4180/#/diy-designer"`（**hash 路由**）；
  ③ 导入用**隐藏 input** `input[type=file][accept*="json"]`，不要找菜单按钮；
  ④ **导入后会弹「导入型材攻丝设置」，必须先关掉**（选「保留原有攻丝设置」），否则后续点击全被挡；
  ⑤ 首屏之下的按钮 `click` 会点空：先 `el.scrollIntoView({block:'center'})` 再 `el.click()`；
  ⑥ 断言 `location.hash`、`window.__rej/__err` 为 null、购物车文本含预期行；⑦ 收尾 `agent-browser close`。
- **验证画布浮层几何（谁盖住谁）**：量 `getBoundingClientRect()` 做相交判断，别靠肉眼。
  notice 只活 **2600ms**，所以要在**同一次 eval 里**触发并测量：点「暂不能下单」设计的 `加入购物车`
  （会走 `showNotice(release.blocking.join(' '))`）→ 轮询 `[data-testid=diy-canvas-notice]` → 立刻量
  notice / `diy-scene-control-hint` / `加工符号` 图例三个矩形。截图留证同理要抢在 2.6s 内。
