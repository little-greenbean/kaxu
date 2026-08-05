# CLAUDE.md

Guidance for AI coding agents working in this repository. Read this before writing code, adding a package, or creating a file at the repository root.

> 面向 AI 编程 Agent 的约束文件。动手写代码、加包、在仓库根目录建文件之前先读这份。

Companion document: [`current_project.md`](current_project.md) holds volatile state — directory layout, entry points, milestone scope, and the open task list. This file holds rules that rarely change. When a fact appears in both, `current_project.md` wins.

> 配套文档 `current_project.md` 存易变内容(目录结构、入口、里程碑范围、待办)。本文件存几乎不变的规则。事实类信息若两处都有,以 `current_project.md` 为准。

---

## 1. Hard constraints / 硬约束

Violating any of these breaks the project's core contract or leaks confidential material. Treat them as non-negotiable.

> 违反以下任何一条会破坏核心契约或泄露机密材料,视为不可协商。

### 1.1 Public repository boundary / 公开仓库边界

**This repository is public.** Never commit, and never quote into a tracked file, anything from:

> **这个仓库是公开的。** 以下路径的内容既不能提交,也不能被引用进任何被跟踪的文件:

```text
docs/internal/     commercial/     kaxu-commercial/     *.internal.md     *.private.md
```

These paths hold internal material. They are gitignored and enforced by `scripts/check-public-boundary.sh` on every push and pull request. Files matching `.env`, `.env.*`, `id_rsa`, `id_ed25519`, `*.pem`, `*.p12`, `*.pfx`, `*.key` fail the same check.

**Before creating any file at the repository root, confirm its contents may be public.** Root files are tracked by default. The boundary script only scans `git ls-files`, so an untracked file passes the check without being inspected — stage it, then re-run `pnpm check`.

> **在仓库根目录新建任何文件前,先确认内容可以公开。** 根目录文件默认被跟踪。边界脚本只扫 `git ls-files`,未跟踪的文件不会被检查 —— 先 `git add`,再跑 `pnpm check`。

### 1.2 Dependency direction / 依赖方向

```text
apps                 -> protocol      -> operation-core
host                 -> adapter-sdk   -> protocol
provider adapters    -> adapter-sdk
transport / storage  -> ports defined by the core
```

`packages/operation-core` must not import provider SDKs, UI frameworks, network transports, or storage engines. It has to be testable with no real Agent present.

> `operation-core` 不得 import provider SDK、UI 框架、网络传输库、存储引擎,必须能在没有真实 Agent 的情况下测试。

### 1.3 Operation model / 操作模型

- A client must never call Claude, Codex, or any Agent provider directly. Provider behavior is normalized by an adapter first.
- One `operationId` spans the entire lifecycle. An adapter must not mint a second identifier for the same action.
- Commands express intent and may be denied; events are immutable facts. Do not blur the two.
- Core state transitions must be deterministic.
- Clients are projections of the protocol. They do not own business state.
- Gate features on `CapabilityManifest`. **Never branch on a provider name.**
- Events are ordered within a session; consumers must be idempotent. Replay preserves the original `eventId`, `operationId`, and `sequence`.
- Unknown optional fields must not break older clients. Provider-specific payloads live in adapter-owned extension fields.
- Security-sensitive defaults fail closed when the host, policy engine, or trusted device cannot be verified.

> 逐条中文:客户端**不得**直接调用任何 Agent provider,必须先经 adapter 归一化。同一个动作全程只有一个 `operationId`,adapter 不得另建标识。Command 表达意图(可被拒绝),Event 表达不可变事实,两者不可混用。核心状态转移必须确定性。客户端是协议的 Projection,不持有业务状态。能力判断走 `CapabilityManifest`,**禁止**按 provider 名称做分支。Event 在会话内有序,消费者必须幂等,回放保留原始 `eventId` / `operationId` / `sequence`。未知可选字段不得破坏旧客户端,provider 专属载荷放 adapter 拥有的扩展字段。安全敏感默认值在 host / policy engine / 可信设备无法验证时必须 fail closed。

### 1.4 Protocol stability / 协议稳定性

The types in `docs/public/protocol.md` are **explanatory**. They are not a stable wire contract until executable schemas and contract tests ship from `packages/protocol`. Do not build external integrations against them, and do not describe them as stable in documentation.

> `protocol.md` 里的类型是**解释性**的,在可执行 schema 与契约测试发布前不是稳定 wire contract。不要据此做外部集成,也不要在文档里称其稳定。

---

## 2. Working in a pre-implementation repository / 零源码状态下的工作方式

The runtime is not implemented yet. See `current_project.md` for exactly what exists today.

> 运行时尚未实现,当前具体状态见 `current_project.md`。

- Do not assume a build, test, or lint command exists. Section 4 lists what actually runs.
- When introducing the first real tooling, add its command to section 4 and record the choice in `current_project.md`.
- Architecture and protocol contributions are as valuable as code at this stage. For protocol or architecture changes, open a design discussion before writing code (see [`CONTRIBUTING.md`](CONTRIBUTING.md)).
- Placeholder READMEs describe intent, not shipped behavior. Do not cite them as evidence that something works.

> 不要假设存在 build / test / lint 命令,第 4 节列的才是真能跑的。引入第一个真实工具链时,把命令加进第 4 节并在 `current_project.md` 记录选择。当前阶段架构和协议贡献与代码同等重要,协议或架构改动先开设计讨论再写代码。占位 README 描述的是意图而非已实现行为,不要引用它们证明某功能可用。

---

## 3. Tech stack / 技术栈

