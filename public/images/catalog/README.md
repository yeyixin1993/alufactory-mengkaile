# 首页商品图片

首页不再使用 `picsum.photos` 外网随机图。正式商品图统一为 `800 × 600` JPG；以后需要换图时，直接覆盖同名文件即可，代码无需修改：

| 文件 | 商品 | 当前状态 |
| --- | --- | --- |
| `aluminum-profile.jpg` | 铝型材 | 正式商品图 |
| `pegboard.jpg` | 铝合金洞洞板 | 正式商品图 |
| `cabinet-door.jpg` | 铝框门 | 正式商品图 |
| `art-frame.jpg` | 相框 | 正式商品图 |
| `aluminum-plate.jpg` | 铝板 | 正式商品图 |
| `marine-board.jpg` | 俄罗斯全进口 BBB 海洋板 | 正式商品图 |
| `calligraphy-cabinet.jpg` | 宜家书法特柜子 | 正式商品图 |
| `wardrobe.jpg` | 衣柜 | 正式商品图 |

型材和配件已经使用各自现有的本地实物图，不在这里重复，也不要用占位图覆盖配件实物图。

如需重新生成缺失的占位图，可在已安装 Pillow 的 Python 环境中执行：

```bash
python3 scripts/generate_catalog_placeholders.py
```

脚本默认跳过已经存在的 JPG，避免误覆盖后来放入的正式商品图。
