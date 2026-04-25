/**
 * Runnable demo: shows what a snapshot regression looks like in the terminal.
 *
 *   node examples/demo-regression.js
 *
 * Step 1: an "agent" is recorded with a search → summarize tool sequence.
 * Step 2: the agent is "regressed" — it now calls fetch instead of search.
 * Step 3: agentsnap diffs the two traces and prints the failure.
 *
 * No real LLM, no network. The point is to see the diff output.
 */
import { record, traceTool, diff, formatDiff } from '../src/index.js';

const search = traceTool('search', async ({ q }) => [`hit:${q}-1`, `hit:${q}-2`]);
const fetchUrl = traceTool('fetch_url', async ({ url }) => `fetched ${url}`);
const summarize = traceTool('summarize', async ({ docs }) =>
  `summary of ${docs.length} docs`
);

async function goodAgent(question) {
  const docs = await search({ q: question });
  return summarize({ docs });
}

async function regressedAgent(question) {
  // Oops — someone swapped `search` for `fetch_url`.
  const docs = await fetchUrl({ url: `https://api.example.com/?q=${question}` });
  return summarize({ docs: [docs] });
}

const baseline = await record(() => goodAgent('RLHF'), {
  input: 'What is RLHF?',
  model: 'mock-deterministic',
});

const current = await record(() => regressedAgent('RLHF'), {
  input: 'What is RLHF?',
  model: 'mock-deterministic',
});

const result = diff(baseline, current);

console.log('═'.repeat(60));
console.log(' Baseline trace:');
console.log('═'.repeat(60));
console.log(JSON.stringify({ tools: baseline.tools.map((t) => t.name) }, null, 2));
console.log();
console.log('═'.repeat(60));
console.log(' Current trace:');
console.log('═'.repeat(60));
console.log(JSON.stringify({ tools: current.tools.map((t) => t.name) }, null, 2));
console.log();
console.log('═'.repeat(60));
console.log(' agentsnap diff:');
console.log('═'.repeat(60));
console.log(formatDiff(result, 'examples/__snapshots__/demo.snap.json'));
console.log();
console.log(`exit status would be: ${result.status === 'PASSED' ? 0 : 1}`);
process.exit(result.status === 'PASSED' ? 0 : 0); // demo always exits 0 so CI doesn't fail on it
