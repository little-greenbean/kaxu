# Operation Protocol

`packages/protocol` publishes the executable v1 contract. The package exports Zod schemas and helpers; this document matches the shipped names and behavior.

## Protocol principles

- Commands are requests; events are immutable facts.
- One `operationId` identifies the same action across its full lifecycle.
- Events are ordered within a session and can be replayed after reconnect.
- Consumers must be idempotent.
- Unknown top-level fields are preserved so older clients can ignore newer extensions.
- Provider-specific payloads stay behind adapter-owned extension fields.

## Exported contract

```ts
import {
  currentProtocolVersion,
  operationCommandSchema,
  operationEventReplaySchema,
  operationEventSchema,
  operationStatusSchema,
  protocolErrorSchema,
  protocolVersionSchema,
  sessionOperationSchema
} from "@kaxu/protocol"
```

### `SessionOperation`

```ts
type SessionOperation = {
  operationId: string
  sessionId: string
  actorId: string
  target: string
  action: string
  status:
    | "requested"
    | "waiting"
    | "approved"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
  createdAt: string
  updatedAt: string
  extensions?: Record<string, unknown>
}
```

### `OperationCommand`

```ts
type OperationCommand<TPayload = unknown> = {
  protocolVersion: "v1"
  commandId: string
  operationId: string
  sessionId: string
  actorId: string
  type: string
  payload: TPayload
  issuedAt: string
  extensions?: Record<string, unknown>
}
```

### `OperationEvent`

```ts
type OperationEvent<TPayload = unknown> = {
  protocolVersion: "v1"
  eventId: string
  operationId: string
  sessionId: string
  sequence: number
  type: string
  payload: TPayload
  occurredAt: string
  extensions?: Record<string, unknown>
}
```

### `ProtocolError`

```ts
type ProtocolError = {
  protocolVersion: string
  code: "invalid_envelope" | "invalid_transition" | "unsupported_version"
  message: string
  operationId?: string
  details?: unknown
}
```

## Replay

`operationEventReplaySchema` validates a contiguous event list for one session. The first event can start at any positive sequence, but every following event must increment by one and stay in the same session.

Replayed events retain their original `eventId`, `operationId`, and `sequence` so consumers can deduplicate them without executing an operation twice.

## Compatibility

`currentProtocolVersion` is `v1`. Clients should reject unknown protocol versions closed rather than guessing at compatibility. Unknown optional fields are retained by the schema parser for forward-compatible projections.
