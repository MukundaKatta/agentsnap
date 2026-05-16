<!--
Thanks for sending a PR to agentsnap.

Quick reminders before you submit:
  - Zero runtime dependencies. A PR that adds one will be sent back to an issue discussion first.
  - This library performs no network I/O. Sandboxing the agent under test is out of scope.
  - Snapshot file format is part of the public API. Breaking changes there need a major version.
  - Tests live in test/ and run via `npm test`. Add one for any new behavior.
-->

## What this changes

A one-line summary, then a short paragraph if needed.

## Why

The user-visible bug or workflow gap this addresses.

## Type of change

- [ ] Bug fix in `record` / `traceTool` / `expectSnapshot`
- [ ] New redactor or snapshot strategy
- [ ] CLI fix
- [ ] Numerical / serialization edge case
- [ ] Test coverage
- [ ] Documentation
- [ ] CI / build / release plumbing

## Scope check

- [ ] No new runtime dependencies added (enforced by CI).
- [ ] No network I/O introduced.
- [ ] No snapshot file format change without bumping the major version.
- [ ] If the change touches snapshot serialization, baselines under `examples/` were regenerated with `AGENTSNAP_UPDATE=1`.

## Validation

- [ ] `npm run test:all` passes locally (unit + examples)
- [ ] `npm run test:coverage` still meets the configured thresholds (70% branches / 80% lines+functions+statements)
- [ ] Public API changes are reflected in `src/index.d.ts`

## Linked issue

Closes #
