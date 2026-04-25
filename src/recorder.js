import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';

import { VERSION } from './version.js';

const recorderStore = new AsyncLocalStorage();

/**
 * Run `fn` while capturing every traceTool() call that happens inside it
 * (including nested async work). Returns a structured trace.
 *
 * @param {() => Promise<any>} fn
 * @param {{ input?: string, model?: string, captureResults?: boolean }} [opts]
 * @returns {Promise<Trace>}
 */
export async function record(fn, opts = {}) {
  const recorder = {
    tools: [],
    captureResults: opts.captureResults === true,
  };

  let output;
  let error = null;
  try {
    output = await recorderStore.run(recorder, () => fn());
  } catch (err) {
    error = serializeError(err);
  }

  return {
    version: 1,
    model: opts.model ?? null,
    input: opts.input ?? null,
    output: error ? null : normalizeOutput(output),
    tools: recorder.tools,
    error,
    fingerprint: {
      node: process.version,
      agentsnap: VERSION,
    },
  };
}

/**
 * Wrap a tool function. When called inside a record() block, the call is
 * appended to the active trace. Outside record(), it's a no-op pass-through.
 *
 * @template {(...args: any[]) => any} F
 * @param {string} name
 * @param {F} fn
 * @returns {F}
 */
export function traceTool(name, fn) {
  if (typeof name !== 'string' || !name) {
    throw new TypeError('traceTool: name must be a non-empty string');
  }
  if (typeof fn !== 'function') {
    throw new TypeError('traceTool: fn must be a function');
  }

  return /** @type {F} */ (
    async function tracedTool(...args) {
      const recorder = recorderStore.getStore();
      if (!recorder) return fn(...args);

      const argsForCall = args.length === 1 ? args[0] : args;
      const entry = { name, args: argsForCall };
      let result;
      try {
        result = await fn(...args);
      } catch (err) {
        entry.error = serializeError(err);
        recorder.tools.push(entry);
        throw err;
      }
      entry.result_hash = hashResult(result);
      if (recorder.captureResults) {
        entry.result = result;
      }
      recorder.tools.push(entry);
      return result;
    }
  );
}

function normalizeOutput(value) {
  if (value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function serializeError(err) {
  if (!err) return null;
  return {
    name: err.name ?? 'Error',
    message: err.message ?? String(err),
  };
}

function hashResult(value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return 'sha256:' + createHash('sha256').update(str).digest('hex');
}

/**
 * @typedef {Object} ToolCall
 * @property {string} name
 * @property {any} args
 * @property {string} [result_hash]
 * @property {any} [result]
 * @property {{ name: string, message: string }} [error]
 */

/**
 * @typedef {Object} Trace
 * @property {number} version
 * @property {string|null} model
 * @property {string|null} input
 * @property {string|null} output
 * @property {ToolCall[]} tools
 * @property {{ name: string, message: string }|null} error
 * @property {{ node: string, agentsnap: string }} fingerprint
 */
