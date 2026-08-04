# Kaxu

> 让本地 AI 编程 Agent 变成可跨设备控制、可恢复、可审计、可扩展的工作单元。

Kaxu 是一个面向本地 AI 编程 Agent 的开放控制平面。

当 Agent 逐渐从“聊天工具”变成长时间运行的协作者，开发者真正需要管理的就不只是代码，而是：任务是否还在运行、是否等待审批、是否发生失败、是否可以在离开电脑后继续推进，以及断线后能否恢复原来的上下文。

Kaxu 要建设的，正是本地 Agent 与设备、人员和系统之间缺失的控制层。

```text
在本地运行，从任何设备控制，让同一个操作持续下去。
```

> 项目状态：早期架构与仓库初始化阶段。README 中描述的是产品方向，不代表当前已经是可用于生产的运行时。

## Kaxu 要解决什么

- 在用户电脑旁运行和恢复本地 Agent 会话。
- 用统一的命令和事件协议连接 Claude、Codex 及未来的其他 Adapter。
- 用 Web/PWA 查看状态、发送消息、处理审批和恢复任务。
- 用统一策略边界管理工具预览、允许/拒绝、超时和审计。
- 用可回放的操作历史抵御断线和设备切换。
- 让新增 Agent 不需要重新实现所有客户端。

Kaxu 不想成为另一个云端 IDE。它保留 Agent 与代码和本地环境的距离，把远程控制从原始终端字符流提升为结构化、可检查的操作。

## 最小单元

Kaxu 围绕 `SessionOperation` 构建：

> 一个参与者在某个会话中对某个目标执行一个动作，并产生可追踪的状态变化。

```text
SessionOperation = actor + session + target + action + policy + state + result
```

同一个 `operationId` 贯穿完整生命周期：

```text
requested -> waiting -> approved -> running -> completed
                                      \-> failed / cancelled
```

这个单元可以被 Web、手机、CLI、通知和审计同时投影，不需要为每个端重复实现业务逻辑。

## 架构方向

```text
Web / Mobile / CLI
        <-> Session Gateway
        <-> Operation Protocol
        <-> SessionOperation Core
        <-> Agent Adapter
        <-> Local Host
        <-> Claude / Codex / 其他 Agent
```

扩展规则保持简单：

```text
新增 Agent       = AgentAdapter + CapabilityManifest
新增客户端       = Projection + OperationCommand
新增功能         = Command + Event + Policy
新增 Consumer     = 订阅 OperationEvent
新增基础设施     = 在 Port 后实现替换
```

## Community Edition

Kaxu Community Edition 计划提供：

- `SessionOperation` 和确定性的状态转移；
- 版本化的命令和事件协议；
- Agent Adapter SDK 与社区适配器；
- 本地 Host 和会话边界；
- 响应式 Web/PWA 基础；
- 自托管基础能力；
- 公开架构和集成文档。

托管中继、团队治理、企业安全、合规集成、托管运维和支持服务可能以商业方式提供。社区版的核心控制闭环不依赖商业账号。

## 首期目标

首期只验证一条完整闭环：

1. 在本地机器启动 Claude 或 Codex 会话。
2. 用浏览器完成配对。
3. 接收结构化流式事件。
4. 远程发送、暂停、继续或停止。
5. 预览并允许或拒绝工具请求。
6. 断线后回放缺失事件，不重复执行同一个操作。

原生手机应用、完整文件编辑器、云端执行和企业治理会在这个闭环可靠之后再做。

## 仓库结构

```text
apps/web/                 Web/PWA Projection
packages/operation-core/ SessionOperation 与状态转移
packages/protocol/       版本化命令与事件
packages/adapter-sdk/    Agent 能力与执行契约
packages/host/           本地进程与会话边界
docs/public/             公开架构和集成文档
```

## 参与贡献

Kaxu 目前处于早期阶段，架构、协议、Adapter、测试和文档贡献同样重要。开始前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [公开架构文档](docs/public/architecture.md)。

漏洞、凭据泄露和安全问题请按照 [SECURITY.md](SECURITY.md) 私下报告，不要创建公开 Issue。

## 许可证

Kaxu Community Edition 使用 GNU Lesser General Public License v3.0 only（`LGPL-3.0-only`）。详见 [LICENSE](LICENSE) 和 [NOTICE.md](NOTICE.md)。
