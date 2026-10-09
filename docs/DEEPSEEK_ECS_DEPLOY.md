# DeepSeek 上线到现有阿里云 ECS

以下路径中的 `<项目目录>`、`<虚拟环境>`、`<后端服务名>` 使用服务器现有值，不是可以直接粘贴执行的名称。无需 GPU，无需上传模型。本文按当前仓库实现说明；DeepSeek 模型及计费配置在 app/ai_provider.py，正式开放前用生产测试账号核对真实返回及账单。

## GitHub 之外需要准备什么

1. **后端私有密钥文件**：`<项目目录>/alufactory-backend/.env.deepseek.production`。在 ECS 上编辑，切勿提交 Git、放入 dist/public 或使用 VITE_DEEPSEEK_API_KEY。新提供 `.env.production.example` 仅含占位示例。
2. **现有生产数据库及其备份**：不要用本地测试 SQLite 数据库覆盖。聊天、额度、充值和历史附件均存数据库；无需另外上传聊天记录文件。后端启动的 `db.create_all()` 会创建缺失的 AI 表，不会迁移已有字段类型；此版新增表，不要求手工复制本地数据。
3. **现有支付凭据、收款二维码及用户上传目录**：沿用服务器原文件，不要被发布目录覆盖。DeepSeek key 不替代支付宝密钥。
4. **前端 dist**：若服务器只同步源码，需构建或上传完整构建产物；包括字体文件及 `fonts/licenses`。不要只上传 index.html。
5. Python 虚拟环境安装 requirements.txt（新增 pypdfium2）；不要复制 Mac 的 .venv-local 或 node_modules 到 Linux。

## 密钥具体放哪里

保留现有数据库、签名密钥和支付配置。在后端新建 `.env.deepseek.production`，只写入：

```dotenv
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=在ECS上填入真实密钥
```

无需 tracking ID 或密钥名称。文件只允许后端服务用户读取，例如文件归服务用户所有后设置 `chmod 600 .env.deepseek.production`。不要把内容贴到日志、聊天或截图。保持现有 SECRET_KEY/JWT_SECRET_KEY，否则游客身份或登录可能失效。

新增 `wsgi.py` 会先读取同目录 `.env.deepseek.production`，再读取原有 `.env`，并使用 production 配置。仓库原有 `.env` 已被Git跟踪，不能把真实DeepSeek密钥写进去；新密钥文件已由.gitignore排除。若现有 systemd/Supervisor/容器已注入同名变量，它们优先于环境文件；需在同一处更新，随后重启后端。

## 发布顺序

先备份生产数据库及服务器私有配置。同步本次完整分支后，在项目根目录：

```sh
npm ci
VITE_API_URL=/api npm run build
```

build 会同步生成后端 `app/ai_catalog.json`；前后端须使用同一版本。将完整 dist 发布到 Nginx 现有静态目录。

后端目录中，使用服务器现有 Python 虚拟环境：

```sh
<虚拟环境>/bin/python -m pip install -r requirements.txt
```

后端服务的工作目录指向 alufactory-backend，启动命令示例：

```sh
<虚拟环境>/bin/gunicorn --workers 2 --timeout 120 --bind 127.0.0.1:5000 wsgi:app
```

使用现有服务管理器保持后台运行；修改实际服务启动项后重启 `<后端服务名>`。不要运行 `run_deepseek_local.py` 或 `npm run dev:deepseek`：它们是隔离数据库、关闭支付的本地测试启动器（额度规则与线上一致，只是数据隔离）。

## Nginx

保留现有 HTTPS、域名、静态目录和其他接口规则。在现有 server 中合并下面设置，不要另建冲突的 `/api/` location。若现有 Flask 端口不是5000，沿用现有端口：

```nginx
client_max_body_size 32m;
location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
}
```

proxy_pass 此处不加尾部 `/`，保留 `/api/` 路径。附件20MB经过base64编码会变大，所以需32MB入口限制。`sudo nginx -t` 成功后再 `sudo systemctl reload nginx`。无需向公网开放5000端口；ECS后端需能通过HTTPS访问 api.deepseek.com。

## 开通与验收

后台 AI 额度管理页先确认 provider/model/configured 状态，再开启 AI 总开关。仅 configured=true 不代表已验证密钥；必须发一条真实需求验证。

- 用生产测试账号发送文字、两张图片和一份PDF，检查报价及追问。
- 首页发送应新建会话；历史对话可以重新打开继续聊。
- 确认游客按设备共 3 条消息、用完提示登录，新会话不重置次数；已登录账号显示并消耗自己账号的余额。
- 检查VIP/VIP+一次性赠送额度和消耗流水；管理员可手动充值。
- 比较AI与购物车材料金额，确认没有自动添加螺丝。
- 生产环境支付宝原配置保留；AI充值回调 `/api/ai/recharge/alipay/notify` 需公网可达，并以签名验证的支付通知到账，不能靠浏览器跳回。
- 数据库需持续备份，附件也在其中。测试失败先关闭AI总开关；保留数据库，不回滚覆盖客户记录。

本次仅准备代码与部署说明，尚未登录或部署到ECS。
