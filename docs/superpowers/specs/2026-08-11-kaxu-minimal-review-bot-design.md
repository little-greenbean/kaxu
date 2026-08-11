# Kaxu 最小 Review Bot 设计

状态：已确认设计，待实现

关联 Issue：#16

## 背景

现有 PR-Agent 在真实 review 请求上持续返回 "Your request was blocked"，但同一套 OPENAI_KEY / OPENAI_API_BASE 对应的最小冒烟请求已验证可用。
这说明问题不在 key、base URL 或模型可达性，而在 PR-Agent 的复杂 review 请求形态。

本设计把 review 层压缩成仓库内的最小流程，保留同一套 OpenAI-compatible API，但去掉 PR-Agent 的大 prompt、历史上下文和多余分支。

## 目标

- 单条汇总评论，不刷多条 review thread。
- 使用 gpt-5.6-sol 做深度审查，gpt-5.6-terra 做复核和成稿。
- 只读 PR diff 和仓库公开上下文，不 checkout 代码。
- 进度可见，但只更新同一条评论。
- 失败时 fail closed，不输出 key、base URL 或原始模型响应。

## 非目标

- 不做 git blame。
- 不拉取历史 PR 评论。
- 不做分支 checkout。
- 不做 build / test / typecheck。
- 不做多条 inline review。
- 不引入新依赖。

## 流程

| 阶段 | 实现 | 说明 |
|---|---|---|
| 1. 资格检查 | shell / GitHub API | 检查 PR 是否 open、未 merged、触发者是否可信 |
| 2. 上下文收集 | shell / GitHub API | 读取 PR 标题、描述、diff，以及根目录 AGENTS.md、current_project.md |
| 3A. 规则审查 | gpt-5.6-sol | 审查架构约束、协议约束、注释约束、公开仓库边界 |
| 3B. 缺陷审查 | gpt-5.6-sol | 只找改动里的明确 bug、回归、兼容性和安全问题 |
| 4. 评分与成稿 | gpt-5.6-terra | 去重、评分、过滤低置信度问题，并生成最终中文评论 |
| 5. 发布 | shell / GitHub API | 更新同一条带隐藏标记的评论 |

## 模型分工

- sol 负责“看得深”：两个并行视角。
- terra 负责“收得住”：过滤、排序、定稿。

两个 sol 视角不重叠：

1. 规则 / 契约视角：只看 AGENTS.md、current_project.md 和 diff，检查是否违反仓库硬约束。
2. 缺陷视角：只看 diff 和局部上下文，扫描明确 bug、回归、错误处理缺口和兼容性问题。

## 过滤规则

- 只保留评分 >= 80 的问题。
- 最多保留 5 条，按严重度和置信度排序。
- 不报已有问题、不报 lint / typecheck 会自动发现的问题、不报一般性测试/文档建议。
- 只报改动直接相关的问题，不追线外的老问题。

## 输出格式

最终评论只输出一条，内容固定为：

~~~text
## Kaxu Code Review

结论：通过 / 需要修改 / 阻塞

结论映射：

- 没有保留的问题：通过
- 只有 P2/P3：需要修改
- 至少一个 P0/P1：阻塞

### P1 · 92 分
path/to/file.ts:42

标题

证据：...
影响：...
建议：...

### 审查范围
规则审查、缺陷审查、Terra 复核
未执行 build、test 或 typecheck，由 CI 独立负责
~~~

无问题时只输出：

~~~text
结论：未发现阻塞问题
~~~

## 进度展示

始终更新同一条带 kaxu-review-bot 隐藏标记的评论，评论顶部保留一个简单的进度区：

~~~text
## Kaxu Code Review

- [x] 资格与上下文
- [ ] Sol：规则审查
- [ ] Sol：缺陷审查
- [ ] Terra：评分与成稿
- [ ] 发布结果
~~~

如果某一步失败，只更新这一条评论里的状态和失败阶段，不新增额外通知。

## 触发条件

- 自动触发：ready_for_review。
- 手动触发：/review。
- 自动触发只允许同仓库分支，或作者关联为 OWNER、MEMBER、COLLABORATOR；来自 fork 的 PR 需要维护者手动触发。
- 只允许 OWNER、MEMBER、COLLABORATOR 触发手动 review。
- draft PR 默认跳过自动 review；手动 /review 可显式重跑。

## 安全边界

- 不 checkout PR 代码。
- 不打印 key、base URL、原始响应、模型全文。
- 不在日志里展开完整 prompt。
- 超大 diff 直接 fail closed，提示拆分 PR，不做半截审查。
- workflow 只保留必要权限：contents: read、issues: write、pull-requests: write。

## 验证

- 先用现有 smoke test 确认 sol / terra 都能正常请求 API。
- 再在一个小 PR 上验证：
  - 进度评论会更新
  - 最终只留下 1 条 review 评论
  - 失败时只暴露阶段名和脱敏错误
- 由于本改动只动 workflow 和 spec，不需要运行时单测。
