# Current Project — Kaxu

> 易变状态:目录结构、入口、里程碑范围、待办、变更记录。
>
> 约束与规范在 [`CLAUDE.md`](CLAUDE.md):硬约束(公开边界 / 依赖方向 / 操作模型 / 协议稳定性)、零源码状态下的工作方式、技术栈、命令、代码风格与命名、领域模型、协作约定、明确不做。**动手前先读那份。**
>
> 更新触发:目录结构变化、全局命令变化、里程碑范围变化时更新本文件;纯业务代码改动不更新。

## 项目信息

- 名称:Kaxu(根包 `kaxu`,version `0.0.0`,`private: true`)
- 业务目标:面向本地 AI 编程 Agent 的开放控制平面,让本地 Agent 会话变成可跨设备控制、可恢复、可审计、可扩展的工作单元
- 定位:`Run locally. Control from anywhere. Keep the operation intact.`
- 模式:Open Core,社区版 `LGPL-3.0-only`
- 仓库初始化:2026-08-04
- 当前状态:早期架构阶段。**除 `scripts/check-public-boundary.sh` 外零源码**;4 个占位包 + 1 个占位 app,无 `tsconfig.json`、无 lockfile、任何包都没声明依赖。在这种状态下如何工作见 `CLAUDE.md` 第 2 节

## 目录结构

```text
kaxu/
├── apps/
│   └── web/                     # Web/PWA Projection(占位)
├── packages/
│   ├── operation-core/          # SessionOperation 与确定性状态转移(占位)
│   ├── protocol/                # 版本化 OperationCommand / OperationEvent schema(占位)
│   ├── adapter-sdk/             # Agent 能力发现与执行契约(占位)
│   └── host/                    # 本地进程与会话边界(占位)
├── examples/                    # 最小集成示例(仅 README,缺 package.json)
├── docs/
│   ├── public/                  # architecture / protocol / adapters
│   │                            #   community-edition / self-hosting
│   └── internal/                # 内部材料,已 gitignore,不得提交
├── scripts/
│   └── check-public-boundary.sh # 唯一可执行脚本
├── .github/
│   ├── workflows/
│   │   └── public-boundary.yml  # 每次 push / PR 执行边界检查
│   ├── ISSUE_TEMPLATE/          # bug.yml / feature.yml / config.yml
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── dependabot.yml           # npm,每月,最多 5 个 PR
├── README.md / README.zh-CN.md
├── CONTRIBUTING.md / CODE_OF_CONDUCT.md / SECURITY.md / SUPPORT.md
├── LICENSE / NOTICE.md / CHANGELOG.md
├── package.json / pnpm-workspace.yaml
├── CLAUDE.md                    # Agent 约束与规范
└── current_project.md           # 本文件
```

占位包的构成:每个只有 `package.json`(`name` / `version` / `private` / `license` 四个字段)+ README。

## 入口与启动

- 开发入口:**尚不存在**
- 唯一的校验命令:`pnpm check`(命令全集见 `CLAUDE.md` 第 4 节)
- 主配置文件:`package.json`、`pnpm-workspace.yaml`

## 首期 MVP 范围

一条完整控制闭环:

1. 本地启动 Claude 或 Codex 会话
2. 浏览器完成配对
3. 接收结构化流式事件
4. 远程发送 / 暂停 / 继续 / 停止
5. 预览并允许或拒绝工具请求
6. 断线后回放缺失事件,不重复执行同一操作

推迟项见 `CLAUDE.md` 第 8 节。

## 待办

工具链:

- [ ] 配置 TypeScript(`tsconfig.json`、路径别名、strict 模式)
- [ ] 选定构建工具、测试框架、linter、formatter,补齐 `CLAUDE.md` 第 3 节的 Pending 项
- [ ] 为 `pnpm check` 补充 lint / test / typecheck 子命令,同步 `CLAUDE.md` 第 4 节
- [ ] `examples/` 补 `package.json`,否则不在 workspace 生效

实现:

- [ ] `packages/operation-core`:`SessionOperation` 与状态转移
- [ ] `packages/protocol`:可执行 schema 与契约测试,之后才能声明 wire contract
- [ ] `packages/adapter-sdk`:`AgentAdapter` 契约、错误分类、背压、一致性测试套件
- [ ] `packages/host`:本地进程与会话边界
- [ ] `apps/web`:配对、状态、事件流、审批、重连恢复

文档:

- [ ] `docs/public/self-hosting.md` 待补:部署前置条件、网络拓扑、密钥管理、升级、备份、安全默认值

## 变更记录

| 日期 | 变更内容 |
|---|---|
| 2026-08-05 | 新增 `CLAUDE.md` 作为 Agent 约束文件,吸收原 `base_spec.md`(已删除);本文件精简为易变状态 |
| 2026-08-05 | 初始生成。仓库为骨架状态:4 个占位包 + 1 个占位 app,无源码,唯一可运行命令为 `pnpm check` |
