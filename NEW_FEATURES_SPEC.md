# 新功能实现规范文档

## 概述
本文档描述了四个新产品类别及其专属编辑器的完整实现。

---

## 1. 铝合金洞洞板（Pegboard / Group Buying Board）

### 功能特性
- **大板尺寸**（可在后台调整）：2450mm × 1240mm（默认）
- **厚度选项**：1mm, 2mm, 3mm, 4mm, 5mm
- **价格表**（每平方米）：
  - 1mm: ¥780/㎡
  - 2mm: ¥1080/㎡
  - 3mm: ¥1380/㎡
  - 4mm: ¥1680/㎡
  - 5mm: ¥1980/㎡
- **拼单系数**：后台可调整的倍数（默认 1）
- **最小间隔**：板子间距不得低于 5mm

### 价格计算
```
总价 = (长mm/1000) × (宽mm/1000) × 单价 × 拼单系数
```

示例：
- 输入：900mm × 800mm × 2mm厚 + 拼单系数1.0
- 计算：(900/1000) × (800/1000) × 1080 × 1.0 = ¥777.6

### 前端实现
- **编辑器**: `SharedBoardEditor.tsx`（也用于柜门）
- **产品类型**: `PEGBOARD`
- **订单项目存储结构**：
```typescript
config: {
  productType: 'PEGBOARD',
  boardWidthMm: 2450,
  boardHeightMm: 1240,
  minGapMm: 5,
  groupFactor: 1.0,
  pieces: [
    {
      id: 'uuid',
      x: 0, y: 0,
      width: 900, height: 800,
      thicknessMm: 2,
      areaM2: 0.72,
      unitPricePerM2: 1080,
      price: 777.6
    }
  ]
}
```

### 后端API
- **获取设置**: `GET /api/orders/shared-board/settings?product_type=PEGBOARD`
- **获取预留板件**: `GET /api/orders/shared-board/reservations?product_type=PEGBOARD`
- **后台管理设置**: `GET/PUT /api/admin/settings/shared-board/PEGBOARD`

### 后台功能
- 可视化布局编辑器显示已被其他客户预留的板件（灰色）
- 可手动调整大板尺寸、最小间隔、拼单系数
- 查看已下单的板件详情及预留情况

---

## 2. 铝柜门（Cabinet Door）

### 功能特性
- **大板尺寸**：2450mm × 1240mm（与洞洞板相同，可独立调整）
- **厚度**：仅支持 2mm
- **价格**：¥700/㎡（固定）
- **拼单系数**：后台可调整
- **最小间隔**：5mm

### 价格计算
```
总价 = (长mm/1000) × (宽mm/1000) × 700 × 拼单系数
```

### 前端实现
- **编辑器**: `SharedBoardEditor.tsx`（复用）
- **产品类型**: `CABINET_DOOR`
- 配置结构同洞洞板，但厚度固定为 2mm

### 后端API
- **获取设置**: `GET /api/orders/shared-board/settings?product_type=CABINET_DOOR`
- **获取预留板件**: `GET /api/orders/shared-board/reservations?product_type=CABINET_DOOR`

### 后台功能
- 与洞洞板独立的管理界面
- 可单独管理大板尺寸、拼单系数等参数

---

## 3. 相框（Art Frame）

### 功能特性
- **尺寸选项**：A5 (14.8×21cm), A4 (21×29.7cm), A3 (29.7×42cm)
- **相框样式**：客户自定义输入（如"极简直角"）
- **相框材质**：客户自定义输入（如"铝合金"）
- **相框颜色**：客户自定义或从调色板选择（如"黑色"）
- **卡纸**：可选，支持自定义外尺寸和内尺寸
- **图片来源**：
  - 内置样图：Paul Klee、Henri Matisse 等艺术家作品
  - 用户上传
- **价格计算**：长(cm) + 宽(cm)
  - A4 例：21 + 29.7 = ¥50.7

### 前端实现
- **编辑器**: `FrameEditor.tsx`
- **产品类型**: `FRAME`
- **订单项目存储结构**：
```typescript
config: {
  size: 'A4',
  widthCm: 21,
  heightCm: 29.7,
  frameStyle: '极简直角',
  frameMaterial: '铝合金',
  frameColor: '黑色',
  hasMat: true,
  matOuterWidthCm: 24,
  matOuterHeightCm: 33,
  matInnerWidthCm: 20,
  matInnerHeightCm: 28,
  imageSource: 'sample' | 'upload',
  imageUrl: 'https://...'
}
```

### 后端API
- **获取相框选项**: `GET /api/orders/frame/options`

