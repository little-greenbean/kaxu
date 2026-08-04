# Agent Adapters

Adapters translate between Kaxu's operation protocol and an Agent-specific SDK, CLI, ACP server, stdio stream, or WebSocket API.

## Responsibilities

An adapter:

- declares its capabilities;
- validates provider-specific prerequisites;
- maps commands to provider actions;
- maps provider output to `OperationEvent`;
- supports cancellation when the provider allows it;
- reports provider version and compatibility information.

An adapter does not:

- own the canonical operation state;
- decide product policy;
- expose provider objects directly to clients;
- create a second operation identifier for the same action.

## Conceptual interface

```ts
interface AgentAdapter {
  getCapabilities(): Promise<CapabilityManifest>
  execute(command: OperationCommand): AsyncIterable<OperationEvent>
  cancel(operationId: string): Promise<void>
}
```

The implementation will refine this contract with lifecycle hooks, error taxonomy, backpressure, and conformance tests.

## Capability examples

```text
session.create
session.resume
message.send
operation.cancel
tool.preview
tool.approve
tool.deny
output.stream
file.diff
```

A Projection must hide or disable an action when the active adapter does not declare the required capability.

## Conformance

Every adapter should pass the same contract suite for command validation, event ordering, cancellation, replay identity, error mapping, and unsupported capabilities.
