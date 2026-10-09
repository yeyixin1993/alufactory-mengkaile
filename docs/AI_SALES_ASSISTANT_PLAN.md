# AI sales assistant — phased delivery plan

Date: 2026-10-03. Branch: `codex/ai-sales-assistant`.
Status: phase-one text consultation, metering, admin controls and recharge paths implemented locally; disabled by default pending provider setup and live acceptance. Images/designer generation and purchase-order checkout remain later phases.

## Requested outcome

A chat bar at the top of the website accepts natural-language requirements and images, asks for missing information, quotes current products, hands editable models to the designer, generates PDFs, and leads to payment with backend records. Confirmed: VIP has a one-time RMB 10 AI allowance and VIP+ a one-time RMB 100 allowance, with no periodic reset. Anonymous visitors and standard registered users each have a three-message trial; this means user messages, including replies to clarification questions, not three complete conversations. The frontend must explicitly explain this and display remaining messages or money. Text-first delivery is approved.

The backend administration must support enabling/disabling AI access and adjusting customer allowances at any time, with an audit trail of operator, reason, delta and balance. Provide a customer recharge entry point. Confirmed: Alipay verified asynchronous notifications automatically credit the full paid amount; WeChat uses the existing receipt QR and administrator-verified manual credit. Customer-visible recharge RMB 100 means RMB 100 allowance. Usage debits provider metered cost × 1.10; the customer UI does not separately display the markup, per owner instruction. Administrators can adjust the markup. Provider account setup is pending; the owner currently has neither account configured.

## Verified starting points

- React/Vite storefront and Flask/SQLAlchemy backend.
- Membership already supports standard, vip and vip_plus. Password registration in `alufactory-backend/app/routes/auth.py` remains VIP, explicitly confirmed by the owner. Existing standard users retain the three-message trial. The membership rules themselves were not changed.
- `components/QuickQuote.tsx` and existing catalog/pricing utilities contain commerce rules to reconcile and reuse.
- `alufactory-backend/app/routes/orders.py` currently accepts submitted totals and line prices. An authoritative server quote is required before AI-generated purchases can be released.
- Existing designer, cart, factory PDF, order PDF storage and Alipay routes are integration points, not proof of deployed payment readiness.
- Experimental Qwen MayCAD import exists in `alufactory-backend/app/routes/ai_import.py`, gated by `ENABLE_MAYCAD_AI_IMPORT`. It is not a general chat or metered AI service. Project knowledge intentionally keeps customer PDF/image reconstruction disabled pending readiness and review.
- Existing editable schema-v2 AI handoff distinguishes assembled geometry from BOM staging. Preserve machining semantics, integer manufacturing dimensions, import add/replace decisions, and production-release blocks.

## Delivery stages and acceptance

1. **Text consultation and quote:** top-of-page chat; backend provider adapter; persisted sessions; structured requirement extraction; catalog validation; missing-field questions; server-calculated quote. Example `2020 pink 1000mm 两端攻丝` retains those facts and asks quantity and destination province, plus any machining/color ambiguity. Automatically select the sole catalog cut-section finish; ask about finish only when multiple choices exist. No fabricated price or silent quantity default. Quote parity tests cover membership, machining, freight and unsupported selections.
2. **Usage and rollout:** server-owned identity and allowance ledger, atomic cost reservation before upstream requests, actual usage settlement, idempotency, timeout reconciliation and bounded output/context. Anonymous allowance lives server-side with a signed visitor cookie and abuse controls; browser identity cannot guarantee three uses per physical person. Test concurrent requests, depleted balances, failed calls, retries and membership changes. Ship this with stage 1 before public availability.
3. **Images and designer:** image understanding produces proposed specs and explicit unknowns. Ask dimensions, quantity, material and intended use; a photograph does not establish hidden connections or load capacity. Generate known parametric templates first; use BOM staging where assembly coordinates are unknown. Validate schema/catalog/geometry and require review for uncertain manufacturing. Existing blocked designs remain blocked.
4. **PDF and checkout:** one versioned confirmed specification drives quote, designer, PDF and order snapshot. Reprice changed/expired quotes before checkout. Customer confirms goods and address before order/payment. Verify payment callbacks, amount and order identity; make callbacks idempotent. Store conversation/design/quote/PDF/order references and manufacturing details for administration.
5. **Production readiness:** real-provider evaluation against representative Chinese/mixed-language orders, pricing parity and adversarial inputs; end-to-end payment sandbox checks; deployment configuration, usage dashboard and operational limits. Run relevant backend tests and `npm run build` for frontend changes; local designer stays on port 3000.

## Provider choice

Keep credentials exclusively on the backend; provider/model/rate table must be configurable. Select the cheapest model that passes extraction and tool-use evaluations, rather than choosing by brand. No API key was requested or accessed during discovery.

