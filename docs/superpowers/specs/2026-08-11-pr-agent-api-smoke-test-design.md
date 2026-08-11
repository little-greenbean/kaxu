# PR-Agent API 冒烟测试设计

状态：待实现

关联 Issue：#14

## 目标

为 PR-Agent 使用的 OpenAI-compatible API 增加一个仅手动触发的诊断入口，区分以下失败阶段：

- Base URL 路径不可用
- Key 鉴权失败
- 模型未暴露
- `/chat/completions` 请求被策略拦截

诊断不执行代码审查，不改变自动 Review 行为。

## 方案

扩展现有 `.github/workflows/pr-agent.yml`，增加 `workflow_dispatch` 和独立的 `api-smoke-test` job。

手动运行时只执行诊断 job；PR 和 `/review` 事件只执行现有 `pr-agent` job。两个 job 通过事件条件隔离。

`workflow_dispatch` 接受一个非敏感的 `model` 输入，默认值为 `gpt-5.6-sol`。

## 请求流程

~~~text
手动触发
  -> 检查 OPENAI_KEY / OPENAI_API_BASE 是否存在
  -> GET {base}/models
  -> 检查目标 model 是否在标准 data[].id 中
  -> POST {base}/chat/completions
  -> 验证 HTTP 2xx 与 choices[0].message
  -> 输出阶段结果
~~~

`/models` 未列出目标模型时记录明确警告，但仍继续请求 `/chat/completions`，兼容不提供标准模型列表的代理服务。

## 安全边界

- 仅 `workflow_dispatch` 可触发，不响应 PR、push、评论或定时事件
- job 权限仅为 `contents: read`
- 不使用 `actions/checkout`
- Secret 只从 `OPENAI_KEY` 和 `OPENAI_API_BASE` 注入环境变量
- 不启用 shell trace，不打印 Key、Base URL、请求头、原始响应或模型回答
- 日志只显示请求阶段、HTTP 状态、结构化 `error.type` 和 `error.code`
- 缺少任一 Secret 时立即失败
- 每个请求设置连接超时和总超时

## 错误处理

- `/models` 非 2xx：输出 HTTP 状态和结构化错误标识，停止后续请求
- `/models` 非标准 JSON：记录响应结构异常并失败
- `/chat/completions` 非 2xx：输出 HTTP 状态和结构化错误标识并失败
- 返回 2xx 但缺少 `choices[0].message`：判定为不兼容响应并失败
- 网络错误或超时：由 `curl` 以非零状态终止 job

GitHub Action 的最终状态必须反映诊断结果，不能像当前 PR-Agent Action 一样在模型调用失败后仍显示成功。

## 验证

提交前：

- `pnpm check`
- YAML 解析
- `git diff --check`
- 检查 workflow 中不存在 Secret 回显和自动诊断触发器

合并后：

- 手动使用默认模型 `gpt-5.6-sol` 运行一次
- 根据 `/models` 和 `/chat/completions` 的独立状态确定失败阶段
- 确认日志未出现 Key、Base URL、响应正文或模型回答

## 不包含

- 不修改 Key 或 Base URL
- 不自动放行 IP 或绕过服务端安全策略
- 不保存 API 响应为 Artifact
- 不让诊断 job 发布 PR 评论
- 不修改 Kaxu runtime、protocol 或依赖
