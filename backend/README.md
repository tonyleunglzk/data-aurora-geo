# Data Aurora GEO 后端（公开展示副本）

本目录保存 GEO 生成式引擎优化平台的后端应用源码，用于展示项目结构、技术实现与开发经验。它是经过脱敏整理的源码快照，未包含原 Git 历史、客户数据、模型账户凭据或运行环境。

## 技术与功能

- NestJS 11、TypeScript、Prisma 6、MySQL，DTO 输入校验与模块化接口。
- GEO Prompt Engine：参考文章解析、产品资料、固定规则、版本草稿对话、变量池与多版本生成。
- SERP 研究及发布反馈：搜索结果采集、文章结构分析、AI 摘要、规则卡、发布记录与 AI 引用匹配。
- 批量任务：任务/子项状态、并发处理、重试、进度及 TXT/ZIP 导出。
- 扩展模块：图片/视频生成、视频素材库、镜头分析、素材匹配与 FFmpeg 成片流程。
- Python 抓取辅助脚本位于 `src/modules/geo/scripts/`，不表示后端使用 Django。

## 源码入口

| 能力 | 文件 |
| --- | --- |
| 服务启动、DTO 验证 | `src/main.ts`、`src/app.module.ts` |
| GEO 研究、生成、批量及发布反馈 | `src/modules/geo/geo.service.ts`、`geo.controller.ts` |
| 第三版引擎、变量池与版本草稿 | `src/modules/geo-v3/`、`src/modules/geo/core/prompt-v3.ts` |
| SERP/文章处理与 Python 采集 | `src/modules/geo/core/`、`src/modules/geo/scripts/` |
| 数据库关系设计 | `prisma/schema.prisma`、`prisma/migrations/` |
| 视频生成与素材处理 | `src/modules/video-generation/`、`src/modules/video-materials/` |

## 本地构建与启动条件

推荐 Node.js 24（或 22.13+）、pnpm 10 和一个全新的本地 MySQL 测试数据库。所有命令均在本目录执行。

```sh
pnpm install --frozen-lockfile
cp .env.example .env
```

编辑 `.env`，填写**全新本地测试库**的 `DATABASE_URL`，以及自行选择的 `BOOTSTRAP_ADMIN_USERNAME` 和至少 12 位的 `BOOTSTRAP_ADMIN_PASSWORD`。文件中的凭据均为空，项目不提供通用账号密码。创建其他用户也必须明确提供密码。

```sh
pnpm prisma:generate
pnpm typecheck
pnpm build
# 仅在已核对 DATABASE_URL 指向全新本地测试库后执行：
pnpm prisma:deploy
pnpm start
```

默认监听 `127.0.0.1:19988`，接口前缀 `/api`。这是源码展示及本地实验应用：现有登录逻辑使用 SHA-256 密码摘要及 base64 token，业务接口没有统一的服务端鉴权保护；公开发布源码并不等于适合直接部署到互联网。启动时会初始化设置/规则/用户、恢复任务状态并启动后台任务，因此不得连接既有业务数据库。历史迁移包含删除旧表、删列和回填语句，只应应用到新建的本地测试库。

运行特定功能还需：

- 模型生成：自行配置可用的模型凭据、端点及模型名称；历史默认模型名是代码快照中的配置，不保证服务商仍可调用。
- 视频能力：本机 `ffmpeg`、`ffprobe`、Sharp 及自行提供的测试素材。仓库不附带媒体素材或成片。
- Python 抓取：Python 3；脚本支持可选 `curl_cffi`，未安装时使用标准库回退。抓取网络能力未在本次整理中执行。
- `pnpm test:video-workflow`：可选的本地服务检查，需要预先准备可用测试素材/任务；它会调用拆片/分析预览并读取现有素材，不能当成不依赖环境的单元测试。展示副本已限制该脚本只连接 localhost。

## 脱敏说明

保留应用源码、Prisma 数据模型与历史迁移、包清单/锁文件和工作流检查脚本；排除了 `.env`、原环境示例、PM2 部署配置、`storage/`、编译产物、依赖、Python 缓存及原 Git 历史。重新编写了空凭据 `.env.example`，删除固定默认密码和示例人员/手机号种子，改为显式配置初始化管理员。第三方库通过包管理器获取，依赖许可证仍由各自权利人定义。

## 验证范围

本次使用 Node.js 24.16.0 和原项目依赖的独立临时副本，Prisma validate/generate、TypeScript 类型检查、NestJS 构建、Python/JavaScript 语法检查及初始化用户逻辑的模拟数据库检查均通过。临时依赖和构建产物已移除。未启动应用、连接数据库、执行迁移、请求模型服务、运行爬虫或媒体处理流程。数据库迁移及外部服务端到端行为仍需在隔离测试环境验证。根目录的技术证据文档记录具体检查结果。
