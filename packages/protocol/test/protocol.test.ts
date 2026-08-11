import { expect, test } from "vitest"

import {
  currentProtocolVersion,
  isSupportedProtocolVersion,
  jsonValueSchema,
  operationCommandSchema,
  operationEventReplaySchema,
  operationEventSchema,
  parseOperationEventReplay,
  protocolErrorSchema,
  sessionOperationSchema
} from "@kaxu/protocol"

const timestamp = "2026-08-10T00:00:00.000Z"

const event = (sequence: number, sessionId = "session-1") => ({
  protocolVersion: currentProtocolVersion,
  eventId: `event-${sequence}`,
  operationId: "operation-1",
  sessionId,
  sequence,
  type: "output.stream",
  payload: { text: `chunk-${sequence}` },
  occurredAt: timestamp
})

test("accepts the v1 command envelope and preserves extension fields", () => {
  const parsed = operationCommandSchema.parse({
    protocolVersion: currentProtocolVersion,
    commandId: "command-1",
    operationId: "operation-1",
    sessionId: "session-1",
    actorId: "actor-1",
    type: "message.send",
    payload: { message: "hello" },
    issuedAt: timestamp,
    futureField: {
      nested: ["kept", 1, true, null]
    }
  })

  expect(parsed.futureField).toEqual({ nested: ["kept", 1, true, null] })
  expect(parsed.operationId).toBe("operation-1")
})

test("requires a payload and validates session operation status", () => {
  const missingPayload = operationCommandSchema.safeParse({
    protocolVersion: currentProtocolVersion,
    commandId: "command-1",
    operationId: "operation-1",
    sessionId: "session-1",
    actorId: "actor-1",
    type: "message.send",
    issuedAt: timestamp
  })

  const operation = sessionOperationSchema.safeParse({
    operationId: "operation-1",
    sessionId: "session-1",
    actorId: "actor-1",
    target: "workspace",
    action: "send",
    status: "running",
    createdAt: timestamp,
    updatedAt: timestamp
  })

  expect(missingPayload.success).toBe(false)
  expect(operation.success).toBe(true)
})

test("accepts contiguous replay and keeps event identity stable", () => {
  const replay = parseOperationEventReplay([event(4), event(5)])

  expect(replay.map(({ eventId, operationId, sequence }) => ({ eventId, operationId, sequence }))).toEqual([
    { eventId: "event-4", operationId: "operation-1", sequence: 4 },
    { eventId: "event-5", operationId: "operation-1", sequence: 5 }
  ])
})

test("accepts a single replay event", () => {
  expect(operationEventReplaySchema.parse([event(1)])).toHaveLength(1)
})

test("accepts only safe integer event sequences", () => {
  expect(operationEventSchema.safeParse(event(Number.MAX_SAFE_INTEGER)).success).toBe(true)
  expect(operationEventSchema.safeParse(event(Number.MAX_SAFE_INTEGER + 1)).success).toBe(false)
})

test("rejects gaps and cross-session event replay", () => {
  const gap = operationEventReplaySchema.safeParse([event(1), event(3)])
  const crossSession = operationEventReplaySchema.safeParse([event(1), event(2, "session-2")])

  expect(gap.success).toBe(false)
  expect(crossSession.success).toBe(false)
})

test("accepts protocol errors for unsupported versions", () => {
  const error = protocolErrorSchema.parse({
    protocolVersion: "v2",
    code: "unsupported_version",
    message: "Upgrade the client",
    details: { supported: [currentProtocolVersion] }
  })

  expect(error.code).toBe("unsupported_version")
  expect(isSupportedProtocolVersion(error.protocolVersion)).toBe(false)
  expect(operationEventSchema.safeParse(event(1)).success).toBe(true)
})

test("accepts nested JSON values", () => {
  expect(
    jsonValueSchema.parse({
      boolean: true,
      nil: null,
      number: 1.5,
      string: "value",
      nested: [{ child: "value" }]
    })
  ).toEqual({
    boolean: true,
    nil: null,
    number: 1.5,
    string: "value",
    nested: [{ child: "value" }]
  })

  expect(jsonValueSchema.safeParse(Object.create(null)).success).toBe(true)
})

test.each([
  ["undefined", undefined],
  ["bigint", 1n],
  ["function", () => undefined],
  ["symbol", Symbol("value")],
  ["NaN", Number.NaN],
  ["positive infinity", Number.POSITIVE_INFINITY],
  ["negative infinity", Number.NEGATIVE_INFINITY],
  ["negative zero", -0],
  ["nested undefined", { nested: undefined }],
  ["array with undefined", [undefined]],
  ["sparse array", [1, , 3]],
  ["array property", Object.assign([1], { extra: true })],
  ["date", new Date(timestamp)],
  ["class instance", new (class JsonLike { value = "not plain" })()],
  ["symbol key", { [Symbol("key")]: "value" }]
])("rejects non-JSON value: %s", (_name, value) => {
  expect(jsonValueSchema.safeParse(value).success).toBe(false)
})

test("rejects accessor and non-enumerable properties", () => {
  const accessorObject = Object.defineProperty({}, "value", {
    enumerable: true,
    get: () => "value"
  })
  const hiddenObject = Object.defineProperty({}, "value", {
    enumerable: false,
    value: "value"
  })
  const accessorArray = Object.defineProperty([], "0", {
    enumerable: true,
    get: () => "value"
  })

  expect(jsonValueSchema.safeParse(accessorObject).success).toBe(false)
  expect(jsonValueSchema.safeParse(hiddenObject).success).toBe(false)
  expect(jsonValueSchema.safeParse(accessorArray).success).toBe(false)
})

test("rejects cycles and objects that cannot be inspected", () => {
  const circular: { self?: unknown } = {}
  circular.self = circular
  const throwingProxy = new Proxy({}, {
    ownKeys() {
      throw new Error("uninspectable")
    }
  })

  expect(jsonValueSchema.safeParse(circular).success).toBe(false)
  expect(jsonValueSchema.safeParse(throwingProxy).success).toBe(false)
})

test("rejects non-JSON values in wire fields", () => {
  expect(operationCommandSchema.safeParse({
    protocolVersion: currentProtocolVersion,
    commandId: "command-1",
    operationId: "operation-1",
    sessionId: "session-1",
    actorId: "actor-1",
    type: "message.send",
    payload: { nested: undefined },
    issuedAt: timestamp
  }).success).toBe(false)

  expect(operationEventSchema.safeParse({
    ...event(1),
    extensions: { provider: 1n }
  }).success).toBe(false)

  expect(protocolErrorSchema.safeParse({
    protocolVersion: currentProtocolVersion,
    code: "invalid_envelope",
    message: "Invalid envelope",
    details: Number.NaN
  }).success).toBe(false)

  expect(sessionOperationSchema.safeParse({
    operationId: "operation-1",
    sessionId: "session-1",
    actorId: "actor-1",
    target: "workspace",
    action: "send",
    status: "running",
    createdAt: timestamp,
    updatedAt: timestamp,
    futureField: new Date(timestamp)
  }).success).toBe(false)
})
