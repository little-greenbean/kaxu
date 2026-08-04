# Self-hosting

Self-hosting is a required Community Edition path, but the runtime is not implemented yet.

The intended deployment separates:

- a Local Host next to the Agent and workspace;
- an optional relay that routes encrypted session traffic;
- a Web/PWA Projection;
- a storage implementation behind the event-store port.

The self-hosted path must not require a commercial Kaxu account to complete the core control loop.

Before the first supported release, this document will define deployment prerequisites, network topology, key management, upgrade procedures, backup behavior, and security defaults. Do not deploy the current repository as a production service.
