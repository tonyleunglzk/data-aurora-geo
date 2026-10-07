# Data Aurora GEO — 前端

GEO（生成式引擎优化）平台的 Vue 3 前端源码展示副本。代码保留原项目的页面、交互和 API 对接逻辑；不包含生产环境配置、历史业务数据或部署主机资料。

## 技术栈

Vue 3、TypeScript、Vite、Pinia、Vue Router、Element Plus、ECharts。依赖版本与锁定结果见 `package.json` 和 `pnpm-lock.yaml`。

## 主要代码与功能

| 目录/文件 | 对应实现 |
| --- | --- |
| `src/views/geo/` | 提示词引擎、规则版本管理、批量任务历史、发布反馈、SERP 研究、规则卡及模型配置界面 |
| `src/views/geo-v3/` | 独立 V3 版本、变量池、主推产品、单条/批量 Prompt 生成及生成记录 |
| `src/api/geo.ts` | GEO REST API 调用、任务查询、文件导入、流式响应与 ZIP 下载 |
| `src/types/geo.ts` | 业务请求与响应的 TypeScript 类型 |
| `src/views/video-generation/`、`src/views/video-materials/` | 视频生成、素材库和组装工作台扩展界面 |
| `src/router/`、`src/stores/`、`src/layouts/` | 路由、登录状态、角色相关界面行为、导航与页签 |
| `src/components/EChartPanel.vue`、`src/mock/dashboard.ts` | 图表组件和明确的演示仪表盘数据 |

功能操作依赖后端及相应的数据库、外部模型/媒体服务配置。源码存在不代表这些外部服务已在展示环境接通；演示仪表盘数据不是实际运营指标。前端权限显示仅用于界面行为，接口访问控制由后端负责。

## 本地运行

使用 Node.js 22.12+ 和 pnpm 10。

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

默认开发地址是 `http://localhost:19986`；默认 API 是 `http://localhost:19988/api`。先按仓库中后端 README 配置并启动后端。登录账号由本地后端配置，不提供生产账号。

```sh
pnpm typecheck
pnpm build
```

`VITE_*` 配置会进入浏览器资源，不能用于保存模型 API Key 等秘密。模型服务配置经由后端管理。

## 展示副本处理

只复制 `src/` 与运行/构建所需配置；不包含原 `.env`、内部文档、部署文件、`AGENTS.md`、视频测试素材、`node_modules`、构建产物或原 Git 历史。`src/mock/users.ts` 已改为明确的合成演示用户和非真实号码。

未随源码打包第三方依赖；使用者安装的依赖遵循其各自许可证。本目录没有新增项目开源许可证，公开展示本身不授予额外再分发许可。
