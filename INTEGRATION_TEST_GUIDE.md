# 新功能集成测试指南

## 快速开始

### 1. 前端启动
```bash
cd d:\萌开了家居\alufactory-mengkaile
npm install
npm run dev
```

### 2. 后端启动
```bash
cd d:\萌开了家居\alufactory-mengkaile\alufactory-backend
python -m venv venv
source venv/Scripts/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py  # 开发环境
# 或
python run_prod.py  # 生产环境
```

---

## 功能测试场景

### 场景1：铝合金洞洞板拼单

#### 步骤
1. 登录前端（或创建新账户）
2. 导航到首页，点击"铝合金洞洞板"产品
3. 输入长度和宽度（例如 900mm × 800mm）
4. 选择厚度（例如 2mm）
5. 点击"添加板件"
6. 观察可视化布局编辑器显示你的板件
7. 继续添加更多板件（测试碰撞检测和最小间隔）
8. 点击"加入购物车"
9. 验证购物车显示正确的总价：`(长/1000) × (宽/1000) × 单价 × 拼单系数`

#### 预期结果
- 板件自动排列在大板上
- 显示已被其他订单预留的板件（灰色）
- 碰撞检测正确（间隔不少于5mm）
- 价格实时计算

#### 后台验证
1. 登录后台管理（http://localhost:5000/admin/）
2. 导航到"🟦 洞洞板订单管理"
3. 查看新创建的订单
4. 可选：编辑系统设置调整大板尺寸或拼单系数

---

### 场景2：铝柜门拼单

#### 步骤
1. 点击"铝柜门"产品
2. 输入长度和宽度（例如 1200mm × 800mm）
3. 观察厚度固定为 2mm（不可改变）
4. 点击"添加板件"
5. 验证价格计算：`(长/1000) × (宽/1000) × 700 × 拼单系数`
6. 加入购物车

#### 预期结果
- 厚度选择被禁用或隐藏
- 价格基于 700/㎡ 计算
- 其他行为与洞洞板相同

#### 后台验证
1. 导航到"🚪 柜门订单管理"
2. 验证订单中的 `product_type` 为 `CABINET_DOOR`
3. 与洞洞板订单列表独立

---

### 场景3：相框定制

#### 步骤
1. 点击"相框"产品
2. 选择尺寸（例如 A4）
3. 输入或保留相框样式、材质、颜色
4. 勾选"是否卡纸"
5. 如果勾选，输入卡纸尺寸
6. 选择图片来源：
   - 点击样图按钮（Paul Klee/Henri Matisse）
   - 或上传自己的图片
7. 预览区显示相框效果
8. 验证价格：`21 + 29.7 = 50.7`（A4示例）
9. 加入购物车

#### 预期结果
- 相框预览正确显示
- 价格基于长+宽（厘米）
- 支持样图和自定义图片
- 卡纸配置可选

#### 后台验证
1. 导航到"🖼️ 相框订单管理"
2. 查看订单中保存的配置
3. 可在"后台设置 > 相框选项"中管理预定义配置

---

### 场景4：书法特柜子

#### 步骤
1. 点击"铝型材书法特柜子"产品
2. 选择柜子类型（例如"大宽款"）
3. 输入数量（例如 2）
4. 总 unit 数自动计算（2 × 3 = 6）
5. 选择列数布局（例如 2 列）
6. 验证预览显示正确的网格（2列 × 3行）
7. 选择轮子（例如"一般轮子 +¥50"）
8. 验证价格：`6 × 30 + 50 = 230`
9. 加入购物车

#### 预期结果
- 柜子变体显示尺寸和图片
- 列数布局自动计算行数
- 轮子选项正确加价
- 预览网格正确显示

#### 后台验证
1. 导航到"📚 书法特柜子订单管理"
2. 查看订单配置，包括：
   - 选择的变体
   - 总 unit 数和布局
   - 轮子类型

---

### 场景5：购物车和订单流程

#### 步骤
1. 添加多个不同产品到购物车（洞洞板、相框、柜子等）
2. 查看购物车
3. 验证各项目配置正确保存
4. 编辑某项目（例如修改柜子的列数）
5. 删除某项目
6. 点击"保存并下载PDF"提交订单
7. 输入收货信息
8. 确认支付方式
9. 订单创建成功