### 后台功能
- **管理相框选项**: `GET/POST/PUT/DELETE /api/admin/settings/frame-options`
- 可添加预定义的相框样式、材质、颜色组合
- 可管理卡纸相关参数（外尺寸、内尺寸）

---

## 4. 铝型材书法特柜子（Shufate Modular Cabinet）

### 功能特性
基于 IKEA 书法特（Kallax）风格的模块化柜子，由铝型材拼接而成。

#### 柜子变体（4种）
1. **小窄款**（1 unit高）
   - 尺寸：42cm × 39cm × 41cm
   - 容量：1个unit

2. **小宽款**（2格横向，1 unit高）
   - 尺寸：77cm × 39cm × 42cm
   - 容量：1个unit

3. **中宽款**（约2 unit高）
   - 尺寸：77cm × 39cm × 77cm
   - 容量：2个unit

4. **大宽款**（约3 unit高）
   - 尺寸：77cm × 39cm × 147cm
   - 容量：3个unit

#### 配置选项
- **选择变体**：上述4种之一
- **数量**：客户可选择购买多个变体
- **列数布局**：自动计算总unit数后，客户可选择：
  - 1列（全部纵向堆放）
  - 2列（水平并排 + 纵向堆放）
  - 3列（3列网格布局）
- **轮子**：
  - 不要 (+0)
  - 一般轮子 (+¥50)
  - 诺贝轮子 (+¥200)

#### 价格计算
```
总价 = 总unit数 × ¥30 + 轮子价格
```

示例：
- 购买1个大宽款（3 units）+ 1个中宽款（2 units）= 5 units
- 选择2列布局，1列3个unit，1列2个unit
- 选择一般轮子
- 总价：5 × 30 + 50 = ¥200

### 前端实现
- **编辑器**: `ShufateCabinetEditor.tsx`
- **产品类型**: `SHUFATE_CABINET`
- **订单项目存储结构**：
```typescript
config: {
  variantId: 'large_wide',
  variantName: '大宽款 (约3 unit高)',
  widthCm: 77,
  depthCm: 39,
  heightCm: 147,
  count: 1,              // 购买数量
  unitCount: 3,          // 总unit数
  columns: 2,            // 最终布局：2列
  rows: 2,               // 最终布局：2行
  wheelType: 'basic'     // 轮子类型
}
```

### 后端数据存储
- 柜子变体信息存储在常量或数据库中
- 订单保存时 config 记录完整的配置参数

### 后台功能
- 显示柜子变体列表和图片
- 可编辑变体信息（尺寸、unit数等）
- 查看订单中的柜子配置详情

---

## 5. 后台管理界面更新

### 新增订单管理标签页

#### 导航菜单
```
📦 铝型材订单管理     (原有，product_type=PROFILE)
🟦 洞洞板订单管理     (新增，product_type=PEGBOARD)
🚪 柜门订单管理       (新增，product_type=CABINET_DOOR)
🖼️ 相框订单管理       (新增，product_type=FRAME)
📚 书法特柜子订单管理 (新增，product_type=SHUFATE_CABINET)
```

#### 实现方式
- 所有订单标签共享同一个 `#orders` 内容面板
- 通过 `currentOrdersProductType` 变量跟踪当前查看的产品类型
- `loadOrders()` 函数通过 `product_type` 参数过滤API请求
- 后台API `/api/admin/orders` 支持 `product_type` 查询参数

### 系统设置管理

#### 新增管理端点
- `GET /api/admin/settings/shared-board/{PEGBOARD|CABINET_DOOR}`
  - 获取大板配置（尺寸、最小间隔、拼单系数、价格表）
- `PUT /api/admin/settings/shared-board/{PEGBOARD|CABINET_DOOR}`
  - 更新大板配置

- `GET/POST /api/admin/settings/frame-options`
  - 列表获取或创建相框选项
- `GET/PUT/DELETE /api/admin/settings/frame-options/{option_id}`
  - 管理单个相框选项

#### 后台数据库表
- `system_settings` 表
  - `key`: 设置键（如 `shared_board_pegboard_settings`）
  - `value`: JSON 格式配置值
  - `updated_at`: 最后修改时间

- `frame_options` 表
  - 存储所有可用的相框样式、材质、颜色、卡纸配置

---

## 6. 技术实现细节

