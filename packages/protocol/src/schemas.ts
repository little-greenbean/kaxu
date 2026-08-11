import { z, type RefinementCtx } from "zod"

export const currentProtocolVersion = "v1" as const

const identifierSchema = z.string().min(1)
const timestampSchema = z.iso.datetime()

export type JsonValue =
  | boolean
  | null
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

function isJsonValueInternal(value: unknown, ancestors: Set<object>): value is JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return true
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && !Object.is(value, -0)
  }

  if (typeof value !== "object") {
    return false
  }

  if (ancestors.has(value)) {
    return false
  }

  ancestors.add(value)

  try {
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value)
      if (keys.length !== value.length + 1) {
        return false
      }

      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, index)
        if (!descriptor?.enumerable || !("value" in descriptor)) {
          return false
        }

        if (!isJsonValueInternal(descriptor.value, ancestors)) {
          return false
        }
      }

      return true
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      return false
    }

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        return false
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        return false
      }

      if (!isJsonValueInternal(descriptor.value, ancestors)) {
        return false
      }
    }

    return true
  } finally {
    ancestors.delete(value)
  }
}

function isJsonValue(value: unknown): value is JsonValue {
  try {
    return isJsonValueInternal(value, new Set())
  } catch {
    return false
  }
}

export const jsonValueSchema = z.custom<JsonValue>(isJsonValue, {
  message: "value must be losslessly JSON serializable"
})

function rejectExplicitUndefinedFields(fields: readonly string[]) {
  return (value: Record<string, unknown>, context: RefinementCtx): void => {
    for (const field of fields) {
      if (Object.hasOwn(value, field) && value[field] === undefined) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "optional wire fields must be omitted instead of set to undefined"
        })
      }
    }
  }
}

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
    extensions: z.record(z.string(), jsonValueSchema).optional()
  })
  .catchall(jsonValueSchema)
  .superRefine(rejectExplicitUndefinedFields(["extensions"]))

export const operationCommandSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    commandId: identifierSchema,
    operationId: identifierSchema,
    sessionId: identifierSchema,
    actorId: identifierSchema,
    type: z.string().min(1),
    payload: jsonValueSchema,
    issuedAt: timestampSchema,
    extensions: z.record(z.string(), jsonValueSchema).optional()
  })
  .catchall(jsonValueSchema)
  .superRefine(rejectExplicitUndefinedFields(["extensions"]))

export const operationEventSchema = z
  .object({
    protocolVersion: protocolVersionSchema,
    eventId: identifierSchema,
    operationId: identifierSchema,
    sessionId: identifierSchema,
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    type: z.string().min(1),
    payload: jsonValueSchema,
    occurredAt: timestampSchema,
    extensions: z.record(z.string(), jsonValueSchema).optional()
  })
  .catchall(jsonValueSchema)
  .superRefine(rejectExplicitUndefinedFields(["extensions"]))

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
    details: jsonValueSchema.optional()
  })
  .catchall(jsonValueSchema)
  .superRefine(rejectExplicitUndefinedFields(["operationId", "details"]))

type OperationCommandEnvelope = z.infer<typeof operationCommandSchema>
type OperationEventEnvelope = z.infer<typeof operationEventSchema>

export type OperationCommand<TPayload extends JsonValue = JsonValue> = Omit<OperationCommandEnvelope, "payload"> & {
  payload: TPayload
}
export type OperationEvent<TPayload extends JsonValue = JsonValue> = Omit<OperationEventEnvelope, "payload"> & {
  payload: TPayload
}
export type OperationEventReplay<TPayload extends JsonValue = JsonValue> = Array<OperationEvent<TPayload>>
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
