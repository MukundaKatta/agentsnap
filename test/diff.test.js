import { test } from 'node:test';
import assert from 'node:assert/strict';

import { diff } from '../src/diff.js';

function trace(overrides = {}) {
  return {
    version: 1,
    model: 'm',
    input: 'in',
    output: 'out',
    tools: [],
    error: null,
    fingerprint: { node: 'v22.0.0', agentsnap: '0.1.0' },
    ...overrides,
  };
}

test('PASSED on identical traces (fingerprint ignored)', () => {
  const a = trace({ tools: [{ name: 't', args: { x: 1 }, result_hash: 'sha256:aa' }] });
  const b = trace({
    tools: [{ name: 't', args: { x: 1 }, result_hash: 'sha256:aa' }],
    fingerprint: { node: 'v23.0.0', agentsnap: '0.9.0' },
  });
  assert.equal(diff(a, b).status, 'PASSED');
});

test('REGRESSION when current has new top-level error', () => {
  const a = trace();
  const b = trace({ error: { name: 'Error', message: 'boom' } });
  const r = diff(a, b);
  assert.equal(r.status, 'REGRESSION');
  assert.equal(r.changes[0].path, 'error');
});

test('REGRESSION when a tool newly errors', () => {
  const a = trace({ tools: [{ name: 't', args: {}, result_hash: 'sha256:aa' }] });
  const b = trace({
    tools: [{ name: 't', args: {}, error: { name: 'E', message: 'down' } }],
  });
  assert.equal(diff(a, b).status, 'REGRESSION');
});

test('TOOLS_CHANGED when a tool is added', () => {
  const a = trace({ tools: [{ name: 'a', args: {}, result_hash: 'sha256:1' }] });
  const b = trace({
    tools: [
      { name: 'a', args: {}, result_hash: 'sha256:1' },
      { name: 'b', args: {}, result_hash: 'sha256:2' },
    ],
  });
  assert.equal(diff(a, b).status, 'TOOLS_CHANGED');
});

test('TOOLS_CHANGED when a tool name swaps', () => {
  const a = trace({ tools: [{ name: 'search', args: { q: 'x' }, result_hash: 'sha256:1' }] });
  const b = trace({ tools: [{ name: 'lookup', args: { q: 'x' }, result_hash: 'sha256:1' }] });
  assert.equal(diff(a, b).status, 'TOOLS_CHANGED');
});

test('TOOLS_CHANGED when args differ', () => {
  const a = trace({
    tools: [{ name: 'search', args: { q: 'sfo' }, result_hash: 'sha256:1' }],
  });
  const b = trace({
    tools: [{ name: 'search', args: { q: 'lax' }, result_hash: 'sha256:1' }],
  });
  const r = diff(a, b);
  assert.equal(r.status, 'TOOLS_CHANGED');
  assert.equal(r.changes[0].path, 'tools[0].args');
});

test('TOOLS_REORDERED when same multiset, different order', () => {
  const a = trace({
    tools: [
      { name: 'a', args: {}, result_hash: 'sha256:1' },
      { name: 'b', args: {}, result_hash: 'sha256:2' },
    ],
  });
  const b = trace({
    tools: [
      { name: 'b', args: {}, result_hash: 'sha256:2' },
      { name: 'a', args: {}, result_hash: 'sha256:1' },
    ],
  });
  assert.equal(diff(a, b).status, 'TOOLS_REORDERED');
});

test('OUTPUT_DRIFT when only output text differs', () => {
  const a = trace({ output: 'hello world' });
  const b = trace({ output: 'hello, world!' });
  const r = diff(a, b);
  assert.equal(r.status, 'OUTPUT_DRIFT');
  assert.equal(r.changes[0].path, 'output');
});

test('OUTPUT_DRIFT when result_hash drifts (external nondeterminism)', () => {
  const a = trace({
    tools: [{ name: 'fetch', args: { url: 'x' }, result_hash: 'sha256:aaa' }],
  });
  const b = trace({
    tools: [{ name: 'fetch', args: { url: 'x' }, result_hash: 'sha256:bbb' }],
  });
  assert.equal(diff(a, b).status, 'OUTPUT_DRIFT');
});

test('OUTPUT_DRIFT also surfaces model change', () => {
  const a = trace({ model: 'claude-sonnet-4-6', output: 'same' });
  const b = trace({ model: 'claude-sonnet-4-7', output: 'changed' });
  const r = diff(a, b);
  assert.equal(r.status, 'OUTPUT_DRIFT');
  assert.ok(r.changes.some((c) => c.path === 'model'));
  assert.ok(r.changes.some((c) => c.path === 'output'));
});

test('REGRESSION wins over TOOLS_CHANGED when both happen', () => {
  const a = trace({ tools: [{ name: 'a', args: {}, result_hash: 'sha256:1' }] });
  const b = trace({
    tools: [{ name: 'b', args: {}, result_hash: 'sha256:2' }],
    error: { name: 'E', message: 'x' },
  });
  assert.equal(diff(a, b).status, 'REGRESSION');
});

test('diff() throws on bad input', () => {
  assert.throws(() => diff(null, trace()), TypeError);
  assert.throws(() => diff(trace(), null), TypeError);
});