### 新增类型定义 (`types.ts`)
```typescript
enum ProductType {
  PROFILE = 'PROFILE',
  PEGBOARD = 'PEGBOARD',
  CABINET_DOOR = 'CABINET_DOOR',
  FRAME = 'FRAME',
  SHUFATE_CABINET = 'SHUFATE_CABINET'
}

interface SharedBoardPiece extends Rect {
  thicknessMm: number;
  areaM2: number;
  unitPricePerM2: number;
  price: number;
}

interface SharedBoardConfig {
  productType: ProductType.PEGBOARD | ProductType.CABINET_DOOR;
  boardWidthMm: number;
  boardHeightMm: number;
  minGapMm: number;
  groupFactor: number;
  pieces: SharedBoardPiece[];
}

interface FrameConfig {
  size: 'A5' | 'A4' | 'A3';
  widthCm: number;
  heightCm: number;
  frameStyle: string;
  frameMaterial: string;
  frameColor: string;
  hasMat: boolean;
  matOuterWidthCm?: number;
  matOuterHeightCm?: number;
  matInnerWidthCm?: number;
  matInnerHeightCm?: number;
  imageSource: 'sample' | 'upload';
  imageUrl: string;
}

interface ShufateConfig {
  variantId: string;
  variantName: string;
  widthCm: number;
  depthCm: number;
  heightCm: number;
  unitCount: number;
  columns: 1 | 2 | 3;
  rows: number;
  wheelType: 'none' | 'basic' | 'nobel';
}
```

### 新增后端模型 (`app/models/user.py`)
```python
class SystemSetting(db.Model):
    key: str (主键)
    value: JSON (配置值)
    updated_at: DateTime

class FrameOption(db.Model):
    id: str (UUID)
    style: str
    frame_width_cm: float
    frame_height_cm: float
    material: str
    color: str
    has_mat: bool
    mat_outer_width_cm: float
    mat_outer_height_cm: float
    mat_inner_width_cm: float
    mat_inner_height_cm: float
    is_active: bool
    created_at, updated_at: DateTime
```

### 前端编辑器组件
- `SharedBoardEditor.tsx`: 处理洞洞板和柜门的拼单编辑
- `FrameEditor.tsx`: 相框定制和预览
- `ShufateCabinetEditor.tsx`: 模块化柜子配置

### 新增API服务方法 (`services/apiService.ts`)
```typescript
async getSharedBoardSettings(productType: 'PEGBOARD' | 'CABINET_DOOR')
async getSharedBoardReservations(productType: 'PEGBOARD' | 'CABINET_DOOR')
async getFrameOptions()
```

---

## 7. 部署和初始化

### 数据库初始化
运行 Flask 应用时，以下表会自动创建：
- `system_settings`
- `frame_options`

### 默认配置
系统内置默认配置，无需手动插入数据库初始记录。通过API获取时，如果数据库记录不存在，会返回硬编码的默认值。

### 首次部署
1. 更新前端依赖（如需）
2. 更新后端依赖（如需）
3. 运行数据库迁移（如使用 alembic，需创建迁移脚本）
4. 重启 Flask 后端
5. 重新构建和部署前端

---

## 8. 测试清单

### 前端测试
- [ ] 洞洞板编辑器：支持多厚度选择、实时价格计算、板件碰撞检测
- [ ] 柜门编辑器：2mm 厚度固定、价格计算正确
- [ ] 相框编辑器：支持3种尺寸、样图和上传、卡纸选项、价格显示
- [ ] 书法特柜编辑器：变体选择、列数布局、轮子选项、总价计算
- [ ] 购物车：各产品配置正确保存和显示
- [ ] 订单创建：配置数据正确传递到后端

### 后端测试
- [ ] 洞洞板 API：获取设置、预留板件列表、订单创建和存储
- [ ] 柜门 API：同上（独立配置）
- [ ] 相框 API：获取选项、订单存储
- [ ] 书法特 API：订单存储和恢复
- [ ] 后台设置 API：CRUD 操作、权限验证
- [ ] 订单过滤：product_type 参数正确过滤结果

### 后台管理测试
- [ ] 新增标签页显示正确
- [ ] 订单过滤和分页正常
- [ ] 设置管理界面可访问
- [ ] 相框选项编辑功能正常

---

## 9. 后续增强计划

1. **洞洞板和柜门**：
   - 支持自动化报价算法优化
   - 支持预留时间限制（如24小时内未下单则释放）
   - 增加库存管理功能

2. **相框**：
   - 支持定制尺寸（突破A系列）
   - 支持多种玻璃/亚克力材料
   - 支持装裱服务

3. **书法特柜**：
   - 支持内部隔板配置
   - 支持灯光配置
   - 支持门框配置

4. **通用**：
   - 增加批量订单管理
   - 支持订单模板保存
   - 支持报价单导出

---

## 10. 联系和支持

如有任何问题或需要修改，请联系开发团队。
