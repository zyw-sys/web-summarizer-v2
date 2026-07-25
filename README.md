# 卡知 · 食物热量助手

输入食品名称，或上传食物照片，查询热量并由 AI 给出饮食搭配建议。

## 功能

- 输入食品名称（支持中文/英文）查询每 100 克热量
- 上传食物图片，自动识别食物并列出热量清单
- 条形码扫描包装食品（Open Food Facts）
- 运动消耗记录（MET 估算）
- 体重曲线与多日热量历史
- 宏量营养素：蛋白质 / 脂肪 / 碳水
- 份量计算（常见克数快捷选择）
- 每日热量目标（Mifflin-St Jeor 估算）
- 今日饮食日记（早餐/午餐/晚餐/加餐）
- 常见食物快捷入口
- USDA 营养数据库 + AI 估算兜底
- DeepSeek 生成饮食搭配建议

## 技术栈

- Next.js（App Router）
- TypeScript + Tailwind CSS
- SQLite（Node 内置 `node:sqlite`，本地文件 `data/kazhi.sqlite`）
- USDA FoodData Central API
- DeepSeek API
- 通义千问 Qwen-VL（图片识别）

## 账号与数据库

- 支持注册 / 登录 / 退出
- 每次登录、注册、退出都会写入 `login_logs`
- 不同用户的饮食日记、每日目标分开存储
- 会话使用 HttpOnly Cookie + `sessions` 表区分
- 超级管理员可进入 `/admin` 监察台，查看用户与登录数据

### 超级管理员默认账号

在 `.env.local` 配置（也可使用默认值）：

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123456
```

首次启动会自动创建该管理员账号。登录后点击「监察台」，或访问 [http://localhost:3000/admin](http://localhost:3000/admin)。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制示例文件并填入密钥：

```bash
cp .env.example .env.local
```

| 变量 | 说明 | 申请地址 |
|------|------|----------|
| `USDA_API_KEY` | 营养数据 | https://fdc.nal.usda.gov/api-key-signup.html |
| `DEEPSEEK_API_KEY` | 饮食建议 / 食品名规范化 | https://platform.deepseek.com/ |
| `DASHSCOPE_API_KEY` | 图片识图（通义千问） | https://dashscope.console.aliyun.com/ |

### 3. 启动开发服务

```bash
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

## 使用说明

### 文字查询

1. 填写食品名，例如：`鸡蛋`、`苹果`、`鸡胸肉`
2. 点击「查询热量」
3. 查看每 100 克热量与 AI 搭配建议

### 图片识别

1. 切换到「图片识别」
2. 上传食物照片
3. 点击「开始识别」
4. 查看识别出的食物列表、每 100 克热量，以及估算份量热量

## 项目结构

```
app/
  page.tsx                 # 首页
  api/food/route.ts        # 文字查询接口
  api/food/image/route.ts  # 图片识别接口
components/
  FoodCalculator.tsx       # 主界面
lib/
  usda.ts                  # USDA 热量查询
  deepseek.ts              # 食品名规范化 + 搭配建议
  qwen.ts                  # 通义千问识图
  nutrition.ts             # 热量查询统一封装
```
