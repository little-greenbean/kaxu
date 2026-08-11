# Draft PR Review 可靠性设计

状态：已确认设计，待实现

关联 Issue：#18

## 背景

当前 Kaxu review bot 只在 `ready_for_review` 时自动运行。Draft PR 创建或推送新提交时不会自动审查，只能由维护者评论 `/review` 补触发。

现有 review workflow 还包含一个仅供 `workflow_dispatch` 使用的 API smoke-test job，因此正常 review run 会显示一个无关的 `skipped` job。PR #9 的连续审查进一步暴露出模型调用没有重试：一次 HTTP 502 或网络错误就会让整次审查失败。

## 目标

- 可信 Draft PR 在创建、重新打开和每次新提交后自动审查。
- 同一 head SHA 的重复自动事件不重复调用模型。
- `/review` 始终可以显式重跑当前 SHA。
- 瞬时模型错误自动进行有限重试，永久错误继续 fail closed。
- review run 不再包含无关的 smoke-test job。
- 触发、去重和重试规则具备不调用真实模型的可执行测试。

## 非目标

- 不改变 Sol 规则审查、Sol 缺陷审查和 Terra 复核的职责。
- 不 checkout 或执行 PR 分支代码。
- 不自动将 Draft 转为 Ready，不自动合并或修改 PR 分支。
- 不扩大 GitHub Token 权限，不增加依赖。
- 不改变 Kaxu protocol、runtime、adapter、Host 或 Web 行为。

## 方案

保留现有最小 review bot，把可靠性规则拆成一个无副作用的 shell helper，由 workflow 和本地测试共同使用。

~~~text
PR / comment event
  -> event gate
  -> trusted base checkout
  -> automatic SHA dedupe
  -> existing review pipeline
       -> Sol rules request    -- retry transient errors
       -> Sol defects request  -- retry transient errors
       -> Terra judge request  -- retry transient errors
  -> one upserted result comment
~~~

### Workflow 划分

`.github/workflows/pr-agent.yml` 只负责代码审查：

- `pull_request_target`: `opened`, `reopened`, `synchronize`, `ready_for_review`
- `issue_comment`: `created`
- 同一 PR 使用一个 concurrency group，新 head SHA 取消旧审查
- 资格门步骤不注入模型 Secret
- 只有资格门通过后的 review 步骤获得 `OPENAI_KEY` 和 `OPENAI_API_BASE`

`.github/workflows/review-bot-smoke-test.yml` 只保留手动 API 探测：

- 仅 `workflow_dispatch`
- 不响应 PR、评论、push 或定时事件
- 不发布 PR 评论

### 事件资格

自动 review 允许以下来源：

- 同仓库 PR 分支
- 作者关联为 `OWNER`、`MEMBER` 或 `COLLABORATOR` 的 PR

手动 `/review` 只允许 `OWNER`、`MEMBER` 或 `COLLABORATOR` 评论触发。普通 Issue 评论、普通 PR 评论、Bot 评论和不可信 fork 请求都在 Secret 注入前结束。

Draft 状态不参与资格判断。Draft 与 Ready PR 使用同一套可信来源规则。

### SHA 去重

bot 评论隐藏标记增加明确状态：

~~~text
<!-- kaxu-review-bot sha=<head-sha> status=running -->
<!-- kaxu-review-bot sha=<head-sha> status=completed -->
<!-- kaxu-review-bot sha=<head-sha> status=failed -->
~~~

只有 `status=completed` 才能阻止同一 SHA 的后续自动 review。失败或被取消的审查不能把该 SHA 永久标记为已审查。手动 `/review` 绕过去重，允许维护者复查同一 SHA。

### 模型重试

每个 Sol / Terra 请求独立执行，最多尝试 3 次。第 1 次失败后等待 2 秒，第 2 次失败后等待 4 秒；第 3 次失败后终止该阶段。

可重试：

- curl 网络错误或超时
- HTTP 429
- HTTP 5xx

不可重试：

- 其他 HTTP 4xx
- HTTP 2xx 但响应结构不兼容
- HTTP 2xx 但模型内容为空

失败日志只保留阶段、尝试次数、HTTP 状态和脱敏错误类型，不输出 Key、Base URL、prompt 或响应正文。

## 安全边界

- `pull_request_target` workflow 只执行默认分支上的可信脚本。
- checkout 显式使用仓库默认分支，并设置 `persist-credentials: false`。
- PR 标题、描述、diff 和模型输出全部视为不可信数据，不作为 shell 代码执行。
- 权限维持 `contents: read`、`issues: write`、`pull-requests: write`。
- 资格门失败时不注入或访问模型 Secret。
- diff 为空或超过现有大小限制时继续 fail closed。

## 测试

新增 shell 测试覆盖：

- Draft 的 `opened`、`reopened`、`synchronize`、`ready_for_review` 均通过自动资格门
- 不可信 fork、Bot 和非 `/review` 评论被拒绝
- 已完成的相同 SHA 自动去重
- `failed` / `running` 标记不被视为已完成
- 手动 `/review` 可以重跑相同 SHA
- 网络错误、429 和 5xx 可重试
- 永久 4xx 与不兼容响应不可重试
- 重试次数上限为 3，退避为 2 秒和 4 秒

`pnpm check` 纳入该测试，并继续运行公开边界、typecheck 和现有 Vitest 测试。

## 验收

1. 本地 helper 测试、`pnpm check`、YAML 解析和 `git diff --check` 通过。
2. 设计和实现保持在 Issue #18 对应的小 PR 中。
3. 合并后用一个 Draft PR 新 SHA 验证自动 review。
4. 对同一 SHA 再触发一个自动事件，确认不重复调用模型。
5. 评论 `/review`，确认同一 SHA 可以手动复查。
6. review run 中不再出现 `OpenAI API smoke test` 的 `skipped` job。

## 回滚

回滚该 PR 即恢复原有 `ready_for_review` + `/review` 行为。smoke-test workflow 可独立恢复，不涉及业务数据迁移。
