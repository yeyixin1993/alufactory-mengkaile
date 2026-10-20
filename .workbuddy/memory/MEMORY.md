# 项目长期记忆（mengkaile / alufactory）

## 运行与验证

- Node 用托管版 `/Users/eliye/.workbuddy/binaries/node/versions/22.22.2-6/bin`（加 PATH 前）；升级会删旧目录，跑前 `ls` 确认。
- `agent-browser` 副本在 `/Users/eliye/node_modules/.bin/`，必须 `AGENT_BROWSER_EXECUTABLE_PATH=<系统 Chrome>`（否则 CDP closed；closed → `close --all` 再 open）。native click 对 React 按钮偶发不生效，改 `eval "...el.click()"`（IIFE 包 const）。
- 回归统一 `vite build --ssr scripts/verify-*.ts` + node；多个 `--emptyOutDir` 先 **export** `CODEBUDDY_SAFE_DELETE_BULK_THRESHOLD=5000`（链式命令里前缀赋值只对第一条生效）。凳子全套 `npm run test:stool-all`。verify 脚本不能用 `__dirname`（ESM），用 `path.resolve('.')`。产物 `.verify-*/` 已被一条 gitignore 覆盖；`vite.config.ts` 的 SSR `copyPublicDir: false` **别删**（否则每次回归复制 `public/` 210M 进产物目录，GitHub Desktop 当成几百张新图）。
- `tsc --noEmit` 既有报错 **8 个**（2026-10-12 起，修 3D 预览时消掉 1 个）：`@/config`、App `setTimeout`、AIChatBar `phone`×3、PrintableCatalog `key`×3。
- `.git/index.lock` 会反复出现 **0 字节僵尸锁**（10-11 两次、10-14、10-20 各一次）：**10-20 抓到元凶 = GitHub Desktop 的 `git --no-optional-locks status --untracked-files=all --branch --porcelain=2 -z` 进程卡死**（本仓有 55MB 单行 catalog，从 13:01 卡到 22:38）。排查用 `pgrep -fl git`（**`-f` 才出完整命令行**，`-l` 只有 PID+名字；`ps` 在沙箱里 `operation not permitted`），`lsof .git/index.lock` 返回空即无人持有 → 直接 `rm -f .git/index.lock`。必要时重启 GitHub Desktop。读操作不受影响，只有 add/commit 被挡。
- **`git push` 前必须 `export CODEBUDDY_SAFE_DELETE_BULK_THRESHOLD=5000`**：`pre-push` 的 `package:dist` 里 vite `emptyDir(dist/assets)`（244 个文件）会被沙箱安全删除守卫拦下（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`），表现为 `error: failed to push some refs`。用 `export`，行内前缀传不进子进程钩子。
- **`public/catalog/mengkaile-catalog-2026-jp.html` 是 `prebuild`(`catalog:html`) 的确定性产物，却被 git 跟踪、且是 55MB 单行文件**：一旦它出现在 `git status`，**先查 NUL 再决定**（`python3 -c "print(open(p,'rb').read().count(0))"`）。10-14 曾出现等长 16KB 全 0 空洞（写入中断，`dist/catalog/` 副本同时损坏）——等长的「1+/1-」在单行大文件里看不出内容差异，极易被误提交。恢复 `git checkout --` 后重新 build 即得干净版本。注意**只对文本扩展名查 NUL**，PNG/JPG 本就含 NUL，扫 dist 会大量误报。
- `npm run dev` 曾因 watcher 在 `.venv-local` 符号链接 ELOOP 崩溃；冒烟改 `vite preview --port 4173`（或 `python3 -m http.server 4180 --directory dist`）。3000/5001 可能被业主占用，**别杀**。hash 路由 `#/diy-designer`，首屏外按钮先 `scrollIntoView`。
- 后端测试：`alufactory-backend/.venv-local/bin/python -m pytest tests -q`（基线 105）。**10-20 起这个 venv 已失效**：`bin/python3.11` 指向 homebrew python3.11，但 sys.prefix 仍是 `/private/tmp/mengkaile-ai-quota-venv`（被清理），报 `No module named pytest` —— 要跑后端测试先重建。纯逻辑测试 `python3 scripts/test-ai-sales-advice.py` 自带 `app` stub，**不需要 Flask/DB**，可直接用托管 python3 跑。`curl` 本地必加 `--noproxy '*'`。
- 部署：**手工上传 ZIP 内 dist/**。`core.hooksPath=.githooks` 有一个 **`pre-push`** 会跑 `npm run package:dist`（build + 打 ZIP），所以 **push 会构建但不会部署**；`dist` 本身 gitignore。ZIP 产物固定落在 **`/Users/eliye/Downloads/mengkaile-dist-latest.zip`**（约 159MB）。验 dist 新旧：工作区 clean + dist mtime 晚于最后 commit + grep 特征串（源码改了没 build，线上仍是旧串）。

## AI 聊天（只在 codex/ai-sales-assistant worktree：`/Users/eliye/.codex/worktrees/ai-sales-assistant/alufactory-mengkaile`）

- **后台 admin 页只能走 `http://47.98.229.152/admin/`（纯 HTTP，非安全上下文）**：nginx 主域 `/admin/` 被 SPA 吃掉、`/api/` 才代理 Flask；Flask 把 `alufactory-backend/admin/` 当静态目录（不参与 Vite 构建，改完直接同步文件）。所以 admin 页里**绝不能用 `crypto.randomUUID`**（http 下 undefined，顶层抛错会让整页脚本静默死掉）——已改成 `newId()` 兜底 `getRandomValues`。
- **线上后端（2026-10-11 查实）**：systemd 服务名 `alufactory.service`，目录 `/home/alufactory/alufactory-mengkaile/alufactory-backend`（venv 叫 `venv`，不是 `.venv-local`），重启 `sudo systemctl restart alufactory`；无 supervisor。**实际入口是 `run_prod.py`（不是 `wsgi.py`）**：`venv/bin/python run_prod.py`，里面只有 bare `load_dotenv()` → **只读工作目录 `.env`**，所以密钥写 `.env.deepseek.production`（wsgi.py 的方案）在当前配置下**根本不生效**。两种真修法：① systemd drop-in `EnvironmentFile=` 指向 `.env.deepseek.production`（推荐，密钥不进 git）；② 直接追加到 `.env`（立即生效，但该文件被 git 跟踪）。本地 = `.env.deepseek.local`。光配 key 不够：总开关是 DB `AISettings(id=1).enabled`（默认 false），在 `/admin/ai.html`「全局设置」勾选保存。
- 调试用 `npm run dev:deepseek`（Flask 5001 + Vite 3000；端口被占直接退出）。后端起不来 = 缺 `DEEPSEEK_API_KEY`。
- **游客/账号额度完全独立**：游客 3 条、同 IP 每日 10 个新游客；真发消息扣 DeepSeek 余额，验证用 FAQ 命中问题（免费）。引导词须 FAQ 精确命中；`seed_faq_rules()` 只补缺不更新。停服用 `reason` 码。SQLite 加列用 `db.session.execute(text(...))+commit()`。

## 设计文件合同 mengkaile-diy（docs §13.6）

- v2 = 每件自带完整网格（SketchUp 插件继续产 v2）；v3 = 顶层 `sourceGeometries`（FNV-1a 键）共享重复几何。只真去重才写 v3；导入端先 `expandImportedSourceGeometries` 再预检；**绝不取整/降采样**。

## 产品与计价约定

- 配件目录唯一来源 `data/accessoryCatalog.ts`（客户端用 `CUSTOMER_ACCESSORY_ROWS` 过滤）；本色/彩色两档、20 件批量价；`ACCESSORY_CODE_IMAGE_MAP` 归 catalog，**实物 JPG 绝不被 SVG 覆盖**。
- **设计器（2026-10-10 三改）**：① 连接配件两级选择（一级一条配件、二级展开选型号 2020/3030…，二级 testid `diy-add-<kind>-<series>`）。② 右侧省份下拉预览到手价（`diy-estimate-province`/`-landed`，纯函数 `utils/designerLandedEstimate.ts` 镜像购物车运费，**省份不进设计文件**；回归 `test:designer-shipping-estimate`，凳子发浙江 ¥952）。③ 配件行用配件区实物照片（`utils/designerAccessoryImages.ts` 6 个连接 kind→1/2/5/7L/7T/9.jpg；catalog 的 8/10.jpg 无文件勿扩；回归 `test:designer-library-images`）。产品决策同步 `docs/DIY_DESIGNER_PROJECT_KNOWLEDGE.md`。
- 导入件计价 `utils/designerComponentPricing.ts`；源件→目录配件链接唯一来源 `data/designerSourceAccessoryLinks.ts`（系列由包络推，fail-closed 回 ¥2）。螺丝 `utils/designerScrewPricing.ts`。**¥952 落地基线**由 pricing/screw-pricing/stool-landed-total 冻结（安能 ¥33）。
- 制造门禁：`blocking`（确认清不掉）vs `advisories`（勾一次放行）；`decideDesignerReleaseGate` 纯函数，声明一变确认失效。**几何容差统一 1 µm**；文件里 `productionRelease` 只是历史，导入后重算。
- `toCartItems` 每个 kind 都要分支（漏过会线上崩）；相同件并一行，行 id = 分组键（源件 id 含包络尺寸）。型材按长度计价，加工费按件，20–100mm 短件 +¥5/根；板材 0.2m² 起计。库存 UTC、界面东八区。

## 分支 / 用户

- 用户用 **GitHub Desktop**：切分支自动 `git stash`，工作区 clean ≠ 改动丢了。

## 前端发布链路（定稿，长期有效）

- **服务器侧** `/home/alufactory/deploy-frontend.sh`：一条命令 = git pull → npm run build → 发布 dist 到 `/www/mengkaile-frontend`（冲突旧文件改名 `.bakMMDD`）→ md5 校验。**与后端的 `/home/alufactory/update.sh` 完全独立，互不调用；不要动 update.sh。**
- **Mac 侧**（工作区 `/Users/eliye/WorkBuddy/2026-10-11-00-37-18/`）：`sync-frontend.sh` 一条命令 = 本地构建 → rsync 增量上传到 `/home/alufactory/frontend-staging` → 触发远端发布 → 校验。日常只传 1~3MB（catalog 159M 是确定性产物，不重传）。另有桌面启动器 `~/Desktop/更新前端网站.command` 可双击。
- **铁律：不删除任何文件。** deploy-frontend.sh 里 4 处 `# run rm -f "$f"` 全部处于注释状态（搜「删除已停用」）；sync-frontend.sh 默认不带 `--delete`（`SYNC_DELETE=0`）。用户明确要求「just add」。
- 环境事实：ECS `47.98.229.152`（cn-hangzhou，i-bp1dehcuxg5e60tknwew，Ubuntu 22.04，2vCPU/1.6G内存/无swap，**未装 Node**，磁盘余 29G）；登录 root，专用部署密钥 `~/.ssh/mengkaile_deploy`（已授权到 ECS 的 /root/.ssh/authorized_keys）。
- nginx：站点根 `/www/mengkaile-frontend`（已用探针实测确认生效），80→443 跳转，`/api/` → `127.0.0.1:5000`。`/etc/nginx/conf.d/mengkaile.conf` 里被重复粘贴过（含 4 个同名 server block），靠「同端口先定义者胜」侥幸选对，**待清理**（备份→截断→`mv mengkaile.top.conf mengkaile.top.conf.disabled`→`nginx -t && systemctl reload nginx`）。
- ECS 上**没有 `www` 用户**，现网文件属主是 `root:root`，故脚本 `OWNER` 默认留空（不改属主）。
- 已知待办：www 里 assets 有 **143 个孤儿 bundle / 58MB**、images 有 17 张孤儿图（旧配色），均**保留不删**；`--clean-orphans` / `--prune` 开关已具备，只列不删。
