# PR-Agent compatible endpoint and push-review reliability design

Status: awaiting user review

Related Issue: #20

## Problem

PR-Agent run `31463267201` loaded the repository settings but sent the configured Key to the official OpenAI endpoint. The request returned HTTP 401 because the workflow no longer forwards the OpenAI-compatible Base URL.

The same run exposed a second problem. The `synchronize` event invokes `push_commands = ["/review -i"]`; PR-Agent sends commands through `PRAgent.handle_request`, which catches tool exceptions and returns `false`. GitHub Actions therefore reported success even though both model attempts failed and no review was published.

## Decision

Use only supported PR-Agent configuration:

- map Actions Secret `OPENAI_API_BASE` to `OPENAI.API_BASE`;
- keep the existing `OPENAI_KEY` Secret mapping;
- include `synchronize` in `github_action_config.pr_actions`;
- remove `handle_push_trigger` and `push_commands`;
- keep `propagate_tool_errors = true`.

This makes every trusted push run a full automatic review through `PRReviewer.run`. That path propagates failures when `propagate_tool_errors` is enabled. It costs more than incremental review, but a green check once again means an automatic review actually completed.

## Alternatives

### Keep incremental push commands

This is cheaper because `/review -i` reviews only new changes. It is rejected because command execution catches model exceptions and can leave a false-green check.

### Add a repository-owned wrapper

A wrapper could inspect logs or PR output and force a non-zero exit. It is rejected because Kaxu intentionally replaced its custom review pipeline with the official Action and should not rebuild another orchestration layer.

## Workflow behavior

The workflow continues listening to:

~~~text
pull_request_target: opened, reopened, ready_for_review, synchronize
issue_comment: created
~~~

Trusted automatic events use:

~~~text
event -> PR-Agent Action -> auto_review -> PRReviewer.run -> review comment or failed Action
~~~

Authorized comment commands continue using:

~~~text
/review or /review -i -> PR-Agent command handler -> review comment or logged upstream failure
~~~

The manual-command limitation remains explicit: PR-Agent v0.42.0 catches command exceptions, so a manual failure can still appear only in logs. This change guarantees fail-closed status for automatic reviews, including pushes.

## Secret and model configuration

The tracked workflow contains only Secret references:

~~~yaml
OPENAI_KEY: ${{ secrets.OPENAI_KEY }}
OPENAI.API_BASE: ${{ secrets.OPENAI_API_BASE }}
~~~

No endpoint, credential, or credential fragment is committed or printed. The configured endpoint must expose an OpenAI-compatible `POST /chat/completions` API, usually below a `/v1` path.

Model and fallback model remain omitted from the repository configuration in this change. The user must configure model identifiers supported by the endpoint before live validation; otherwise PR-Agent uses its upstream defaults.

## Files

- `.github/workflows/pr-agent.yml`: inject the compatible Base URL and route pushes through automatic review.
- `.pr_agent.toml`: align repository settings with the automatic-review event list and remove the command push path.
- `CONTRIBUTING.md`: document required Secrets, full push reviews, and manual incremental reviews.
- `current_project.md`: record the corrected PR-Agent behavior.
- this design document.

## Security

- `pull_request_target` remains restricted to same-repository PRs or trusted author associations.
- The workflow still does not checkout or execute PR branch code.
- Provider credentials and endpoint values remain in GitHub Actions Secrets.
- `restricted_mode = true` remains enabled.
- Missing or invalid credentials fail automatic review instead of silently passing.

## Verification

Before submission:

- parse the workflow as YAML;
- parse `.pr_agent.toml` and assert the expected event settings;
- assert the workflow reads `OPENAI_API_BASE` only through a Secret expression;
- assert `handle_push_trigger` and `push_commands` are absent;
- run `git diff --check`;
- run `pnpm check`.

Diff coverage is not applicable because the change contains workflow configuration and documentation, not application runtime code.

After merge and Secret/model configuration:

1. Trigger a new commit or ready-for-review event on PR #9.
2. Confirm the review comment is published in Chinese.
3. Temporarily use an invalid credential in a controlled validation and confirm the automatic Action fails.
4. Restore the valid credential and rerun the review.

## Rollback

Revert the implementation PR. No application data or protocol contract is migrated.
