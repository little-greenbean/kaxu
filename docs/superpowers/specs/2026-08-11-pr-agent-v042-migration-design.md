# PR-Agent v0.42.0 迁移设计

状态：已确认设计，待实现

关联 Issue：#18

## 背景

Kaxu 当前维护一套仓库内 review bot，包括事件过滤、diff 收集、两路 Sol 审查、Terra 复核、评论更新和 API smoke test。这套实现重复了成熟开源项目已有的能力，并在 PR #9 上连续遇到模型请求失败。

本次迁移删除自建审查管线，改用 [`The-PR-Agent/pr-agent`](https://github.com/The-PR-Agent/pr-agent) 官方 GitHub Action。仓库只保留 Kaxu 自己的触发策略与最小配置。

## 目标

- 使用官方 PR-Agent 执行自动和手动代码审查。
- Draft PR 创建或推送新提交后能够自动审查。
- 输出中文，并读取 `AGENTS.md` 与 `current_project.md`。
- 模型与 Provider 由用户后续配置，不沿用旧的自定义 Base URL 和模型组合。
- PR-Agent 调用失败时让 Action 明确失败。
- 删除自建模型编排与 smoke-test job。

## 非目标

- 不保留自建 prompt、Sol / Terra 分工、重试脚本或评论格式。
- 不自动运行 `/describe`、`/improve`、提交代码、转 Ready 或合并。
- 不 checkout 或执行 PR 分支代码。
- 不修改协议或业务代码。
- 不在仓库中保存任何 API Key。

## 依赖选择

使用 PR-Agent `v0.42.0` 对应提交：

~~~text
f6af7d77554ff8d26adffded077e6461329e92fa
~~~

workflow 固定到提交 SHA，不使用可变的 `main`。PR-Agent 的 Action 定义仍引用官方维护的 `pragent/pr-agent:github_action` 镜像，这是采用官方 Action 时保留的上游供应链风险；升级只能通过单独 PR 完成。

许可证为 MIT，与 Kaxu 的 LGPL-3.0-only 仓库兼容。

## 文件变化

### `.github/workflows/pr-agent.yml`

保留一个官方 Action job：

- `pull_request_target`: `opened`, `reopened`, `ready_for_review`, `synchronize`
- `issue_comment`: `created`
- 自动触发只允许同仓库分支，或作者关联为 `OWNER`、`MEMBER`、`COLLABORATOR`
- `/review` 只允许 `OWNER`、`MEMBER`、`COLLABORATOR` 评论触发
- 忽略 Bot 事件
- 不使用 `actions/checkout`
- 权限为 `contents: read`、`issues: write`、`pull-requests: write`
- 同一 PR 新事件取消仍在运行的旧审查

Action 环境只注入：

~~~text
GITHUB_TOKEN
OPENAI_KEY
github_action_config.auto_review=true
github_action_config.auto_describe=false
github_action_config.auto_improve=false
github_action_config.pr_actions=[opened,reopened,ready_for_review,synchronize]
~~~

不再注入 `OPENAI_API_BASE`，也不在 workflow 中指定模型。

### `.pr_agent.toml`

只覆盖仓库级行为：

- `response_language = "zh-CN"`
- `restricted_mode = true`
- `propagate_tool_errors = true`
- `repo_context_files = ["AGENTS.md", "current_project.md"]`
- `repo_context_from_default_branch = true`
- `publish_output = true`
- review 使用持久评论并保留无问题结论

模型字段故意不填写。用户选择模型后，在 `[config]` 中增加相应配置，例如：

~~~toml
model = "gpt-5.6"
fallback_models = ["gpt-5.6-terra"]
~~~

Provider 所需 Secret 或环境变量按照 PR-Agent 官方文档配置，不进入 tracked files。

### 自建 bot

删除 `.github/workflows/pr-agent.yml` 中的自建 curl、prompt、模型并发、Terra 复核、评论 upsert 和 API smoke-test 逻辑。历史设计文档保留，用于解释已有提交，不再代表当前实现。

## 数据流

~~~text
可信 PR 事件或维护者 /review
  -> GitHub Actions
  -> 固定版本 PR-Agent Action
  -> GitHub API 读取 PR 元数据与 diff
  -> 读取默认分支 AGENTS.md / current_project.md
  -> 用户配置的模型 Provider
  -> PR-Agent 发布中文持久 Review 评论
~~~

## 安全边界

- `pull_request_target` 能访问 Secret，但不 checkout PR 代码。
- PR 标题、描述和 diff 只作为不可信模型输入，不作为命令执行。
- `restricted_mode` 禁止需要更高仓库权限的操作。
- 外部 fork 不自动消耗模型额度，必须由维护者评论 `/review`。
- `OPENAI_KEY` 只来自 GitHub Actions Secret。
- 旧的 `OPENAI_API_BASE` Secret 可以保留在仓库设置中，但 workflow 不读取它。

## 错误处理

PR-Agent 使用自身的模型调用、fallback 和错误处理。`propagate_tool_errors = true` 确保最终失败传递给 GitHub Actions，不能把未完成审查显示为成功。

本仓库不再为 PR-Agent 包装额外重试。上游行为不满足要求时，先升级固定版本或向上游提交问题，不重新扩展自建审查层。

## 验证

提交前：

- 使用 YAML parser 验证 workflow 语法
- 使用 TOML parser 验证 `.pr_agent.toml`
- `pnpm check`
- `git diff --check`
- 检查 workflow 不含 `OPENAI_API_BASE`、checkout 和自建模型请求
- 检查 Action 固定到 `f6af7d77554ff8d26adffded077e6461329e92fa`

合并后：

1. 在仓库 Actions Secret 中设置所选 Provider 需要的 Key；默认 OpenAI 使用 `OPENAI_KEY`。
2. 创建 Draft PR，确认 `opened` 自动触发 `/review`。
3. 推送新提交，确认 `synchronize` 再次触发审查。
4. 评论 `/review`，确认维护者可以手动复查。
5. 制造一次无效模型配置，确认 Action 失败；恢复配置后重新验证。

配置 PR 自身无法验证新 workflow，因为 `pull_request_target` 使用默认分支上的 workflow。真实自动审查必须在本 PR 合并后的下一张 Draft PR 验证。

## 使用方式

- 自动：创建或更新可信 Draft / Ready PR，无需额外操作。
- 手动：在 PR 评论 `/review`。
- 修改模型：编辑 `.pr_agent.toml` 的 `[config]` 模型字段，并按官方文档设置对应 Secret。
- 临时参数：在命令后附加 PR-Agent 支持的参数，例如 `/review -i` 进行增量审查。

## 回滚

回滚迁移 PR 即恢复上一版自建 workflow。该变更不迁移业务数据，也不修改 PR 分支内容。
