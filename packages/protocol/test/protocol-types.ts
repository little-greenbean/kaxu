import type {
  JsonValue,
  OperationCommand,
  OperationEvent,
  OperationEventReplay
} from "@kaxu/protocol"

declare const command: OperationCommand<{ message: string }>
declare const event: OperationEvent<{ text: string; complete: boolean }>
declare const replay: OperationEventReplay<{ chunks: string[] }>

const jsonPayloads: JsonValue[] = [command.payload, event.payload, replay[0]!.payload]
void jsonPayloads

// @ts-expect-error Date values are not JSON payloads.
type InvalidCommand = OperationCommand<Date>
// @ts-expect-error BigInt values are not JSON payloads.
type InvalidEvent = OperationEvent<bigint>
// @ts-expect-error Undefined values are not JSON payloads.
type InvalidReplay = OperationEventReplay<undefined>

export type { InvalidCommand, InvalidEvent, InvalidReplay }
