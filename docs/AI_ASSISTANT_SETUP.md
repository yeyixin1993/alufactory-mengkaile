# AI assistant setup and acceptance

The branch implements Chinese text consultation, single-profile estimates, one-time allowances, administrator controls, and AI-credit recharge. It does not enable image interpretation, generated designer scenes or AI-created product orders. Do not enable publicly until real-provider extraction and payment sandbox acceptance are complete.

## 1. Provider selection: DeepSeek first

DeepSeek support is implemented. Existing installations still default to Qwen to avoid an accidental provider switch. Explicitly select DeepSeek in the **backend service environment**, not the browser or a `VITE_` variable:

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=<set privately in your backend hosting secret store>
```

The model is `deepseek-flash`; the fixed official endpoint is `https://api.deepseek.com/chat/completions`. No tracking ID, key name, custom URL or GPU deployment is required. Restart the backend after setting these values. The admin AI quota page displays the selected model and configuration status. “Configured” checks that settings exist, not that the credential has been validated by DeepSeek. Keep the global AI switch off until a controlled test account is ready, then enable for supervised acceptance.

1. Save the two environment settings on the host running Flask; do not paste the key into chat, Git, client code or screenshots.
2. Deploy backend code including `app/ai_provider.py`, existing AI modules and the generated catalog, install existing backend requirements, then restart using the host's existing service manager.
3. Confirm `/api/ai/admin` reports `provider=deepseek`, `model=deepseek-flash`, `configured=true` (requires administrator login).
4. In a controlled environment, enable AI and test `2020 pink 1000mm 两端攻丝`, then supply quantity and destination province. Verify deterministic quote and continuation, with only multiple finish options triggering a question.
5. Compare DeepSeek's usage/billing with the admin ledger; confirm cached input and output counts, time-period rate and 10% markup. Test a FAQ hit (no model spend), invalid key/timeout (no customer debit), and duplicate request retry (one debit).
6. Deploy frontend/backend together after acceptance. The static port 5002 preview has no API backend; it cannot test real conversations.

No live request has been made by this change. Use ordinary paid API service; provider promotional credits or custom discounts are not inferable from returned token counts. Customer charges use published metered tariffs, so reconcile any account-specific discount before claiming invoice-exact cost.

### DeepSeek tariff and safeguards

Tariff snapshot: 2026-10-04. RMB per million tokens: peak uncached input 2, cached input 0.04, output 8; off-peak 1, 0.02, 4. The API uses JSON output with `thinking.type=disabled`, max 4096 output tokens, and at most 32K reported input tokens. Text length is additionally bounded before sending.

Peak periods are Beijing weekdays 09:00–12:00 and 14:00–18:00, excluding holidays; weekends are off-peak including make-up working weekends. The bundled 2026 calendar uses the published State Council holiday ranges. Verify the provider's interpretation of holiday/adjusted days against the account bill at live acceptance. Calendar years beyond 2026 require review; unknown year, contradictory usage, truncated response or a request within the 60-second price-boundary tolerance is marked for reconciliation without customer debit. Uncertain provider costs are absorbed by the merchant under the existing recovery policy.

Before calling, balance must cover the maximum bounded request at peak tariff (¥0.096768 before markup, approximately ¥0.1064448 at 10%). This is a sufficiency check, not the actual debit; completed valid responses are billed by usage. FAQ hits bypass that monetary check. No automatic cross-provider retry occurs, preventing duplicate provider spend.