Official prices checked 2026-10-03, RMB per million tokens:

- Qwen3.7 Flash, Beijing, input up to 32K: input 0.2 / output 0.8.
- DeepSeek Flash: uncached input 1 off-peak / 2 peak; output 4 off-peak / 8 peak. Cache-hit input 0.02 / 0.04. Its current pricing page lists image understanding support.

At 3,000 uncached input and 500 output tokens, these rates imply approximately RMB 0.001 for Qwen versus RMB 0.005/0.010 for DeepSeek. This excludes additional turns/tool calls, image tokens and extra reasoning; it is not a quota-to-message guarantee. Qwen is the initial short-text cost candidate; validate quality and actual account availability first. Recheck prices before enabling billing.

Sources: [Qwen pricing](https://help.aliyun.com/zh/model-studio/model-pricing), [DeepSeek pricing](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/).

## Implemented defaults and next acceptance

- VIP receives RMB 10 once. Upgrading to VIP+ brings cumulative grants to RMB 100 (adds RMB 90 if RMB 10 was granted); downgrading/re-upgrading never repeats a grant.
- Not signed in means guest, signed in means account: two separate allowances with nothing copied between them, so neither signing in nor signing out changes what the browser still has (see the 2026-10-09 section below); new VIP registrations receive the VIP allowance. Resetting a conversation does not reset allowance.
- Money uses integer hundred-millionths of RMB; provider usage and markup are stored separately in the admin ledger. Malformed/failed responses do not debit customers. A locked per-account request prevents parallel overspend; uncertain/crashed requests have an admin reconciliation path, with uncertain provider costs absorbed by the merchant.
- The first provider is pinned Qwen3.7 Flash Beijing with <=32K input and 800 output token limits. Cache usage receives its applicable input discount. The credential is server-only. Provider discounts/free credits are not inferable from API token usage; the metered tariff must be reconciled with the merchant account before launch.
- Generated `app/ai_catalog.json` comes from frontend catalog constants on `npm run build`. Deploy this file with the backend. The deterministic single-profile estimate follows QuickQuote material, end-tapping, short-piece surcharge, membership and courier rules. It is not a payable order; unsupported/multi-port machining is referred to the existing editors.
- Default text UI is Chinese; no live provider or real money payment has been exercised. Alipay callback tests use a stubbed signature verifier, plus negative signature/amount/merchant tests.
- Guest limits are per signed browser identity with an IP issuance cap, not a guaranteed physical-person identity. Production proxy IP handling, data retention and registration abuse need deployment review; registration remains VIP by explicit owner choice.
- Before image/checkout stages: supported product families/templates, review of uncertain designs, quotation versus production PDF, conversation/image retention, and authoritative product-order repricing remain to be completed.

Setup and rollout instructions: `docs/AI_ASSISTANT_SETUP.md`. Existing manufacturing acceptance rules remain in force.


## AI 问答规则库（2026-10-03）

后台入口为「AI 问答规则库」（`/admin/ai-faq.html`）。初始整理 35 条问答：28 条启用，7 条交期、售后、发票、海外配送、公差、代组装和充值退款政策草稿停用，需商家补充正式答案后启用。完整清单见 [AI_FAQ_STARTER.md](AI_FAQ_STARTER.md)。

管理员可新增和编辑标准问题、相似问法、答案、分类、内部备注和依据，随时启用/停用、搜索、测试匹配和导出 JSON 备份。保存后下条消息立即生效；版本冲突要求重新加载，修改记录留在后台流水。数据库中的规则为日常维护来源；启动仅补入缺失的初始规则，不覆盖人工修改。

聊天优先匹配整句标准问题或相似问法，统一大小写、空白和句末标点；保留内部标点、数字和否定内容，不做宽泛关键词匹配。只有唯一的已启用规则可直接回复。命中不调用外部 API，不扣人民币额度；游客及普通用户仍消耗一条试用消息。没有密钥时已收录问答仍可用，未命中则提示智能服务尚未配置，不扣次数。全局开关和账号停用仍生效。后台匹配测试不扣次数或额度。

本期规则用于常见问题回答，不代替实时商品报价、设计器建模、PDF 导出或付款结果确认；具体规格需求继续由现有报价流程处理。

### 店主政策补充（2026-10-03）

问答库现为 32 条启用、3 条未启用。公差在 1mm 以内，尺寸精确到毫米（不改写成 ±1mm，不更改设计器的几何精度或吸附容差）；3–5 个工作日发货，起算点尚未指定；普票免费，专票加收 10%，本轮未改动订单金额计算；定制产品和定制颜色不支持退换，质量问题或订单不符转人工核实。

充值可退、余额可提现已记录，但可提现范围（实充/赠送）待确认，暂不启用自动答复，也未实现自动退款提现。海外可经境内转运仓发货已记录，国内段运费承担范围待确认，暂不启用自动答复。组装服务仍待补充。

启动时仅升级与历史原稿完全一致、版本 1 且更新人为 seed 的政策占位条目；后台人工修改过的条目不覆盖。旧草稿留在 ai_faq_legacy_drafts.json，用于安全升级与禁止直接发布占位答案。

### 退款与转运范围确认（2026-10-03，替代上述待确认事项）

仅未使用的实际充值余额可退款、提现；赠送额度不可退、不可提现。当前仅提供政策答复和人工办理指引，自动退款/提现尚未实现；人工办理须核对实充、使用和已退款记录，不能使用包含赠送额度的总余额作为可退金额。

海外订单可发往境内转运仓。商家负责国内段发货，不代表包邮；国内段运费按转运仓所在省份、商品规格数量和现有运费模板报价，不改变运费计算逻辑。

这两条问答已启用，现为 34 条启用、1 条组装服务草稿。启动升级兼容未编辑的原始及上次待确认草稿，仍不覆盖后台人工编辑。

## Homepage entry design (2026-10-04)

AI consultation is the primary homepage entry: centered headline, large multiline request field, suggested questions that fill without sending, and direct links to quick quote, designer and catalog. Other routes retain a compact entry. Mobile is the primary target: wrapping layouts, 16px input to avoid iOS focus zoom, 44px touch targets and 48px send control. Enter sends (except IME composition); Shift+Enter inserts a line break. Existing quota, recharge and history behavior is retained. Visual verification at 320px and 375px found no page horizontal overflow; real-device software-keyboard testing remains outstanding. The isolated static preview does not connect to the AI backend.

### 组装服务确认（2026-10-04）

店主确认：不含组装服务。对应问答已启用，35 条初始问答现全部启用，替代此前组装服务待确认状态。不将此政策扩大为不销售成品或不提供其他安装服务。

## DeepSeek adapter (2026-10-04)

Implemented explicit backend `AI_PROVIDER=deepseek` with `DEEPSEEK_API_KEY`, official Flash JSON/non-thinking API, time-period/cached-token metering and provider-specific reserve. Qwen remains the default for compatibility. See AI_ASSISTANT_SETUP.md for deployment, billing assumptions and live acceptance. Requests with uncertain billing are not charged to customers. Real-key integration has not been exercised. No image, designer-generation or checkout capability was added by this adapter.

### 游客与账号是两套独立额度（2026-10-09，店主确认）

店主口径：**没登录就是游客，登录了就看账号自己的 status**，两套额度互不掺和，越简单越好。游客的三条免费按**设备**算 —— 一台浏览器三条，用完即止；同一网络下的其他设备互不影响。

实现（`app/routes/ai_chat.py` 的 `identity()`）：

- 游客身份 = 浏览器里的签名 token（`g:<uuid>`，`ai-visitor-v1` salt），存在 `localStorage['mengkaile-ai-visitor']`。额度记在 `ai_accounts.trial_used / trial_limit`，不随新会话、不随时间重置。
- **不合并**：带游客 token 登录时，不把设备的已用次数并入账号，也不给设备行盖任何标记（`claimed_by` 字段已从 `app/ai_models.py` 删除）。登录后完全看账号自己的额度。
- **已取消**：旧行为会以 `reason: 'trial_claimed'` 返回 400「试用次数已转入注册账号，请登录使用。」——它会让「用过三条 + 登录过一次」的浏览器永久只能登录，是 2026-10-09 店主报障的根因。前端也删掉了对应的锁态与文案。
- **已知代价（店主 2026-10-09 明确接受）**：同一台设备「游客用完三条 → 注册/登录」可以再得到账号自己的三条。这是两套额度互不掺和的直接结果，换来的是「没登录就是游客」这一点不会被历史登录搅浑。
- 防刷闸门不变：每个出口 IP 每天最多**新建 10 个**游客身份（`ai_rate_windows` 的 `guest:<ip>:<utc-day>`），即单 IP 每天上限 30 条。清除 `localStorage` 能换回三条，但受这个闸门约束；上限与改动前相同，未新增成本敞口。
- 界面：始终显示 `剩余 3/3 → 0/3`；`0/3` 时提交键禁用并在旁边给「登录」入口与一行提示。已登录账号不显示登录引导（走账户充余额），避免让登录用户「再登录一次」。
- 本地与线上同规则（2026-10-09 店主确认）：删除 `AI_LOCAL_UNLIMITED` 开关（`local_unlimited()`、`/status` 的 `local_unlimited` 字段、「本地测试 · 不限额度」文案）。`run_deepseek_local.py` 只剩隔离数据库与拦截真实支付两点差异，额度/扣费与生产完全一致。
