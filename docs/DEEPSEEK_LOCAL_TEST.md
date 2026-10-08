# 本地 DeepSeek 测试

无需部署 ECS。此模式会实际调用 DeepSeek 并消耗平台余额；网站余额与账号数据仅存本地测试数据库。FAQ 命中不调用 API。

## 本机操作

1. 在本工作区 `alufactory-backend/.env.deepseek.local` 填入：

   ```dotenv
   DEEPSEEK_API_KEY=你的真实密钥
   ```

   保存文件，不要把密钥发到聊天或截图里。该文件被 `*.local` 忽略，不会提交 Git。只需填写密钥，不需要 Tracking ID。

2. 在原本启动 `npm run dev:local` 的终端按 **Ctrl+C**，释放 3000/5001。不要关闭 ECS 服务。
3. 打开终端运行：

   ```bash
   cd /Users/eliye/.codex/worktrees/ai-sales-assistant/alufactory-mengkaile
   npm run dev:deepseek
   ```

4. 打开 **http://127.0.0.1:3000/**。5002 是旧的静态预览，不能测试 API。
5. 在本地注册一个测试账号（默认 VIP，赠送 ¥10 测试额度），先问 `2020 pink 1000mm 两端攻丝`，再补数量、省份；检查追问、报价及收支记录。真实 DeepSeek 费用从你的平台账户扣除，本地赠送额度不是 DeepSeek 赠送余额。
6. 在运行终端按 **Ctrl+C**，同时停止前后端。

没有密钥时后端会拒绝启动；不会显示密钥。启动不自动发送模型请求，仅用户发送未命中 FAQ 的消息才调用模型。

## 隔离方式

- Flask 127.0.0.1:5001；Vite 127.0.0.1:3000，端口占用则退出，不自动换端口或终止已有服务。
- 全部 Flask instance 数据保存在 `alufactory-backend/instance/deepseek-local/`；账号和 AI 数据为 `ai-test.db`，不使用线上数据库或普通本地开发数据库。
- 此模式启动会开启本地 AI 总开关。真实充值/支付路由被拦截；不要通过展示的微信码付款，微信码只是原有界面内容。
- 原 `npm run dev:local` 仍屏蔽 DeepSeek/Qwen 密钥，不变。
- 本机复用已有 `.venv-local` Python 环境；换电脑需先 `npm run setup:local`。也可通过 `LOCAL_PYTHON` 指定已安装项目依赖的 Python。
- 真实 API 联调需用户填入密钥后进行；自动检查使用假密钥和模拟响应，不产生平台费用。

本地专用启动器启用无限测试：游客、普通用户及会员均不受网站次数/余额限制，也不扣网站额度，仍记录实际 API 成本。页面显示“本地测试 · 不限额度”。DeepSeek 账户仍真实计费。该开关仅由绑定 127.0.0.1 的独立启动器设置；生产启动入口默认关闭，原有三条消息、会员余额和扣费规则不变。
