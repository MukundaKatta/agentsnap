import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { main } from '../src/cli.js';

/**
 * Capture stdout/stderr from a single main() invocation.
 * Restores writers in finally so tests don't leak state.
 */
async function captureMain(argv) {
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  let stdout = '';
  let stderr = '';
  process.stdout.write = (chunk) => {
    stdout += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    return true;
  };
  process.stderr.write = (chunk) => {
    stderr += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    return true;
  };
  try {
    const code = await main(argv);
    return { code, stdout, stderr };
  } finally {
    process.stdout.write = origOut;
    process.stderr.write = origErr;
  }
}

function tempTrace(trace) {
  const dir = mkdtempSync(join(tmpdir(), 'agentsnap-cli-'));
  const path = join(dir, 'trace.json');
  writeFileSync(path, JSON.stringify(trace), 'utf8');
  return { dir, path };
}

const SAMPLE_TRACE = {
  version: 1,
  model: 'test',
  input: 'hi',
  output: 'ok',
  tools: [{ name: 'search', args: { q: 'foo' }, result_hash: 'sha256:abc' }],
  error: null,
  fingerprint: { node: 'v22.0.0', agentsnap: '0.1.0' },
};

test('--help prints usage and exits 0', async () => {
  const { code, stdout } = await captureMain(['--help']);
  assert.equal(code, 0);
  assert.match(stdout, /agentsnap v\d/);
  assert.match(stdout, /diff/);
  assert.match(stdout, /normalize/);
  assert.match(stdout, /update/);
});

test('diff returns PASSED and exits 0 when traces match', async () => {
  const a = tempTrace(SAMPLE_TRACE);
  const b = tempTrace(SAMPLE_TRACE);
  try {
    const { code, stdout } = await captureMain(['diff', a.path, b.path]);
    assert.equal(code, 0);
    const out = JSON.parse(stdout);
    assert.equal(out.status, 'PASSED');
  } finally {
    rmSync(a.dir, { recursive: true, force: true });
    rmSync(b.dir, { recursive: true, force: true });
  }
});

test('diff exits 1 and reports drift when tools differ', async () => {
  const a = tempTrace(SAMPLE_TRACE);
  const b = tempTrace({
    ...SAMPLE_TRACE,
    tools: [{ name: 'fetch', args: { url: 'http://x' }, result_hash: 'sha256:def' }],
  });
  try {
    const { code, stdout } = await captureMain(['diff', a.path, b.path]);
    assert.equal(code, 1);
    const out = JSON.parse(stdout);
    assert.equal(out.status, 'TOOLS_CHANGED');
    assert.ok(Array.isArray(out.changes));
  } finally {
    rmSync(a.dir, { recursive: true, force: true });
    rmSync(b.dir, { recursive: true, force: true });
  }
});

test('normalize strips fingerprint and sorts keys', async () => {
  const t = tempTrace(SAMPLE_TRACE);
  try {
    const { code, stdout } = await captureMain(['normalize', t.path]);
    assert.equal(code, 0);
    const out = JSON.parse(stdout);
    assert.equal(out.fingerprint, undefined, 'fingerprint should be stripped');
    // Top-level keys must be sorted alphabetically after normalize.
    const keys = Object.keys(out);
    const sorted = [...keys].sort();
    assert.deepEqual(keys, sorted);
  } finally {
    rmSync(t.dir, { recursive: true, force: true });
  }
});

test('update writes the current trace into the baseline path on drift', async () => {
  const baseline = tempTrace(SAMPLE_TRACE);
  const current = tempTrace({
    ...SAMPLE_TRACE,
    output: 'CHANGED',
  });
  try {
    const { code, stdout } = await captureMain(['update', baseline.path, current.path]);
    assert.equal(code, 0);
    const out = JSON.parse(stdout);
    assert.equal(out.updated, true);
    // Re-read the baseline file and confirm it now matches current.
    const written = JSON.parse(readFileSync(baseline.path, 'utf8'));
    assert.equal(written.output, 'CHANGED');
  } finally {
    rmSync(baseline.dir, { recursive: true, force: true });
    rmSync(current.dir, { recursive: true, force: true });
  }
});

test('unknown subcommand exits 2 with usage error', async () => {
  const { code, stderr } = await captureMain(['nope']);
  assert.equal(code, 2);
  assert.match(stderr, /unknown subcommand/);
});
