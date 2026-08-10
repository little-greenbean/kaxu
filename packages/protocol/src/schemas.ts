import { z } from "zod"

export const currentProtocolVersion = "v1" as const

const identifierSchema = z.string().min(1)
const timestampSchema = z.iso.datetime()
const payloadSchema = z.unknown().refine((value) => value !== undefined, {
  message: "payload is required"
})

export const protocolVersionSchema = z.literal(currentProtocolVersion)

export const operationStatusSchema = z.enum([
  "requested",
  "waiting",
  "approved",
  "running",
  "completed",
  "failed",
  "cancelled"
])

export const sessionOperationSchema = z
  .object({
    operationId: identifierSchema,
    sessionId: identifierSchema,
    actorId: identifierSchema,
    target: z.string().min(1),
    action: z.string().min(1),
    status: operationStatusSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
    extensions: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough()

export const operationCommandSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    commandId: identifierSchema,
    operationId: identifierSchema,
    sessionId: identifierSchema,
    actorId: identifierSchema,
    type: z.string().min(1),
    payload: payloadSchema,
    issuedAt: timestampSchema,
    extensions: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough()

export const operationEventSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    eventId: identifierSchema,
    operationId: identifierSchema,
    sessionId: identifierSchema,
    sequence: z.number().int().positive(),
    type: z.string().min(1),
    payload: payloadSchema,
    occurredAt: timestampSchema,
    extensions: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough()

export const operationEventReplaySchema = z
  .array(operationEventSchema)
  .superRefine((events, context) => {
    if (events.length < 2) {
      return
    }

    const first = events[0]!

    for (let index = 1; index < events.length; index += 1) {
      const previous = events[index - 1]!
      const current = events[index]!

      if (current.sessionId !== first.sessionId) {
        context.addIssue({
          code: "custom",
          path: [index, "sessionId"],
          message: "replayed events must belong to one session"
        })
      }

      if (current.sequence !== previous.sequence + 1) {
        context.addIssue({
          code: "custom",
          path: [index, "sequence"],
          message: "replayed event sequences must be contiguous"
        })
      }
    }
  })

export const protocolErrorCodeSchema = z.enum([
  "invalid_envelope",
  "invalid_transition",
  "unsupported_version"
])

export const protocolErrorSchema = z
  .object({
    protocolVersion: z.string().min(1),
    code: protocolErrorCodeSchema,
    message: z.string().min(1),
    operationId: identifierSchema.optional(),
    details: z.unknown().optional()
  })
  .passthrough()

type OperationCommandEnvelope = z.infer<typeof operationCommandSchema>
type OperationEventEnvelope = z.infer<typeof operationEventSchema>

export type OperationCommand<TPayload = unknown> = Omit<OperationCommandEnvelope, "payload"> & {
  payload: TPayload
}
export type OperationEvent<TPayload = unknown> = Omit<OperationEventEnvelope, "payload"> & {
  payload: TPayload
}
export type OperationEventReplay<TPayload = unknown> = Array<OperationEvent<TPayload>>
export type OperationStatus = z.infer<typeof operationStatusSchema>
export type ProtocolError = z.infer<typeof protocolErrorSchema>
export type ProtocolVersion = z.infer<typeof protocolVersionSchema>
export type SessionOperation = z.infer<typeof sessionOperationSchema>

export function isSupportedProtocolVersion(value: string): value is ProtocolVersion {
  return value === currentProtocolVersion
}

export function parseOperationEventReplay(input: unknown): OperationEventReplay {
  return operationEventReplaySchema.parse(input)
}