Sources: [DeepSeek API schema](https://api-docs.deepseek.com/api/create-chat-completion/), [DeepSeek prices](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/), [2026 holiday calendar](https://www.beijing.gov.cn/fuwu/bmfw/sy/jrts/202511/t20251104_4258838.html).

### Qwen alternative

Set `AI_PROVIDER=qwen` (or leave it unset for backward compatibility), with the Qwen settings below. Keys are never used across providers.


Use [Alibaba Cloud Model Studio](https://bailian.console.aliyun.com/), complete account registration/identity checks shown by the service, and activate ordinary pay-as-you-go model API service in **China North 2 (Beijing)**. Create an API Key and record the workspace ID and the OpenAI-compatible Base URL shown by the console. A consumer chat subscription or personal coding subscription is not the website backend API setup.

Official instructions: [first API call](https://help.aliyun.com/zh/model-studio/first-api-call-to-qwen), [API keys](https://help.aliyun.com/zh/model-studio/get-api-key/).

Do not paste the key into chat, a frontend `VITE_` variable or a committed file. Configure the backend process environment through the hosting control panel/secret store:

```dotenv
DASHSCOPE_API_KEY=<your private key>
AI_QWEN_BASE_URL=https://<workspace-id>.cn-beijing.maas.aliyuncs.com/compatible-mode/v1
# Optional override only after checking this account's implicit-cache tariff:
AI_QWEN_CACHED_INPUT_CNY_PER_MILLION=0.04
```

Use the exact console-provided Beijing endpoint; do not reuse another region's key or endpoint. Backend pins `qwen3.7-flash-2026-07-15`, input tariff RMB 0.2 / million, output RMB 0.8 / million, implicit cached input RMB 0.04 / million; input remains within 32K. Tariffs checked 2026-10-03: [prices](https://help.aliyun.com/zh/model-studio/model-pricing), [cache](https://help.aliyun.com/zh/model-studio/context-cache). Promotional credit and invoice discounts are not returned in token usage; verify the account's payable rate before launch. Changing model/region requires updating and testing its rate calculation, not merely changing an environment variable.

Provider cost is token usage × applicable tariff. Customer debit defaults to 110% of that cost; the admin page can change the percentage. Frontend only shows balance and charged amounts. Configure a strong production SECRET_KEY/JWT_SECRET_KEY as for the existing app. The signed guest identity uses SECRET_KEY.

## 2. Build and deploy together

`npm run build` now regenerates `alufactory-backend/app/ai_catalog.json` from existing storefront constants. Include that generated file with the Python deployment. Flask creates the new `ai_*` tables through the existing `db.create_all()` startup. No existing user or order columns are migrated.

The existing isolated `npm run dev:local` uses SQLite and intentionally removes both `DASHSCOPE_API_KEY` and `DEEPSEEK_API_KEY`; it is suitable for UI checks without real provider spend. Frontend stays on port 3000; backend uses 5001. Pass `VITE_API_URL=http://127.0.0.1:5001/api` when starting it. Provider integration should be tested in a separately configured backend process with the real environment, not by weakening that isolated runner.

## 3. Configure administration and recharge

Open **后台 → AI 额度与充值管理** (`/admin/ai.html`). Global AI access starts disabled. Search a customer by phone to view balance, gift total, consumed trial messages and the last 50 ledger records. Add or subtract allowance with a reason; adjustments require an idle account and cannot make its balance negative. Keep the operation ID on retry to avoid duplicate manual credit. Pending requests older than five minutes can be closed after inspecting the provider record; this recovery does not debit a customer for an uncertain response.

- **Alipay:** reuse existing merchant credentials and `public_site_base` (HTTPS). The AI recharge callback is `/api/ai/recharge/alipay/notify`, independent of existing product-order callbacks. Allow this URL through the proxy. The callback verifies the signature, app ID, exact stored amount, trade status and transaction identity before crediting once. Configure seller ID too if supported by merchant settings. Browser return never credits allowance. Customer denominations are RMB 10, 30, 100; full paid value becomes credit. Payment gateway fees are absorbed through the usage markup.
- **WeChat:** uses existing `wechat_qr_image_url` (fallback `/images/wechatpay-qr.png`) and `wechat_contact`. Customer logs in, scans, and supplies account phone/payment evidence. After checking actual receipt, administrator adds the amount and records the transaction number as the reason. Never manually duplicate an already credited Alipay payment.

No refund automation is implemented yet. Reconcile any refund and corresponding unused AI credit through the administrator ledger before returning money.

## 4. Acceptance before enabling

1. Configure the provider and send `2020 pink 1000mm 两端攻丝`. Expect missing quantity/province and automatic selection of the catalog's sole supported cut-section finish (ask only when multiple finishes are available). Follow-up answers retain existing fields.
2. Compare complete quotes against QuickQuote for membership, color, short lengths, quantity and destination. Unsupported machining/assemblies must not receive a fabricated simple-profile quote.
3. Confirm guest/standard messages decrement once, VIP initial allowance is RMB 10, VIP+ cumulative grant RMB 100, and user switches do not expose another account's history.
4. Compare returned provider token usage/cache details with the admin ledger. Verify 10% markup and precision without per-message one-fen rounding. Exercise provider failure, invalid structured output and retry.
5. Use Alipay sandbox first: wrong signature/app/amount fails; repeated success credits once; browser return alone credits nothing. Then verify deployment callback reachability with an owner-controlled low-value live test.
6. Confirm WeChat image is the intended merchant receipt code; verify manual credit and customer refresh.
7. Only then enable global AI access. Set proxy-aware per-IP throttling at deployment; the app deliberately does not trust arbitrary forwarded-IP headers. Guest browser-token controls cannot identify a unique real person, and new registrations currently receive VIP benefits by owner request.

Tests: `cd alufactory-backend && .venv-local/bin/python -m unittest discover -s tests`. Frontend validation: `npm run build`. Provider/payment tests are mocked; they do not establish live account or merchant readiness.


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

### 组装服务确认（2026-10-04）

店主确认：不含组装服务。对应问答已启用，35 条初始问答现全部启用，替代此前组装服务待确认状态。不将此政策扩大为不销售成品或不提供其他安装服务。

## Conversation history

`ai_conversations` stores account-scoped chat titles and archived model context; `ai_conversation_messages` associates existing requests with conversations and preserves new image attachments. Startup `db.create_all()` creates these additive tables. Back up the database before production rollout. Existing requests are recovered into one conversation because older data has no session boundaries; old image hashes cannot reconstruct original attachments. New-chat and conversation switching preserve the account-wide balance and trial usage. Signed visitor tokens must be retained by the browser; registered accounts use their authenticated identity across devices. No extra model calls are used for chat titles.

## Multiple attachments

The chat composer supports up to 8 JPG/PNG/WebP or PDF/DOCX/XLSX/CSV/TXT attachments per message. Images are limited to 4MB each, documents 10MB each, total 20MB. PDFs are rendered by the pinned pypdfium2 dependency; combined PDF pages and image count is limited to 8. Extracted document text is limited to 12,000 characters, rejecting oversized content rather than silently truncating. Office files containing images/charts require PDF export or separate images. Original documents and sanitized images persist in the conversation message JSON. Install backend requirements on deployment and allow at least 30MB JSON request bodies in Nginx (base64 overhead); Flask's existing limit is 50MB. Attachment contents are untrusted requirement data, never executable instructions.
