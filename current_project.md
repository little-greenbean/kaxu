# Current Project — Kaxu

This file is the single source of truth for project governance and current state. Read it before writing code, adding a dependency, changing architecture, or creating a file at the repository root.

> 本文件是项目治理和当前状态的唯一事实源。写代码、添加依赖、修改架构或在仓库根目录创建文件前必须先阅读。

Do not duplicate these rules in another governance file.

---

## 1. Project / 项目

- Name: Kaxu
- Positioning: Run locally. Control from anywhere. Keep the operation intact.
- Goal: an open control plane that turns local AI coding Agent sessions into cross-device, resumable, auditable, and extensible work units
- Model: Open Core
- License: LGPL-3.0-only
- Initialized: 2026-08-04
- Current state: pre-implementation architecture stage with shared TypeScript, Vitest, and Zod tooling

The repository currently has no runtime source beyond scripts/check-public-boundary.sh. The four packages and one app are placeholders with package metadata and intent documentation only.

> 当前除 scripts/check-public-boundary.sh 外没有运行时源码。4 个包和 1 个应用只有包元数据及意图说明，不能视为已交付能力。

---

## 2. Hard constraints / 硬约束

### 2.1 Public repository boundary / 公开仓库边界

This repository is public. Never commit or quote into tracked files anything from:

~~~text
docs/internal/
commercial/
kaxu-commercial/
*.internal.md
*.private.md
~~~

The following secret-like files also fail the public boundary check:

~~~text
.env
.env.*
id_rsa
id_ed25519
*.pem
*.p12
*.pfx
*.key
~~~

Before creating any root file, confirm its contents may be public. The boundary script scans git ls-files, so stage intended files before the final pnpm check.

### 2.2 Dependency direction / 依赖方向

~~~text
apps                 -> protocol      -> operation-core
host                 -> adapter-sdk   -> protocol
provider adapters    -> adapter-sdk
transport / storage  -> ports defined by the core
~~~

packages/operation-core must not import Provider SDKs, UI frameworks, network transports, or storage engines. It must be testable without a real Agent.

### 2.3 Operation model / 操作模型

- Clients never call Claude, Codex, or another Provider directly.
- One operationId spans the full lifecycle of an action.
- Commands express intent and may be denied.
- Events are immutable facts, ordered within a session, and replayable.
- Core state transitions are deterministic.
- Clients are protocol projections and do not own business state.
- Features are gated by CapabilityManifest, never by Provider name.
- Consumers are idempotent.
- Replay preserves eventId, operationId, and sequence.
- Unknown optional fields do not break older clients.
- Provider-specific payloads stay in Adapter-owned extensions.
- Security-sensitive defaults fail closed when trust cannot be verified.

### 2.4 Protocol stability / 协议稳定性

Types in docs/public/protocol.md are explanatory. They are not a stable wire contract until packages/protocol ships executable schemas and contract tests.

Do not build external integrations against the explanatory types or describe them as stable.

---

## 3. Repository / 仓库

~~~text
kaxu/
├── apps/
│   └── web/                     # Web/PWA Projection placeholder
├── packages/
│   ├── operation-core/          # deterministic SessionOperation core
│   ├── protocol/                # versioned command/event schemas
│   ├── adapter-sdk/             # Agent capability and execution contracts
│   └── host/                    # local process and session boundary
├── examples/                    # placeholder examples
├── docs/
│   ├── public/                  # public architecture and protocol docs
│   └── internal/                # ignored confidential material
├── scripts/
│   └── check-public-boundary.sh
├── .github/
├── .pr_agent.toml              # PR-Agent repository review settings
├── AGENTS.md                    # points Agents to this file
├── current_project.md           # governance and current state
├── package.json
└── pnpm-workspace.yaml
~~~

### Entry points

- Development entry: none
- Runtime entry: none
- Current executable check: pnpm check

Placeholder READMEs describe intent, not working behavior.

---

## 4. Tech stack / 技术栈

