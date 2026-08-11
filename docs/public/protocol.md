# Operation Protocol

`packages/protocol` publishes the executable v1 contract. The package exports Zod schemas and helpers; this document matches the shipped names and behavior.

## Protocol principles

- Commands are requests; events are immutable facts.
- One `operationId` identifies the same action across its full lifecycle.
- Events are ordered within a session and can be replayed after reconnect.
- Consumers must be idempotent.
- Wire values must be losslessly JSON serializable.
- Optional wire fields may be omitted, but must not be present with the value `undefined`.
- Unknown top-level fields are preserved when their values are valid JSON so older clients can ignore newer extensions.
- Provider-specific payloads stay behind adapter-owned extension fields.

## Exported contract

```ts
import {
  currentProtocolVersion,
  jsonValueSchema,
  operationCommandSchema,
  operationEventReplaySchema,
  operationEventSchema,
  operationStatusSchema,
  protocolErrorSchema,
  protocolVersionSchema,
  sessionOperationSchema
} from "@kaxu/protocol"
```

### `JsonValue`

```ts
type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }
```

`jsonValueSchema` rejects values that JSON cannot preserve, including `undefined`, `bigint`, functions, symbols, non-finite numbers, negative zero, cycles, sparse arrays, accessors, non-enumerable properties, and class instances.

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
  extensions?: Record<string, JsonValue>
}
```

### `OperationCommand`

```ts
type OperationCommand<TPayload extends JsonValue = JsonValue> = {
  protocolVersion: "v1"
  commandId: string
  operationId: string
  sessionId: string
  actorId: string
  type: string
  payload: TPayload
  issuedAt: string
  extensions?: Record<string, JsonValue>
}
```

### `OperationEvent`

```ts
type OperationEvent<TPayload extends JsonValue = JsonValue> = {
  protocolVersion: "v1"
  eventId: string
  operationId: string
  sessionId: string
  sequence: number // integer from 1 through Number.MAX_SAFE_INTEGER
  type: string
  payload: TPayload
  occurredAt: string
  extensions?: Record<string, JsonValue>
}
```

### `ProtocolError`

```ts
type ProtocolError = {
  protocolVersion: string
  code: "invalid_envelope" | "invalid_transition" | "unsupported_version"
  message: string
  operationId?: string
  details?: JsonValue
}
```

## Replay

`operationEventReplaySchema` validates a contiguous event list for one session. The first event can start at any sequence from `1` through `Number.MAX_SAFE_INTEGER`, but every following event must increment by one and stay in the same session. Every `eventId` in one replay batch must be unique.

Replayed events retain their original `eventId`, `operationId`, and `sequence` so consumers can deduplicate them without executing an operation twice.

The exported replay type applies the same payload constraint:

```ts
type OperationEventReplay<TPayload extends JsonValue = JsonValue> =
  Array<OperationEvent<TPayload>>
```

## Compatibility

`currentProtocolVersion` is `v1`. Clients should reject unknown protocol versions closed rather than guessing at compatibility. Unknown optional fields with JSON-safe values are retained by the schema parser for forward-compatible projections. Known optional fields may be absent, but an own property explicitly set to `undefined` is invalid because JSON serialization would silently remove it.
