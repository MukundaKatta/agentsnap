---
name: Bug report
about: A snapshot diff is wrong, expectSnapshot fails when it shouldn't (or passes when it shouldn't), or the CLI misbehaves.
title: "[bug] "
labels: bug
assignees: ''
---

## What happened

A clear, concise description of the actual behavior.

## What you expected

A clear, concise description of what should have happened.

## Reproduction

Minimal repro using only this library:

```js
import { record, traceTool, expectSnapshot } from '@mukundakatta/agentsnap';

// the smallest agent / tool definition that reproduces
const search = traceTool('search', async ({ q }) => ({ results: [q] }));

const trace = await record(async () => {
  await search({ q: 'hello' });
});

await expectSnapshot(trace, 'my-snapshot-name');
// observed: ...
// expected: ...
```

If the bug is about snapshot files on disk, please include:

- The contents of the snapshot file (anonymized).
- Whether the snapshot was created by `AGENTSNAP_UPDATE=1` or by hand.
- The full path agentsnap was reading from (relative to repo root).

If the bug is in the CLI (`npx agentsnap ...`), please paste the exact command.

## Environment

- agentsnap version: (`npm ls @mukundakatta/agentsnap`)
- Node version: (`node --version` — agentsnap requires Node 20+)
- OS: (macOS 14 / Ubuntu 22.04 / Windows 11)
- Test runner: (`node --test` / vitest / jest / mocha) + version
- Provider SDK under test (if relevant):

## Notes

Anything else — whether `AGENTSNAP_UPDATE=1` was set, whether you're running in CI vs locally, whether redactors were configured, anything that looks suspicious.
