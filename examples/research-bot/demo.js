/**
 * The launch screenshot demo:
 *
 *   1. Run a research bot with claude-sonnet-4-6 — capture as baseline.
 *   2. Run the same bot, same prompt, with claude-haiku-4-5 — diff against baseline.
 *   3. Print the colored diff that would block CI.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... node demo.js
 */
import { writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { record, expectSnapshot, diff, formatDiff } from '../../src/index.js';
import { runResearchBot } from './agent.js';

const here = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = join(here, '__snapshots__', 'research.snap.json');

const PROMPT =
  "Research the topic 'RLHF' (reinforcement learning from human feedback). " +
  'Use the tools available. Save 3 specific findings as research notes. ' +
  'When done, briefly state what you found.';

const BASELINE_MODEL = 'claude-sonnet-4-6';
const REGRESSED_MODEL = 'claude-haiku-4-5-20251001';

function banner(text, char = '═') {
  const line = char.repeat(64);
  console.log(`\n${line}\n  ${text}\n${line}`);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set. Aborting.');
  process.exit(1);
}

if (existsSync(SNAPSHOT_PATH)) {
  await rm(SNAPSHOT_PATH);
}

banner(`Baseline run — ${BASELINE_MODEL}`);
const t0 = Date.now();
const baseline = await record(
  () => runResearchBot({ model: BASELINE_MODEL, prompt: PROMPT }),
  { input: PROMPT, model: BASELINE_MODEL }
);
console.log(`tool sequence: ${baseline.tools.map((t) => t.name).join(' → ')}`);
console.log(`(${baseline.tools.length} tool calls, ${Date.now() - t0}ms)`);

await expectSnapshot(baseline, SNAPSHOT_PATH);
console.log(`✓ baseline saved to ${SNAPSHOT_PATH.replace(here, '.')}`);

banner(`Regression run — same prompt, swapped to ${REGRESSED_MODEL}`);
const t1 = Date.now();
const current = await record(
  () => runResearchBot({ model: REGRESSED_MODEL, prompt: PROMPT }),
  { input: PROMPT, model: REGRESSED_MODEL }
);
console.log(`tool sequence: ${current.tools.map((t) => t.name).join(' → ')}`);
console.log(`(${current.tools.length} tool calls, ${Date.now() - t1}ms)`);

const result = diff(baseline, current);

banner(`agentsnap diff`, '─');
console.log(formatDiff(result, SNAPSHOT_PATH.replace(here, '.')));

await writeFile(
  join(here, 'last-current.snap.json'),
  JSON.stringify(current, null, 2) + '\n'
);

const exitFor = ['TOOLS_CHANGED', 'TOOLS_REORDERED', 'REGRESSION'];
if (exitFor.includes(result.status)) {
  console.log(`\n→ this would fail CI with status: ${result.status}\n`);
} else if (result.status === 'OUTPUT_DRIFT') {
  console.log(`\n→ this would warn (OUTPUT_DRIFT — tools identical, only text/results changed)\n`);
} else {
  console.log(`\n→ both models produced the same trace; demo did not surface a regression this run\n`);
}