| Item | Value | Status |
|---|---|---|
| Package manager | pnpm 9.15.0, pinned with packageManager | Confirmed |
| Runtime | Node.js 22.12 or newer | Confirmed for the shared toolchain |
| Repository | Monorepo: apps/*, packages/*, examples/* | Confirmed |
| License | LGPL-3.0-only | Confirmed |
| Language | TypeScript | Confirmed; strict root typecheck |
| Schema library | Zod 4.4.3 | Confirmed in @kaxu/protocol |
| Build tool | Not selected | Pending |
| Test framework | Vitest 4.1.10 | Confirmed; root test command |
| PR review | PR-Agent v0.42.0 GitHub Action, pinned by commit | Confirmed |
| Linter / formatter | None beyond .editorconfig | Pending |

New dependencies must have compatible open-source licenses and pinned versions rather than open ranges.

---

## 5. Commands / 命令

| Command | Purpose |
|---|---|
| pnpm install | Install dependencies |
| pnpm typecheck | Run the strict root TypeScript check |
| pnpm test | Run the Vitest test suite |
| pnpm check | Run all currently defined checks |
| pnpm check:public-boundary | Run scripts/check-public-boundary.sh |

dev, build, lint, and format are not defined. Do not reference them in documentation or CI until they exist.

When the first real toolchain is introduced, update this section and the change log in the same PR.

---

## 6. Style and naming / 风格与命名

Confirmed:

- 2-space indentation
- UTF-8
- LF line endings, except .bat uses CRLF
- final newline
- trim trailing whitespace, except Markdown soft line breaks

Defaults until a formatter lands:

- double quotes
- no semicolons
- prefer type for data shapes
- prefer interface for behavioral contracts

| Scope | Convention | Example |
|---|---|---|
| Directories and files | kebab-case | operation-core |
| Packages | @kaxu/kebab-case, private true | @kaxu/adapter-sdk |
| Types and interfaces | PascalCase | SessionOperation |
| Fields and functions | camelCase | operationId |
| Lifecycle states | lowercase, one word | requested |
| Capabilities | lowercase dotted | session.create |
| Localized docs | .zh-CN suffix | README.zh-CN.md |

---

## 7. Domain model / 领域模型

The smallest reusable unit is SessionOperation:

~~~text
SessionOperation = actor + session + target + action + policy + state + result

requested -> waiting -> approved -> running -> completed
                                      \-> failed / cancelled
~~~

Core abstractions:

- SessionOperation: canonical state carrier
- OperationCommand: deniable intent
- OperationEvent: immutable ordered fact
- OperationPolicy: allow, deny, or await approval
- CapabilityManifest: Adapter capability declaration
- Projection: client or consumer view with no business ownership

Extension model:

~~~text
New Agent        = AgentAdapter + CapabilityManifest
New client       = Projection + OperationCommand dispatch
New feature      = Command + Event + Policy
New consumer     = OperationEvent subscription
New foundation   = implementation behind an existing Port
~~~

Public detail:

- docs/public/architecture.md
- docs/public/protocol.md
- docs/public/adapters.md

---

## 8. First MVP / 首期范围

One complete control loop:

1. Start or discover a local Claude or Codex session.
2. Pair a browser with the Host.
3. Receive structured streaming events.
4. Send, pause, continue, and stop remotely.
5. Preview and approve or deny tool requests.
6. Replay missing events after reconnect without executing an operation twice.

Explicitly deferred:

- native mobile apps
- full file editor
- cloud execution
- enterprise governance
- multi-Agent orchestration

Do not add scaffolding for deferred features.

---

## 9. Working in the current repository / 当前工作方式

- Do not assume a build, test, lint, dev, or format command exists.
- Introduce one coherent toolchain choice at a time.
- Architecture and protocol changes require a public design discussion before code.
- Keep changes scoped and avoid unrelated formatting churn.
- Add tests proportional to changed behavior.
- Core transitions must be testable without a real Agent.
- Update docs/public when a public contract changes.
- Record directory, command, stack, or milestone changes in this file.
- Never post security issues publicly; follow SECURITY.md.
- Do not commit unless explicitly asked.
- Never push directly to main.

---

## 10. Open tasks / 待办

### Tooling

- [ ] Select a build tool.
- [ ] Select a linter and formatter.
- [ ] Extend pnpm check with lint when a linter is selected.
- [ ] Add examples/package.json so examples participates in the workspace.

### Implementation

- [ ] packages/operation-core: SessionOperation and deterministic transitions.
- [ ] packages/protocol: executable schemas and contract tests.
- [ ] packages/adapter-sdk: AgentAdapter, errors, backpressure, conformance suite.
- [ ] packages/host: local process and session boundaries.
- [ ] apps/web: pairing, session projection, approvals, reconnect and replay.

### Documentation

- [ ] Complete docs/public/self-hosting.md with topology, keys, upgrades, backup, and safe defaults.

---

## 11. Change log / 变更记录

| Date | Change |
|---|---|
| 2026-08-11 | Replaced the repository-owned review pipeline with pinned PR-Agent v0.42.0 configuration. |
| 2026-08-10 | Added the first shared TypeScript, Vitest, and Zod toolchain; pnpm check now runs boundary, type, and test checks. |
| 2026-08-10 | Consolidated governance and current state into current_project.md; AGENTS.md now points here. |
| 2026-08-05 | Initialized the architecture-stage project state and open task list. |