#### 预期结果
- 购物车显示所有项目及其配置
- 编辑功能正确更新配置
- 订单创建时配置正确传递到后端
- 生成PDF包含所有订单项目详情

#### 后台验证
1. 登录后台
2. 查看各产品类别的订单管理页面
3. 验证订单出现在相应的标签页中
4. 查看订单详情，确认配置信息完整

---

### 场景6：后台设置管理

#### 大板设置（洞洞板/柜门）

**获取当前设置**
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/admin/settings/shared-board/PEGBOARD
```

**更新设置**
```bash
curl -X PUT \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "board_width_mm": 2500,
    "board_height_mm": 1300,
    "min_gap_mm": 5,
    "group_factor": 1.1,
    "thickness_options": [1, 2, 3, 4, 5],
    "thickness_price_map": {
      "1": 800,
      "2": 1100,
      "3": 1400,
      "4": 1700,
      "5": 2000
    }
  }' \
  http://localhost:5000/api/admin/settings/shared-board/PEGBOARD
```

#### 相框选项管理

**获取所有相框选项**
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5000/api/admin/settings/frame-options
```

**创建新相框选项**
```bash
curl -X POST \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "style": "古典复古",
    "frame_width_cm": 25,
    "frame_height_cm": 35,
    "material": "实木",
    "color": "樱桃木",
    "has_mat": true,
    "mat_outer_width_cm": 28,
    "mat_outer_height_cm": 38,
    "mat_inner_width_cm": 22,
    "mat_inner_height_cm": 32
  }' \
  http://localhost:5000/api/admin/settings/frame-options
```

**更新相框选项**
```bash
curl -X PUT \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"color": "黑色"}' \
  http://localhost:5000/api/admin/settings/frame-options/{option_id}
```

#### 预期结果
- 设置正确保存到数据库
- 客户端立即获取更新后的配置
- 新订单使用最新的价格和参数

---

## 故障排查

### 前端问题

#### 产品编辑器未显示
**症状**：点击产品后显示占位符而非编辑器

**解决**：
1. 检查浏览器控制台（F12）是否有错误
2. 验证组件是否正确导入 `App.tsx`
3. 检查 ProductType 枚举值是否匹配

#### 价格计算错误
**症状**：显示的价格与预期不符

**解决**：
1. 验证尺寸单位（毫米 vs 厘米）
2. 检查API是否正确获取最新设置
3. 查看浏览器开发者工具中的网络请求

### 后端问题

#### API 404 错误
**症状**：`POST /api/admin/settings/shared-board/PEGBOARD` 返回 404

**解决**：
1. 确认 Flask 已重启
2. 验证路由定义在 `admin.py` 中
3. 检查 URL 拼写（区分大小写）

#### 订单保存失败
**症状**：订单创建时出错

**解决**：
1. 查看 Flask 控制台日志
2. 验证订单项目的 `config` 字段是否为有效 JSON
3. 检查订单表和相关表的约束

#### 后台页面无法加载订单
**症状**：订单标签页为空或加载缓慢

**解决**：
1. 检查 `product_type` 参数是否正确传递
2. 验证数据库中是否存在该类型的订单
3. 检查分页参数（page, per_page）

---

## 性能优化建议

1. **前端**：
   - SharedBoardEditor 中的碰撞检测算法可优化为四叉树或网格
   - 大量板件时考虑虚拟化列表

2. **后端**：
   - 为 `order_items.product_type` 添加数据库索引
   - 缓存系统设置（使用 Redis）
   - 预计算预留板件集合

---

## 已知限制

1. 共享大板预留不支持时间限制（24小时后自动释放）
2. 相框暂不支持定制尺寸（仅 A5/A4/A3）
3. 书法特柜子的具体铝型材参数尚未完全配置

---

## 下一步

1. 部署到云环境并进行集成测试
2. 收集用户反馈并优化UI/UX
3. 实现订单导出和报价单功能
4. 添加库存管理和提醒功能
