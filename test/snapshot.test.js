import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { record, traceTool } from '../src/recorder.js';
import { expectSnapshot } from '../src/snapshot.js';

let tmp;
before(() => {
  tmp = mkdtempSync(join(tmpdir(), 'agentsnap-test-'));
});
after(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function makeTrace() {
  const tool = traceTool('echo', async (x) => x);
  return record(
    async () => {
      await tool('hi');
      return 'ok';
    },
    { input: 'in', model: 'test' }
  );
}

test('expectSnapshot writes a new snapshot when the file is missing', async () => {
  const trace = await makeTrace();
  const path = join(tmp, 'created.snap.json');
  const result = await expectSnapshot(trace, path);
  assert.equal(result.status, 'CREATED');
  assert.ok(existsSync(path));
  const written = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(written.tools[0].name, 'echo');
});

test('expectSnapshot returns PASSED when the trace matches the baseline', async () => {
  const trace = await makeTrace();
  const path = join(tmp, 'passed.snap.json');
  await expectSnapshot(trace, path);
  const second = await expectSnapshot(await makeTrace(), path);
  assert.equal(second.status, 'PASSED');
});

test('expectSnapshot throws on TOOLS_CHANGED by default', async () => {
  const path = join(tmp, 'changed.snap.json');
  const baseline = await record(async () => {
    const a = traceTool('a', async () => 1);
    await a();
  });
  await expectSnapshot(baseline, path);

  const drifted = await record(async () => {
    const b = traceTool('b', async () => 2);
    await b();
  });
  await assert.rejects(() => expectSnapshot(drifted, path), {
    name: 'AgentSnapshotMismatch',
  });
});

test('expectSnapshot does not throw on OUTPUT_DRIFT by default', async () => {
  const path = join(tmp, 'drift.snap.json');
  const tool = traceTool('t', async () => 1);

  const baseline = await record(async () => {
    await tool();
    return 'old';
  });
  await expectSnapshot(baseline, path);

  const drifted = await record(async () => {
    await tool();
    return 'new';
  });
  const r = await expectSnapshot(drifted, path);
  assert.equal(r.status, 'OUTPUT_DRIFT');
});

test('expectSnapshot AGENTSNAP_UPDATE=1 overwrites the baseline', async () => {
  const path = join(tmp, 'updated.snap.json');
  const v1 = await record(async () => {
    const a = traceTool('a', async () => 1);
    await a();
  });
  await expectSnapshot(v1, path);

  const v2 = await record(async () => {
    const b = traceTool('b', async () => 2);
    await b();
  });

  process.env.AGENTSNAP_UPDATE = '1';
  try {
    const r = await expectSnapshot(v2, path);
    assert.equal(r.status, 'UPDATED');
  } finally {
    delete process.env.AGENTSNAP_UPDATE;
  }

  const written = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(written.tools[0].name, 'b');
});

test('expectSnapshot opts.failOn lets caller widen failure surface', async () => {
  const path = join(tmp, 'strict.snap.json');
  const tool = traceTool('t', async () => 1);

  const baseline = await record(async () => {
    await tool();
    return 'old';
  });
  await expectSnapshot(baseline, path);

  const drifted = await record(async () => {
    await tool();
    return 'new';
  });

  await assert.rejects(
    () =>
      expectSnapshot(drifted, path, {
        failOn: ['OUTPUT_DRIFT', 'TOOLS_CHANGED', 'TOOLS_REORDERED', 'REGRESSION'],
      }),
    { name: 'AgentSnapshotMismatch' }
  );
});

test('expectSnapshot rejects bad input', async () => {
  await assert.rejects(() => expectSnapshot(null, 'x'), TypeError);
  await assert.rejects(() => expectSnapshot({}, ''), TypeError);
});
