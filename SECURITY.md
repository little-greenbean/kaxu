# Security Policy

## Supported versions

Kaxu is currently in an early architecture phase and does not yet publish a supported production release. Security support will be documented with the first release.

## Reporting a vulnerability

Do not open a public issue for a vulnerability, credential exposure, authentication bypass, encryption weakness, or private-data leak.

Use GitHub's private vulnerability reporting for this repository. Include:

- affected component and version or commit;
- reproduction steps or a minimal proof of concept;
- expected impact;
- suggested mitigation, if known.

Maintainers will acknowledge a complete report as soon as practical, coordinate remediation privately, and publish an advisory when users have an actionable fix.

## Security boundaries

Kaxu treats device identity, session keys, tool approvals, replay protection, local file permissions, and event integrity as core protocol concerns. Security-sensitive defaults should fail closed when the host, policy engine, or trusted device cannot be verified.