| Item | Value | Status |
|---|---|---|
| Package manager | pnpm 9.15.0, pinned via `packageManager` | Confirmed |
| Repository shape | Monorepo; workspace globs `apps/*`, `packages/*`, `examples/*` | Confirmed |
| License | `LGPL-3.0-only`, root and every subpackage | Confirmed |
| Language | TypeScript | Not yet configured; doc samples are TS |
| Build tool | Not selected | Pending |
| Test framework | Not selected | Pending |
| Linter / formatter | None beyond `.editorconfig` | Pending |

Pending items are tracked in `current_project.md`. New dependencies must carry a compatible open-source license; pin versions rather than using open ranges.

> Pending 项的待办清单在 `current_project.md`。新增依赖必须使用兼容的开源许可证,锁定版本而不是开放区间。

---

## 4. Commands / 命令

| Command | Purpose |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm check` | Run all checks (currently the boundary check only) |
| `pnpm check:public-boundary` | Public boundary check; equals `bash scripts/check-public-boundary.sh` |

`dev`, `build`, `test`, `lint`, and `format` are **not defined**. Do not reference them in documentation or CI. The boundary script requires `rg` (ripgrep) and a git working tree.

> `dev` / `build` / `test` / `lint` / `format` **尚未定义**,不要在文档或 CI 里凭空引用。边界脚本依赖 `rg`(ripgrep)和 git 工作树。

---

## 5. Style and naming / 代码风格与命名

Confirmed by `.editorconfig` and `.gitattributes`:

- Indent with 2 spaces; UTF-8; LF line endings (`.bat` uses CRLF)
- Keep a final newline; trim trailing whitespace, **except in Markdown** where it is preserved for soft line breaks

Inferred from the samples in `docs/public/`. Adopt as defaults; revisit when a formatter lands:

- Double quotes, no semicolons
- Prefer `type` for data shapes, `interface` for behavioral contracts
- Line width unspecified

> 前一组由 `.editorconfig` / `.gitattributes` 确认:2 空格缩进、UTF-8、LF 换行(`.bat` 用 CRLF)、保留末尾空行、去除行尾空格但 **Markdown 例外**(保留用于软换行)。后一组从 `docs/public/` 示例代码推断,作为默认值,引入 formatter 时再定。

| Scope | Convention | Example |
|---|---|---|
| Directories, files | kebab-case | `operation-core`, `check-public-boundary.sh` |
| Package names | `@kaxu/<kebab-case>`, `private: true` | `@kaxu/adapter-sdk` |
| Types, interfaces | PascalCase | `SessionOperation`, `CapabilityManifest` |
| Fields, functions | camelCase | `operationId`, `getCapabilities` |
| Lifecycle states | lowercase, single word | `requested`, `waiting`, `cancelled` |
| Capability identifiers | lowercase dotted | `session.create`, `tool.approve` |
| Localized docs | `.zh-CN` suffix | `README.zh-CN.md` |

---

## 6. Domain model / 领域模型

The smallest reusable unit is `SessionOperation`: an actor performs an action on a target inside a session, producing a traceable state transition.

> 最小可复用单元是 `SessionOperation`:一个参与者在某个会话中对某个目标执行一个动作,产生可追踪的状态变化。

```text
SessionOperation = actor + session + target + action + policy + state + result

requested -> waiting -> approved -> running -> completed
                                      \-> failed / cancelled
```

Key abstractions: `SessionOperation` (state carrier), `OperationCommand` (intent, deniable), `OperationEvent` (immutable fact, ordered and replayable), `OperationPolicy` (allow / deny / await approval), `CapabilityManifest` (adapter capability declaration), `Projection` (per-surface rendering, owns no business state).

Extension model — stay inside these five shapes:

> 扩展模型,只走这五种形态:

```text
New Agent        = AgentAdapter + CapabilityManifest
New client       = Projection + OperationCommand dispatch
New feature      = Command + Event + Policy
New consumer     = OperationEvent subscription
New foundation   = implementation behind an existing Port
```

Full detail: [`docs/public/architecture.md`](docs/public/architecture.md), [`docs/public/protocol.md`](docs/public/protocol.md), [`docs/public/adapters.md`](docs/public/adapters.md).

---

## 7. Working agreements / 协作约定

- Read [`current_project.md`](current_project.md) for current layout, milestone scope, and open tasks before starting work.
- Solve one coherent problem per change. Avoid unrelated formatting churn and generated files.
- Include tests proportional to the behavior changed. Core transitions must be testable without a real Agent.
- Update `docs/public/` when a contract changes, and note compatibility or migration impact.
- Keep `current_project.md` current when directory structure or global commands change. Append a row to its change log.
- Never post security issues as public issues; follow [`SECURITY.md`](SECURITY.md).
- Do not commit unless explicitly asked. Never push directly to `main`.

> 开工前先读 `current_project.md`。一次改动解决一个问题,避免无关格式变动和生成文件。测试量与改动的行为相称,核心状态转移必须能在无真实 Agent 时测试。契约变更时同步更新 `docs/public/` 并说明兼容性影响。目录结构或全局命令变化时更新 `current_project.md` 并追加变更记录。安全问题不得作为公开 issue 提交,按 `SECURITY.md` 私下报告。未经明确要求不要提交,不要直接推送到 `main`。

---

## 8. Out of scope / 明确不做

Kaxu is not another cloud IDE. Deferred until the first control loop is reliable: native mobile apps, a full file editor, cloud execution, enterprise governance. Do not add scaffolding for these.

> Kaxu 不做云端 IDE。原生手机应用、完整文件编辑器、云端执行、企业治理都推迟到首期闭环可靠之后,不要为它们提前搭骨架。
