import { test } from 'node:test';
import assert from 'node:assert/strict';

import { record, traceTool } from '../src/recorder.js';

test('record() captures a tool call made inside the function', async () => {
  const search = traceTool('search', async ({ q }) => [`hit:${q}`]);

  const trace = await record(
    () => (async () => {
      const hits = await search({ q: 'sfo' });
      return `found ${hits.length}`;
    })(),
    { input: 'find sfo', model: 'test-model' }
  );

  assert.equal(trace.version, 1);
  assert.equal(trace.input, 'find sfo');
  assert.equal(trace.model, 'test-model');
  assert.equal(trace.output, 'found 1');
  assert.equal(trace.tools.length, 1);
  assert.equal(trace.tools[0].name, 'search');
  assert.deepEqual(trace.tools[0].args, { q: 'sfo' });
  assert.match(trace.tools[0].result_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(trace.error, null);
  assert.equal(trace.fingerprint.node, process.version);
});

test('record() captures multiple tool calls in order', async () => {
  const a = traceTool('a', async () => 1);
  const b = traceTool('b', async () => 2);
  const c = traceTool('c', async () => 3);

  const trace = await record(async () => {
    await a();
    await b();
    await c();
    return 'done';
  });

  assert.deepEqual(
    trace.tools.map((t) => t.name),
    ['a', 'b', 'c']
  );
});

test('record() captures a thrown error and stops without crashing', async () => {
  const trace = await record(async () => {
    throw new Error('boom');
  });
  assert.equal(trace.output, null);
  assert.equal(trace.error.name, 'Error');
  assert.equal(trace.error.message, 'boom');
});

test('record() captures tool errors', async () => {
  const failing = traceTool('failing', async () => {
    throw new Error('upstream down');
  });

  const trace = await record(async () => {
    try {
      await failing();
    } catch {
      /* swallow so we can see how the trace looks */
    }
  });

  assert.equal(trace.tools.length, 1);
  assert.equal(trace.tools[0].error.message, 'upstream down');
  assert.equal(trace.tools[0].result_hash, undefined);
});

test('traceTool() is a no-op outside record()', async () => {
  const tool = traceTool('outside', async (x) => x * 2);
  assert.equal(await tool(7), 14);
});

test('traceTool() preserves single-arg vs multi-arg call shape', async () => {
  const single = traceTool('single', async (obj) => obj);
  const multi = traceTool('multi', async (a, b) => [a, b]);

  const trace = await record(async () => {
    await single({ k: 'v' });
    await multi(1, 2);
  });

  assert.deepEqual(trace.tools[0].args, { k: 'v' });
  assert.deepEqual(trace.tools[1].args, [1, 2]);
});

test('record() with captureResults: true stores raw tool results', async () => {
  const tool = traceTool('echo', async (x) => ({ echoed: x }));
  const trace = await record(
    async () => {
      await tool('hello');
    },
    { captureResults: true }
  );
  assert.deepEqual(trace.tools[0].result, { echoed: 'hello' });
});

test('traceTool() validates arguments', () => {
  assert.throws(() => traceTool('', async () => {}), TypeError);
  assert.throws(() => traceTool('x', null), TypeError);
});

test('concurrent record() calls do not bleed tool calls into each other', async () => {
  const a = traceTool('a', async () => 'a');
  const b = traceTool('b', async () => 'b');

  const [traceA, traceB] = await Promise.all([
    record(async () => {
      await a();
      await new Promise((r) => setTimeout(r, 5));
      await a();
    }),
    record(async () => {
      await b();
    }),
  ]);

  assert.deepEqual(
    traceA.tools.map((t) => t.name),
    ['a', 'a']
  );
  assert.deepEqual(
    traceB.tools.map((t) => t.name),
    ['b']
  );
});
