import { expect, test } from "vitest"

import {
  currentProtocolVersion,
  isSupportedProtocolVersion,
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
    futureField: "kept"
  })

  expect(parsed.futureField).toBe("kept")
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
