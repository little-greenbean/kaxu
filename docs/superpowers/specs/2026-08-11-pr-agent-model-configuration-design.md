# Official PR-Agent model configuration design

Status: approved direction

## Goal

Keep the repository on the official `The-PR-Agent/pr-agent` GitHub Action and make its model selection configurable without committing an endpoint-specific model choice.

The review feature is complete only when PR #9 receives a real PR-Agent review body and the automatic review check succeeds. A green Action without review output is not sufficient.

## Current failure

The official Action receives `OPENAI_KEY` and `OPENAI.API_BASE`, but no model override. PR-Agent therefore uses its upstream defaults. Automatic review fails closed because the compatible endpoint rejects the model request with `PermissionDenied: Your request was blocked`.

Command-level tests confirmed that selecting `gpt-5.6-sol` does not by itself remove the endpoint rejection. Model configuration and endpoint authorization are separate requirements.

## Design

Use only the pinned official PR-Agent Action.

The workflow maps repository configuration into the official environment settings:

~~~text
Actions Secret OPENAI_KEY                 -> OPENAI_KEY
Actions Secret OPENAI_API_BASE            -> OPENAI.API_BASE
Actions Variable PR_AGENT_MODEL           -> config.model
Actions Variable PR_AGENT_FALLBACK_MODELS -> config.fallback_models
~~~

`PR_AGENT_FALLBACK_MODELS` is a JSON array string, for example `["model-name"]`. Model identifiers remain repository settings rather than tracked source.

The existing automatic full-review path remains unchanged:

~~~text
opened / reopened / ready_for_review / synchronize
  -> official PR-Agent action
  -> PRReviewer.run
  -> publish review or fail the check
~~~

Manual `/review` remains available, but automatic review is the authoritative merge gate because PR-Agent's manual command path can log a model failure without failing the Action.

## Scope

Included:

- map the two Actions Variables to official PR-Agent settings
- document the required Secrets and Variables
- keep automatic review enabled for Draft updates and later PRs
- keep automatic failures fail closed
- verify the configuration on PR #9 after it reaches the default branch

Not included:

- no custom review bot
- no custom model client, proxy, retry wrapper, or log parser
- no committed Key, Base URL, or endpoint-specific model choice
- no attempt to bypass an endpoint authorization or content policy

## Failure behavior

- Missing or malformed model configuration must not fall back silently to an unintended model.
- Invalid credentials, Base URL, model access, or endpoint policy keep the automatic review check red.
- The workflow must not print Secret values.
- A successful review requires both a successful check and a published PR-Agent review body.

## Validation

Before merge:

- parse the workflow as YAML
- assert that model values come only from Actions Variables
- assert that credentials and Base URL come only from Actions Secrets
- assert that the pinned official Action remains the only review implementation
- run `pnpm check` and `git diff --check`

After merge and valid repository configuration:

- synchronize PR #9
- confirm the automatic PR-Agent check succeeds
- confirm a Chinese PR-Agent review body is published for the current head SHA
- confirm no model error is hidden behind a green manual-command run

## Rollback

Revert the workflow and documentation commit. The existing official PR-Agent defaults then apply again; Secrets are unchanged.
