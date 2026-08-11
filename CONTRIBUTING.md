# Contributing to Kaxu

Kaxu welcomes focused contributions to the operation model, protocol, adapters, host, Web projection, documentation, and tests.

## Before opening code

1. Search existing issues and discussions.
2. For protocol or architecture changes, open a design discussion first.
3. Keep provider-specific behavior inside an adapter.
4. Do not make a client call an Agent provider directly.
5. Keep one `operationId` across the entire lifecycle.

## Development principles

- Commands represent intent; events represent immutable facts.
- Core state transitions must be deterministic and testable without a real Agent.
- Clients are projections of the protocol, not owners of business state.
- Capabilities are declared through `CapabilityManifest`, not provider-name checks.
- New dependencies must have a compatible open-source license.

## Pull requests

A pull request should:

- solve one coherent problem;
- include tests proportional to the behavior changed;
- update public documentation when contracts change;
- pass the public-boundary check;
- avoid generated files and unrelated formatting churn;
- explain any compatibility or migration impact.

## Automated review

Kaxu uses the open-source PR-Agent GitHub Action for automated code review.

- Trusted Draft and Ready PRs are reviewed when opened, reopened, marked ready, or updated with new commits.
- A repository owner, member, or collaborator can comment `/review` to run another full review.
- Use `/review -i` for an incremental review of changes since the previous review.
- Repository review settings live in `.pr_agent.toml`; model selection is currently omitted so it can be configured separately.
- The default OpenAI path reads `OPENAI_KEY`. Other Providers require their documented model prefix and Secret environment mapping in the workflow.
- Provider credentials belong in GitHub Actions Secrets. Never put a Key in a PR, Issue, workflow, or tracked configuration file.

Changes to the workflow or `.pr_agent.toml` take effect after they reach the default branch because `pull_request_target` loads its workflow from that trusted branch.

By contributing, you agree that your contribution is licensed under the repository's `LGPL-3.0-only` license unless a file explicitly says otherwise.
