# agentsnap

[![npm version](https://img.shields.io/npm/v/@mukundakatta/agentsnap.svg)](https://www.npmjs.com/package/@mukundakatta/agentsnap)
[![npm downloads](https://img.shields.io/npm/dm/@mukundakatta/agentsnap.svg)](https://www.npmjs.com/package/@mukundakatta/agentsnap)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/node/v/@mukundakatta/agentsnap.svg)](https://nodejs.org)
[![Tests](https://img.shields.io/badge/tests-37%2F37-brightgreen.svg)](./test)

**Snapshot tests for AI agents.** Record an agent run's tool-call trace, diff it against a baseline, fail CI on regressions. Zero runtime dependencies. Drops into any test runner.

```bash
npm install --save-dev @mukundakatta/agentsnap
```

```js
import { record, traceTool, expectSnapshot } from '@mukundakatta/agentsnap';

const search = traceTool('search', async ({ q }) => fetchResults(q));
const summarize = traceTool('summarize', async ({ docs }) => llm(docs));

async function agent(question) {
  const docs = await search({ q: question });
  return summarize({ docs });
}

test('research agent stays on rails', async () => {
  const trace = await record(() => agent('What is RLHF?'));
  await expectSnapshot(trace, '__snapshots__/research.snap.json');
});
```

First run writes the snapshot. Every run after that diffs against it. If the agent calls a different tool, calls them in a different order, or starts erroring, the test fails with a readable diff. Regenerate with `AGENTSNAP_UPDATE=1`.

TypeScript types ship in the box (`src/index.d.ts`) — no `@types/agentsnap` package needed.

### See it in action

```bash
git clone https://github.com/MukundaKatta/agentsnap && cd agentsnap
node examples/demo-regression.js
```

A fake "research agent" gets quietly swapped for one that calls `fetch_url` instead of `search`. agentsnap prints the colored diff that would block CI.

## Why

Most LLM eval libraries score outputs against expected strings. That misses the actual failure mode of agents in production: they start calling the wrong tools, or call them in the wrong order, or stop calling one entirely. agentsnap captures the *trace* — the ordered sequence of tool calls, their arguments, and a hash of their results — and treats it like a Jest snapshot. If anything structural changes, your test runner tells you.

## Diff statuses

| Status | When | Default action |
|---|---|---|
| `PASSED` | Bytewise match | green |
| `OUTPUT_DRIFT` | Tools + args identical, only output text or external result hashes differ | warn (non-failing) |
| `TOOLS_REORDERED` | Same tool names, different order | **fail** |
| `TOOLS_CHANGED` | Different tool names called, or different arguments | **fail** |
| `REGRESSION` | New error in the trace, or a tool that used to work now throws | **fail** |

Override per snapshot via `expectSnapshot(trace, path, { failOn: [...] })`.

## API

### `record(fn, opts?) → Promise<Trace>`

Run `fn` and capture every `traceTool()` call inside it (including nested async work). Returns a structured trace.

```js
const trace = await record(
  () => myAgent.run('book SFO'),
  { input: 'book SFO', model: 'claude-sonnet-4-6' }
);
```

Options:
- `input` — what the user/caller sent in. Stored verbatim in the trace.
- `model` — model id string. Surfaced in `OUTPUT_DRIFT` diffs.
- `captureResults` — store full tool results in the trace (default `false`; only the SHA-256 hash is stored to avoid snapshot bloat and PII leaks).

### `traceTool(name, fn) → wrapped fn`

Wraps a tool function. Inside `record()`, calls are appended to the active trace. Outside `record()`, it's a transparent pass-through — no overhead, no behavior change.

```js
const search = traceTool('search', async ({ q }) => api.search(q));
const result = await search({ q: 'sfo' }); // works the same as api.search
```

`AsyncLocalStorage` powers the recorder, so the wrapped function works correctly across `await`, `Promise.all`, timers, and other async boundaries.

### `expectSnapshot(trace, path, opts?) → Promise<{status, path, changes?}>`

- **No file at `path`** → writes the snapshot and returns `{status: 'CREATED'}`.
- **`AGENTSNAP_UPDATE=1`** (env) or `opts.update: true` → overwrites the snapshot.
- **Otherwise** → diffs. If the diff status is in `opts.failOn` (default `['TOOLS_CHANGED', 'TOOLS_REORDERED', 'REGRESSION']`), throws an `AgentSnapshotMismatch` error so the host test runner reports a failure.

### `diff(baseline, current) → DiffResult`

Low-level diff if you want to handle the result yourself instead of throwing.

### `formatDiff(result, path?) → string`

Render a diff result as a colored terminal block. Used internally for the failure message; also exported for custom reporters.

## Trace format

```jsonc
{
  "version": 1,
  "model": "claude-sonnet-4-6",
  "input": "Book a flight to SFO",
  "output": "Booked. Confirmation #ABC123.",
  "tools": [
    { "name": "search_flights", "args": { "to": "SFO" }, "result_hash": "sha256:..." },
    { "name": "book_flight",    "args": { "id": "UA123" }, "result_hash": "sha256:..." }
  ],
  "error": null,
  "fingerprint": { "node": "v22.0.0", "agentsnap": "0.1.0" }
}
```

`fingerprint` is ignored when diffing (Node version drift shouldn't fail your tests).

## Test runners

agentsnap doesn't ship a runner — it just throws on mismatch. Anything that surfaces thrown errors as failures works:

- **node:test** — `node --test 'test/**/*.test.js'`
- **vitest** — `import { test } from 'vitest'`, then call as shown above
- **jest** — same shape; works with `--experimental-vm-modules` for ESM
- **playwright / mocha / tap / ava** — same story

## Recipes

### Update all snapshots

```bash
AGENTSNAP_UPDATE=1 npm test
```

### Capture full tool results (debugging only)

```js
const trace = await record(fn, { captureResults: true });
```

Don't commit traces with `captureResults` enabled if your tools touch real APIs — the snapshot will contain raw responses (potentially PII).

### Treat any drift as failure

```js
await expectSnapshot(trace, path, {
  failOn: ['OUTPUT_DRIFT', 'TOOLS_CHANGED', 'TOOLS_REORDERED', 'REGRESSION'],
});
```

### Pair with a real LLM

`record()` wraps any async function. Whether your tools call a deterministic mock or the live Anthropic SDK, the recording flow is identical. For deterministic snapshots in CI, mock the model and call real tools (or vice versa) depending on what you want to gate.

## CLI

`@mukundakatta/agentsnap` ships an `agentsnap` binary for diffing/normalizing/updating trace files outside a test runner — handy in CI or for ad-hoc inspection:

```bash
# Diff two recorded traces; exits 1 on drift
npx -p @mukundakatta/agentsnap agentsnap diff baseline.json current.json --pretty

# Normalize a trace (strip fingerprint, sort keys) for stable storage
cat trace.json | npx -p @mukundakatta/agentsnap agentsnap normalize - --pretty

# Overwrite a baseline with a new run (after eyeballing the diff)
npx -p @mukundakatta/agentsnap agentsnap update baseline.json current.json
```

Output is JSON to stdout (use `--pretty` for indented). Exit code is `0` when there is no drift, `1` when there is, `2` on usage errors. Run `agentsnap --help` for the full subcommand reference.

## What this is not

- **Not an eval framework.** No scoring, no LLM-judge, no benchmark dataset. Just snapshot-and-diff.
- **Not a tracer for production.** This is a test-time tool. For production observability, reach for OpenTelemetry, Langfuse, etc.
- **Not a workflow product.** No CLI, no YAML schema, no cloud upload, no Slack digest. One primitive, shipped well.

## Sibling libraries

Part of the agent reliability stack — all `@mukundakatta/*` scoped, all zero-dep:

- [`@mukundakatta/agentfit`](https://www.npmjs.com/package/@mukundakatta/agentfit) — fit messages to budget. *Fit it.*
- **`@mukundakatta/agentsnap`** — snapshot tests for tool-call traces. *Test it.* (this)
- [`@mukundakatta/agentguard`](https://www.npmjs.com/package/@mukundakatta/agentguard) — network egress firewall. *Sandbox it.*
- [`@mukundakatta/agentvet`](https://www.npmjs.com/package/@mukundakatta/agentvet) — tool-arg validator. *Vet it.*
- [`@mukundakatta/agentcast`](https://www.npmjs.com/package/@mukundakatta/agentcast) — structured output enforcer. *Validate it.*

Natural pipeline: **fit → guard → snap → vet → cast**.

## Status

v0.1.2 — tooling polish. Core API stable, TypeScript types included, 37 unit tests, CI on Node 20/22/24. Adapter packages for the Anthropic SDK, OpenAI SDK, and MCP clients are planned for v0.2 to remove the need for manual `traceTool()` wrapping.

## License

MIT
