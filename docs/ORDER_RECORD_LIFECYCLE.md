# 地址与订单记录生命周期

最后核对：2026-08-08

## 删除规则

- 客户可以删除自己账号中的收货地址；删除前必须确认。
- 客户可以删除自己的 `pending`（待处理）和 `cancelled`（已取消）订单；删除前必须确认。
- 管理员同样只能删除 `pending` 和 `cancelled` 订单。
- `confirmed`（已付款）、`shipped`（已发货）和 `delivered`（已送达）订单不可删除。该限制由后端强制执行，不能只依赖前端隐藏按钮。
- 删除订单时同步清理分类订单数据库中的对应快照；已经保存的 PDF 文件继续保留，避免意外丢失生产凭证。

## 订单 JSON 与重复提醒

- 每张订单保存一份规范化 `order_json`，包含客户、地址、运费、金额、备注和排序后的完整商品配置。
- 订单号、创建时间、状态等会自然变化的字段不进入重复比较内容。
- 后端对规范 JSON 计算 SHA-256 `duplicate_fingerprint`。
- 同一用户的两张及以上订单具有相同指纹时，管理后台显示“相同JSON”警告；不同用户的相同商品不会互相标为重复。
- 管理员可以在总订单管理中点击“查看JSON”核对具体内容和同组订单号。
- 历史订单在应用启动时自动补建 JSON 和指纹，新订单和待处理订单编辑后即时刷新。

对应实现：

- `alufactory-backend/app/order_snapshot.py`
- `alufactory-backend/app/routes/orders.py`
- `alufactory-backend/app/routes/admin.py`
- `alufactory-backend/admin/index.html`
- `App.tsx`
