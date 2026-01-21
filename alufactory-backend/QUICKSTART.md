# Alufactory Backend - Quick Start

## 快速开始

### 1. 安装依赖
```bash
cd alufactory-backend
pip install -r requirements.txt
```

### 2. 配置数据库

#### Windows
下载安装 MySQL: https://dev.mysql.com/downloads/mysql/

#### macOS
```bash
brew install mysql
brew services start mysql
```

#### 创建数据库
```bash
mysql -u root -p
```
在 MySQL 终端执行:
```sql
CREATE DATABASE alufactory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 3. 创建 .env 配置文件

在 `alufactory-backend` 文件夹中创建 `.env` 文件:

```
FLASK_ENV=development
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/alufactory_db
SECRET_KEY=dev-secret-key-12345
JWT_SECRET_KEY=dev-jwt-secret-key-12345
```

**注意**: 将 `password` 替换为您的 MySQL root 密码

### 4. 初始化数据库

```bash
python init_db.py
```

输出应该显示:
```
✓ Database tables created
✓ Initial admin user created (phone: 13800138000, password: admin123)
✓ Demo customer user created (phone: 18888888888, password: demo123)
```

### 5. 启动后端服务

```bash
python run.py
```

输出应该显示:
```
 * Running on http://0.0.0.0:5000
```

### 6. 访问管理界面

打开浏览器访问: **http://localhost:5000/admin/login.html**

登录凭证:
- 电话: 13800138000
- 密码: admin123

## API 测试

### 使用 curl 测试登录
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "13800138000", "password": "admin123"}'
```

### 使用 Postman
1. 新建 POST 请求
2. URL: `http://localhost:5000/api/auth/login`
3. Body (JSON):
```json
{
  "phone": "13800138000",
  "password": "admin123"
}
```

## 常见问题

### MySQL 连接失败
- 检查 MySQL 是否运行中
- 检查用户名密码是否正确
- 检查数据库是否存在

### 端口被占用
```bash
# Windows
netstat -ano | findstr :5000

# Mac/Linux
lsof -i :5000
```

### 导入错误
确保当前目录在 alufactory-backend 文件夹中

## 下一步

1. 配置前端 API 调用指向 `http://localhost:5000/api`
2. 在前端登录测试整个流程
3. 上传到 Aliyun 云服务器进行生产部署

## 生产环境部署

### 安装 Gunicorn
```bash
pip install gunicorn
```

### 启动生产服务器
```bash
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

更多详细信息请查看 README.md
