# alufactory-mengkaile
铝型材定制+拼单网站，无沟通直接源头工厂下单

## 本地隔离的全链路开发

本地 Vite 开发不会再调用线上 API。前端固定为
`http://localhost:3000`，Vite 将 `/api` 转发到 `5001` 端口的本地 Flask；
后端使用 `alufactory-backend/instance/` 下被 Git 忽略的 SQLite 数据库。
选择 `5001` 是为了避开 macOS AirPlay 经常占用的 `5000` 端口。

```bash
npm run setup:local   # 仅首次需要：建立本地 Python 环境
npm run dev:local     # 同时启动前端与隔离后端
npm run test:local    # 注册 -> 下单 -> 上传/下载 PDF，并执行前端构建
```

单独预览或下载 PDF 是浏览器内完成的，不依赖后端；提交订单并让后台保存
含价/不含价 PDF 才需要本地后端。本地开发和正式编译都使用相对地址 `/api`：
开发时由 Vite 代理到本机，上传后的生产包则自然连接当前云端域名下的正式后端，
因此不需要在上传前修改 `.env` 或执行额外的构建步骤。

## Project knowledge

- [3D DIY Designer product and engineering knowledge](docs/DIY_DESIGNER_PROJECT_KNOWLEDGE.md)
- [3D DIY Designer implementation overview](DIY_DESIGNER_IMPLEMENTATION.md)
