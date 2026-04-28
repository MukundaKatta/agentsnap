# Changelog

## [0.1.2] — 2026-04-28

### Added
- `c8` coverage tooling: `npm run test:coverage` reports per-file coverage
  and gates the build at 70% branches / 80% lines+functions+statements.
- `CHANGELOG.md`, `CONTRIBUTING.md`.
- Top-of-README badges (npm version, downloads, license, Node, tests).
- `Status` line in README now matches the actual test count (37).

### Notes
This is a tooling-only patch; no runtime behavior changed. Pinning at
0.1.2 keeps the agent-stack family (agentfit / agentguard / agentcast /
agentsnap / agentvet / agenttrace) on a unified version line.

## [0.1.1] — 2026-04-25

Initial published release. Snapshot tests for AI agent tool-call traces. Core API stable, TypeScript types,
CI matrix on Node 20/22/24.

## [0.1.0]

Pre-release placeholder.
