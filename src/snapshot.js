import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { diff } from './diff.js';
import { formatDiff } from './format.js';

const DEFAULT_FAILING = ['TOOLS_CHANGED', 'TOOLS_REORDERED', 'REGRESSION'];

/**
 * Compare a trace against an on-disk snapshot. Behaviour:
 *   - If the file doesn't exist → write it (status: 'CREATED').
 *   - If env AGENTSNAP_UPDATE=1 (or opts.update) → overwrite (status: 'UPDATED').
 *   - Otherwise diff. If the diff status is in opts.failOn (default:
 *     TOOLS_CHANGED | TOOLS_REORDERED | REGRESSION), throw a formatted error
 *     so the host test runner records a failure.
 *
 * @param {import('./recorder.js').Trace} trace
 * @param {string} path
 * @param {{ update?: boolean, failOn?: string[] }} [opts]
 * @returns {Promise<{ status: string, path: string, changes?: any[] }>}
 */
export async function expectSnapshot(trace, path, opts = {}) {
  if (!trace || typeof trace !== 'object') {
    throw new TypeError('expectSnapshot: trace must be an object (returned by record())');
  }
  if (typeof path !== 'string' || !path) {
    throw new TypeError('expectSnapshot: path must be a non-empty string');
  }

  const update = opts.update === true || process.env.AGENTSNAP_UPDATE === '1';
  const failOn = opts.failOn ?? DEFAULT_FAILING;

  if (!existsSync(path)) {
    await writeSnapshot(path, trace);
    return { status: 'CREATED', path };
  }

  if (update) {
    await writeSnapshot(path, trace);
    return { status: 'UPDATED', path };
  }

  const baseline = JSON.parse(await readFile(path, 'utf8'));
  const result = diff(baseline, trace);

  if (failOn.includes(result.status)) {
    const err = new Error(formatDiff(result, path));
    err.name = 'AgentSnapshotMismatch';
    err.status = result.status;
    err.changes = result.changes;
    err.snapshotPath = path;
    throw err;
  }

  return { status: result.status, path, changes: result.changes };
}

async function writeSnapshot(path, trace) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(trace, null, 2) + '\n', 'utf8');
}
