# Operation Protocol

The Kaxu protocol connects clients, the operation core, adapters, and event consumers. This document defines the initial direction; schemas are not stable until a versioned package and contract tests are published.

## Protocol principles

- Commands are requests; events are immutable facts.
- One `operationId` identifies the same action across its full lifecycle.
- Events are ordered within a session and can be replayed after reconnect.
- Consumers must be idempotent.
- Unknown optional fields must not break older clients.
- Provider-specific payloads stay behind adapter-owned extension fields.

## Conceptual operation

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
}
```

## Conceptual command envelope

```ts
type OperationCommand<TPayload = unknown> = {
  protocolVersion: string
  commandId: string
  operationId: string
  sessionId: string
  actorId: string
  type: string
  payload: TPayload
  issuedAt: string
}
```

## Conceptual event envelope

```ts
type OperationEvent<TPayload = unknown> = {
  protocolVersion: string
  eventId: string
  operationId: string
  sessionId: string
  sequence: number
  type: string
  payload: TPayload
  occurredAt: string
}
```

## Lifecycle

```text
requested -> waiting -> approved -> running -> completed
                                      \-> failed / cancelled
```

Transitions must be deterministic. Invalid transitions produce a protocol error and do not mutate the operation.

## Replay

A client records the highest contiguous event sequence it has applied. After reconnect, it requests events after that sequence. Replayed events retain their original `eventId`, `operationId`, and sequence so consumers can deduplicate them.

## Compatibility

The first implementation will define versioning rules alongside executable schemas and contract tests. Until then, these types are explanatory and must not be treated as a stable wire contract.
