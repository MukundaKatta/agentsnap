/**
 * agentsnap — snapshot tests for AI agents.
 *
 * Public surface:
 *   - record(fn, opts?)       run an agent function and capture its tool-call trace
 *   - traceTool(name, fn)     wrap a tool function so calls inside record() are recorded
 *   - expectSnapshot(trace, path, opts?)  compare against a baseline file (writes if missing)
 *   - diff(baseline, current) low-level diff engine returning { status, changes }
 *   - formatDiff(result, path?)  render a human-readable diff for terminal output
 */

export { record, traceTool } from './recorder.js';
export { expectSnapshot } from './snapshot.js';
export { diff } from './diff.js';
export { formatDiff } from './format.js';
export { VERSION } from './version.js';
