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

- **多款内置棋盘**：2人/4人各3款经典棋盘（经典版、快速版、挑战版）
- **自定义棋盘**：基于模板创建，可编辑普通格内容（惩罚/奖励/任务等）
- **房间系统**：6位房间码加入，支持实时多人对战
- **传统飞行棋规则**：掷6起飞、撞子回基地、安全区保护、叠子规则
- **实时同步**：基于 Supabase Realtime，所有玩家状态秒级同步
- **简约扁平设计**：方形棋盘，清晰易用的 UI

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
    page.tsx        # 首页（创建/加入房间）
    room/[code]/    # 游戏房间
    board/new/      # 新建棋盘
    board/edit/[id]/ # 编辑棋盘
  components/       # React 组件
    game/           # 游戏组件
  lib/              # 工具库
    boards/         # 棋盘模板和渲染
    game/           # 游戏引擎和存储
    supabase.ts     # Supabase 客户端
  types/            # TypeScript 类型
supabase/
  migrations/       # 数据库迁移
```
