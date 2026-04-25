/**
 * agentsnap — snapshot tests for AI agents.
 *
 * Hand-maintained declarations. Source is JS (with JSDoc) so this file is the
 * single source of truth for TypeScript consumers. Keep in sync with src/*.js.
 */

export const VERSION: string;

export type DiffStatus =
  | 'PASSED'
  | 'OUTPUT_DRIFT'
  | 'TOOLS_REORDERED'
  | 'TOOLS_CHANGED'
  | 'REGRESSION';

export interface ToolCall {
  /** The name passed to traceTool(). */
  name: string;
  /** The arguments the tool was called with. Single arg = the value; multiple args = the array. */
  args: unknown;
  /** SHA-256 of the JSON-serialized tool result. Absent if the tool errored. */
  result_hash?: string;
  /** Raw tool result. Only present if record() was called with captureResults: true. */
  result?: unknown;
  /** Set instead of result_hash when the tool threw. */
  error?: { name: string; message: string };
}

export interface Trace {
  version: number;
  model: string | null;
  input: string | null;
  output: string | null;
  tools: ToolCall[];
  error: { name: string; message: string } | null;
  fingerprint: { node: string; agentsnap: string };
}

export interface RecordOptions {
  /** Stored verbatim in trace.input. */
  input?: string;
  /** Stored verbatim in trace.model. */
  model?: string;
  /**
   * If true, raw tool results are stored alongside their hash. Default false to
   * keep snapshots small and avoid leaking PII from tool responses.
   */
  captureResults?: boolean;
}

export interface Change {
  /** Dot/bracket path into the trace (e.g. "tools[0].args"). */
  path: string;
  from: unknown;
  to: unknown;
}

export interface DiffResult {
  status: DiffStatus;
  changes: Change[];
}

export interface SnapshotOptions {
  /** Force overwrite the on-disk baseline regardless of AGENTSNAP_UPDATE. */
  update?: boolean;
  /**
   * Statuses that should throw. Default: ['TOOLS_CHANGED', 'TOOLS_REORDERED', 'REGRESSION'].
   * Pass ['OUTPUT_DRIFT', ...defaults] to fail on any drift.
   */
  failOn?: DiffStatus[];
}

export interface SnapshotResult {
  /** 'CREATED' if the file was new, 'UPDATED' if regenerated, otherwise the diff status. */
  status: 'CREATED' | 'UPDATED' | DiffStatus;
  path: string;
  changes?: Change[];
}

/**
 * Run an async function and capture every traceTool() call inside it.
 * Returns a structured trace suitable for snapshotting or programmatic diffing.
 */
export function record<T = unknown>(
  fn: () => Promise<T> | T,
  opts?: RecordOptions
): Promise<Trace>;

/**
 * Wrap a tool function. Inside record(), calls are appended to the active
 * trace; outside record(), it's a transparent pass-through. Works across
 * async boundaries (Promise.all, timers, nested awaits) via AsyncLocalStorage.
 */
export function traceTool<F extends (...args: any[]) => any>(
  name: string,
  fn: F
): F;

/**
 * Compare a trace against an on-disk baseline. Writes the baseline if
 * missing, regenerates if AGENTSNAP_UPDATE=1 (or opts.update), otherwise
 * diffs and throws AgentSnapshotMismatch on a failing status.
 */
export function expectSnapshot(
  trace: Trace,
  path: string,
  opts?: SnapshotOptions
): Promise<SnapshotResult>;

/**
 * Low-level diff. Use this when you want to inspect or filter the result
 * yourself instead of letting expectSnapshot throw.
 */
export function diff(baseline: Trace, current: Trace): DiffResult;

/**
 * Render a diff result as a colored terminal block. Honors NO_COLOR and
 * isTTY. Used internally for the AgentSnapshotMismatch error message.
 */
export function formatDiff(result: DiffResult, path?: string): string;

/**
 * Thrown by expectSnapshot when the diff status is in failOn.
 * Catch this if you want to handle snapshot mismatches programmatically.
 */
export interface AgentSnapshotMismatch extends Error {
  name: 'AgentSnapshotMismatch';
  status: DiffStatus;
  changes: Change[];
  snapshotPath: string;
}
