/**
 * Basic example: a 3-step "agent" with one tool call.
 * Shows the minimum surface needed to wire agentsnap into any test runner.
 */
import { test } from 'node:test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { record, traceTool, expectSnapshot } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAP_DIR = join(here, '__snapshots__');

const lookupCity = traceTool('lookup_city', async ({ code }) => {
  const cities = { SFO: 'San Francisco', JFK: 'New York', LHR: 'London' };
  return { code, name: cities[code] ?? 'Unknown' };
});

async function cityAgent(code) {
  const { name } = await lookupCity({ code });
  return `${code} is ${name}`;
}

test('cityAgent matches its baseline', async () => {
  const trace = await record(() => cityAgent('SFO'), {
    input: 'SFO',
    model: 'mock-deterministic',
  });
  await expectSnapshot(trace, join(SNAP_DIR, 'basic.snap.json'));
});
