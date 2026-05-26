# 飞行棋 - 多人实时对战

自定义棋盘、多人实时联网飞行棋游戏。基于 React + Next.js + Supabase + Tailwind CSS 构建。

## 环境要求

- Node.js 22（使用 nvm 管理）
- npm

### Node.js 版本管理

本项目使用 Node.js 22，通过 `.nvmrc` 文件指定：

```bash
# 安装 Node 22（如果尚未安装）
nvm install 22

# 切换到项目指定的 Node 版本
nvm use

# 验证版本
node --version  # v22.x.x
```

## 开发环境配置

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Supabase

复制环境变量模板：

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填入你的 Supabase 项目信息：

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

获取方式：

1. 登录 [Supabase](https://supabase.com)
2. 进入你的项目
3. Project Settings → API
4. 复制 `URL` 和 `anon public` API key

### 3. 初始化数据库

需要在 Supabase 中创建 `boards`、`rooms`、`players` 三张表，执行 `supabase/migrations/001_initial_schema.sql` 即可。

**方式一：通过 SQL Editor（推荐）**

直接打开 SQL Editor 页面（替换 `<PROJECT_ID>` 为你的 Supabase 项目 ID）：

```
https://supabase.com/dashboard/project/<PROJECT_ID>/sql/new
```

> 项目 ID 在你的 Supabase 项目 URL 中可以找到，例如 `https://supabase.com/dashboard/project/abcdefg` 中的 `abcdefg`，也等同于 `NEXT_PUBLIC_SUPABASE_URL` 中 `https://abcdefg.supabase.co` 的子域名部分。

打开后，把 `supabase/migrations/001_initial_schema.sql` 文件的全部内容复制到编辑器中，点击右下角的 **Run**（或按 `Cmd/Ctrl + Enter`）即可。

**方式二：通过 Supabase CLI**

```bash
# 安装 CLI
npm install -g supabase

# 登录并链接项目
supabase login
supabase link --project-ref <PROJECT_ID>

# 执行迁移
supabase db execute --file supabase/migrations/001_initial_schema.sql
```

执行成功后，Supabase Dashboard → Table Editor 中可以看到三张新表。

## 本地开发

```bash
npm run dev
```

打开 http://localhost:3000

## 部署到 Vercel

### 1. 连接 GitHub 仓库

1. 登录 [Vercel](https://vercel.com)
2. 点击 "Add New Project"
3. 选择 `flexi-flight-chess` 仓库
4. Framework Preset 选择 Next.js

### 2. 配置环境变量

在 Vercel 项目设置中添加环境变量：

| Name                              | Value                  |
| --------------------------------- | ---------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | 你的 Supabase URL      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 你的 Supabase Anon Key |

### 3. 部署

每次推送到 main 分支，Vercel 会自动重新部署。

## 功能特性

- **多款内置棋盘**：2人/4人经典棋盘
- **自定义棋盘**：登录后从头创建，可编辑格子类型（飞行/后退/安全/普通）和内容
- **房间系统**：6位房间码加入，支持实时多人对战
- **飞行棋规则**：飞行格加速、后退格惩罚、安全区保护、碰撞回起点、终点反弹
- **实时同步**：基于 Supabase Realtime，所有玩家状态秒级同步
- **灵活人数**：支持 1-4 人游戏，按实际加入人数开局

## 技术栈

| 技术         | 用途                   |
| ------------ | ---------------------- |
| Next.js 15   | React 框架，App Router |
| TypeScript   | 类型安全               |
| Tailwind CSS | 样式                   |
| Supabase     | 数据库 + 实时推送      |
| Vercel       | 部署托管               |

## 项目结构

```
src/
  app/              # Next.js 页面
    page.tsx        # 首页（登录/游客加入房间）
    login/          # 登录/注册
    board/
      new/          # 棋盘列表（创建房间）
      edit/         # 棋盘编辑器
    room/[code]/    # 游戏房间
  components/       # React 组件
    Board.tsx       # 棋盘渲染
    Dice.tsx        # 骰子组件
  lib/              # 工具库
    auth.ts         # 认证
    board.ts        # 棋盘引擎
    db.ts           # 数据库 CRUD
    supabase.ts     # Supabase 客户端
supabase/
  migrations/       # 数据库迁移
```

## 已知安全问题（TODO）

以下安全项已在计划中但尚未实施，切勿在生产环境公开部署：

1. **密码哈希**：当前使用客户端 SHA-256 无盐哈希，应改为 bcrypt/scrypt/argon2 服务端哈希。
2. **数据库 RLS**：所有表的 Row Level Security 策略为 `TO anon USING (true)`，意味着任何匿名用户可读写任意数据。需按用户身份限制权限。
3. **登录频率限制**：登录/注册接口无频率限制，可被暴力破解。需添加 rate limiting 或 CAPTCHA。
4. **游戏状态校验**：游戏状态（掷骰子、移动）直接由客户端写入数据库，无服务端校验。恶意客户端可任意修改棋局。
5. **环境变量**：`.env.local` 中的 `NEXT_PUBLIC_ADMIN_PASSWORD` 和 `SUPABASE_DATABASE_PASSWORD` 不应提交。确保 `.env.local` 在 `.gitignore` 中，并检查 git 历史是否暴露了敏感信息。
