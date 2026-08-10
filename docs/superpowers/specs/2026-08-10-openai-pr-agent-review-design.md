# Kaxu OpenAI PR-Agent Review 设计

状态：已确认

## 目标

将仓库的 PR Review 从 CodeRabbit 切换为自托管的 PR-Agent GitHub Action，使用仓库 Actions Secret 中的 OpenAI key，避免依赖 CodeRabbit 的托管 Review 队列和用量限制。

首期只解决一条 Review 闭环：

~~~text
PR 事件 -> GitHub Action -> PR-Agent -> OpenAI API -> PR 评论 / Review 结果
~~~

## 范围

包含：

- 使用 `the-pr-agent/pr-agent` 的固定版本 GitHub Action
- 使用 `OPENAI_KEY` Actions Secret，不在仓库中保存密钥
- 使用 `OPENAI_API_BASE` Actions Secret 注入 OpenAI-compatible API 的 base URL
- 自动 Review Draft 和普通 PR
- 在 PR 创建、重新打开、转为 Ready、同步新提交时触发 Review
- 支持在 PR 评论中手动发送 `/review`
- 中文 Review 输出
- 保留现有 `pnpm check` 仓库检查工作流
- 关闭 CodeRabbit 的自动 Review，避免重复评论和重复消耗

不包含：

- 不修改 Kaxu runtime、protocol 或 package 代码
- 不让 Review Agent 自动提交、push 或修改 PR 分支
- 不把 OpenAI key 写入 tracked file、Issue、PR 评论或日志
- 不引入新的运行时依赖
- 不修改分支保护规则

## 总体架构

~~~mermaid
flowchart LR
    Event[PR 事件] --> Action[GitHub Actions]
    Secret[OPENAI_KEY Secret] --> Agent[PR-Agent]
    Action --> Agent
    Agent -->|GitHub API 读取 diff| PR[Pull Request]
    Agent -->|OpenAI API| Model[OpenAI 模型]
    Model --> Agent
    Agent -->|中文摘要与 Review 评论| PR
~~~

Action 使用 `pull_request_target` 获取仓库 Secret，并且不 checkout PR 代码。PR-Agent 通过 GitHub API 读取 PR 元数据和 diff，因此外部 Fork 的不可信代码不会在持有 OpenAI key 的工作流中执行。

## 工作流设计

新增 `.github/workflows/pr-agent.yml`：

- `pull_request_target` 监听 `opened`、`reopened`、`ready_for_review`、`synchronize`
- `issue_comment` 监听手动 `/review` 命令
- `issue_comment` 只有在 `github.event.issue.pull_request` 存在时才运行，普通 Issue 评论直接跳过
- 忽略 Bot 发送的事件，避免 Review 评论触发自身循环
- 不添加 `actions/checkout`
- Action 固定到已验证的 PR-Agent `v0.41.0` release commit `570f67ed5fc8db5be74c18df070bc20079b64b0d`，避免使用可变的 `main`
- 自动 Review 仅启用 review，不启用自动 describe、improve、commit 或 push

权限遵循最小化原则：

- `contents: read`
- `issues: write`
- `pull-requests: write`

不授予 `contents: write`、部署权限或其他仓库写入权限。

## PR-Agent 配置

新增 `.pr_agent.toml`，只保存公开的非敏感配置：

~~~toml
[config]
model = "gpt-5.6-sol"
fallback_models = ["gpt-5.6-terra"]
response_language = "zh-CN"
publish_output = true
restricted_mode = true

[github_action_config]
auto_review = true
auto_describe = false
auto_improve = false
pr_actions = ["opened", "reopened", "ready_for_review", "synchronize"]
~~~

模型固定为 `gpt-5.6-sol`，失败时回退到 `gpt-5.6-terra`。后续模型调整只需修改 `.pr_agent.toml`，不需要修改 Secret 或工作流结构。

## CodeRabbit 迁移

- 将 `.coderabbit.yaml` 的 `reviews.auto_review.enabled` 和 `chat.auto_reply` 关闭，或在 CodeRabbit 控制台停用该仓库
- 现有 `pr-review-checks.yml` 不变，它只负责仓库检查
- 复用当前 Issue #10 / Draft PR #11 的 Review Bot 任务，但把实现替换为 PR-Agent
- 不将历史 CodeRabbit pending 状态当作新方案的验收条件

仓库外的操作：管理员在 GitHub 仓库设置中创建：

~~~text
Settings -> Secrets and variables -> Actions -> New repository secret
Name: OPENAI_KEY
Value: 用户自己的 OpenAI API key
Name: OPENAI_API_BASE
Value: 用户自己的 OpenAI-compatible API base URL
~~~

## 失败处理与安全

- `OPENAI_KEY` 缺失或 OpenAI API 返回错误时，工作流失败并保留清晰的 Action 日志，不输出密钥内容
- GitHub Token 权限不足时，工作流失败，不降级为修改代码或推送分支
- PR-Agent 只发布 Review 评论，不执行 Agent 操作，不拥有 Kaxu 业务状态
- 任何来自 PR 的代码都不在 `pull_request_target` 工作流中执行
- Secret 只通过 GitHub Actions Secret 注入，不写入配置文件、文档、Issue 或 PR body

## 验收标准

- Draft PR 创建或同步后，PR-Agent 能使用 `OPENAI_KEY` 发起 Review
- 普通 PR 转为 Ready 后，PR-Agent 能发起 Review
- PR 评论 `/review` 能触发一次手动 Review
- Review 输出为中文，并发布到 PR 评论或 inline review
- CodeRabbit 不再对新 PR 自动发起 Review
- `pnpm check`、YAML/TOML 语法检查和 `git diff --check` 通过
- Git 历史和 tracked files 中不存在任何真实 API key
- Review 工作流不具备修改代码、push 或部署权限

## 实现顺序

~~~text
停用 CodeRabbit 自动 Review
  -> 添加 PR-Agent 配置
  -> 添加最小权限 GitHub Action
  -> 配置 OPENAI_KEY Secret（仓库外）
  -> 运行仓库检查与配置校验
  -> 合并配置 PR
  -> 用下一张 Draft PR 做一次真实 Review 验证
~~~

配置 PR 自身无法验证新工作流，因为 `pull_request_target` 只会加载默认分支上的工作流定义。配置进入默认分支后，再由下一张 PR 验证自动 Review 和手动 `/review`。
