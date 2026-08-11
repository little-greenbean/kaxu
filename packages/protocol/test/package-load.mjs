import assert from "node:assert/strict"

import {
  currentProtocolVersion,
  operationCommandSchema
} from "@kaxu/protocol"

const command = operationCommandSchema.parse({
  protocolVersion: currentProtocolVersion,
  commandId: "command-package-load",
  operationId: "operation-package-load",
  sessionId: "session-package-load",
  actorId: "actor-package-load",
  type: "message.send",
  payload: { message: "native Node.js import" },
  issuedAt: "2026-08-11T00:00:00.000Z"
})

assert.equal(currentProtocolVersion, "v1")
assert.equal(command.operationId, "operation-package-load")
