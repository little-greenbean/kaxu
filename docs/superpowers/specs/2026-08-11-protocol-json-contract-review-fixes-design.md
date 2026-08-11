# Protocol JSON contract review fixes

Status: approved design

## Context

PR-Agent review for PR #9 found two contract gaps in the executable protocol package:

- Known optional wire fields accept an explicitly provided `undefined` value, even though JSON serialization drops those properties.
- Exported generic payload types allow non-JSON payload types, while the runtime schemas reject non-JSON values.

Both gaps conflict with the public protocol rule that wire values must be losslessly JSON serializable.

## Goals

- Reject explicit `undefined` on known optional wire fields while still allowing the fields to be omitted.
- Keep unknown top-level extension fields fail-closed through the existing JSON catchall.
- Constrain public generic payload types to `JsonValue`.
- Add regression coverage for runtime validation and compile-time type constraints.
- Keep the fix inside `packages/protocol` and aligned public documentation.

## Non-goals

- No operation-core state machine.
- No Host, Adapter, Web, storage, or transport behavior.
- No schema version bump; the package is still private and unreleased at `0.0.0`.
- No attempt to normalize or silently strip invalid wire values.

## Runtime Design

Add one small schema helper that checks parsed object output for known optional fields whose own property value is `undefined`.

The helper will add a custom Zod issue at the field path when a value is explicitly `undefined`. Omitted fields remain valid. Unknown top-level fields still pass through the existing `.catchall(jsonValueSchema)`, which already rejects `undefined` and other non-JSON values.

Apply the helper to:

- `SessionOperation.extensions`
- `OperationCommand.extensions`
- `OperationEvent.extensions`
- `ProtocolError.operationId`
- `ProtocolError.details`

## Type Design

Constrain exported generic payload types:

```ts
OperationCommand<TPayload extends JsonValue = JsonValue>
OperationEvent<TPayload extends JsonValue = JsonValue>
OperationEventReplay<TPayload extends JsonValue = JsonValue>
```

This keeps static TypeScript usage aligned with the runtime schema contract. A caller can still specialize payloads, but only to JSON-safe shapes.

## Tests

Add runtime tests that assert explicit `undefined` is rejected for each known optional wire field, while omitted fields continue to parse through existing valid-envelope coverage.

Add a TypeScript-only test fixture under `packages/protocol/test` with:

- valid `OperationCommand` and `OperationEvent` JSON payload specializations
- `@ts-expect-error` cases for non-JSON payload types such as `Date` and `bigint`

The existing root `pnpm typecheck` includes `packages/**/*.ts`. If a non-JSON specialization becomes legal, its `@ts-expect-error` directive becomes unused and fails `pnpm check`.

## Documentation

Update `docs/public/protocol.md` so the public type snippets show the `extends JsonValue` constraint and explicitly state that optional wire fields may be omitted but must not be present with `undefined`.

## Compatibility

This is a stricter validation change for an unreleased private package. Inputs that previously parsed with explicit `undefined` on known optional fields will now fail. That behavior matches the documented JSON wire contract and avoids silent data loss during JSON serialization.

## Validation

Before pushing:

- `pnpm check`
- `pnpm test:coverage`
- `git diff --check`

After pushing:

- reply to the PR-Agent review with the fix commit and validation commands
- rerun PR-Agent review for PR #9
- confirm the automatic check succeeds and no blocker remains for these two findings

## Rollback

Revert the fix commit. The previous permissive optional-field behavior and unconstrained generic payload types would return.
