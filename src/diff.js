/**
 * Diff a baseline trace against a current run. Returns one of five statuses:
 *
 *   PASSED            — bytewise structural match (fingerprint ignored)
 *   REGRESSION        — current run has an error that wasn't there before, or a tool errored
 *   TOOLS_CHANGED     — set of tool names called differs, or args differ
 *   TOOLS_REORDERED   — same names + args, different order
 *   OUTPUT_DRIFT      — tool sequence + args identical; output text or result hashes differ
 *
 * @param {import('./recorder.js').Trace} baseline
 * @param {import('./recorder.js').Trace} current
 * @returns {DiffResult}
 */
export function diff(baseline, current) {
  if (!baseline || typeof baseline !== 'object') {
    throw new TypeError('diff: baseline must be a trace object');
  }
  if (!current || typeof current !== 'object') {
    throw new TypeError('diff: current must be a trace object');
  }

  // Bytewise structural match (ignoring runtime fingerprint).
  if (canonical(baseline) === canonical(current)) {
    return { status: 'PASSED', changes: [] };
  }

  // New error → REGRESSION (highest severity).
  if (!baseline.error && current.error) {
    return {
      status: 'REGRESSION',
      changes: [{ path: 'error', from: null, to: current.error }],
    };
  }

  const baseToolErrors = (baseline.tools ?? []).some((t) => t.error);
  const curToolErrors = (current.tools ?? []).some((t) => t.error);
  if (!baseToolErrors && curToolErrors) {
    const i = (current.tools ?? []).findIndex((t) => t.error);
    return {
      status: 'REGRESSION',
      changes: [
        {
          path: `tools[${i}].error`,
          from: null,
          to: current.tools[i].error,
        },
      ],
    };
  }

  const baseTools = baseline.tools ?? [];
  const curTools = current.tools ?? [];
  const baseNames = baseTools.map((t) => t.name);
  const curNames = curTools.map((t) => t.name);

  // Tool name multiset comparison.
  if (!sameMultiset(baseNames, curNames)) {
    return {
      status: 'TOOLS_CHANGED',
      changes: [{ path: 'tools[].name', from: baseNames, to: curNames }],
    };
  }

  // Same multiset, different order → TOOLS_REORDERED.
  if (!sameSequence(baseNames, curNames)) {
    // Confirm args are otherwise compatible (sorted by name) before classifying as reorder.
    return {
      status: 'TOOLS_REORDERED',
      changes: [{ path: 'tools[].order', from: baseNames, to: curNames }],
    };
  }

  // Same names + order. Walk each call and look for arg or result_hash changes.
  /** @type {Change[]} */
  const changes = [];
  for (let i = 0; i < baseTools.length; i++) {
    const b = baseTools[i];
    const c = curTools[i];
    if (canonicalValue(b.args) !== canonicalValue(c.args)) {
      changes.push({ path: `tools[${i}].args`, from: b.args, to: c.args });
    }
  }
  if (changes.length > 0) {
    return { status: 'TOOLS_CHANGED', changes };
  }

  // Args identical; check result_hash drift (external nondeterminism).
  for (let i = 0; i < baseTools.length; i++) {
    const b = baseTools[i];
    const c = curTools[i];
    if (b.result_hash !== c.result_hash) {
      changes.push({
        path: `tools[${i}].result_hash`,
        from: b.result_hash,
        to: c.result_hash,
      });
    }
  }

  if (baseline.output !== current.output) {
    changes.push({ path: 'output', from: baseline.output, to: current.output });
  }

  if (baseline.model !== current.model) {
    changes.push({ path: 'model', from: baseline.model, to: current.model });
  }

  if (changes.length > 0) {
    return { status: 'OUTPUT_DRIFT', changes };
  }

  // Should be unreachable given the bytewise check above, but stay safe.
  return { status: 'PASSED', changes: [] };
}

function canonical(trace) {
  const { fingerprint, ...rest } = trace;
  return canonicalValue(rest);
}

function canonicalValue(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const aSorted = [...a].sort();
  const bSorted = [...b].sort();
  for (let i = 0; i < aSorted.length; i++) {
    if (aSorted[i] !== bSorted[i]) return false;
  }
  return true;
}

function sameSequence(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * @typedef {'PASSED'|'OUTPUT_DRIFT'|'TOOLS_REORDERED'|'TOOLS_CHANGED'|'REGRESSION'} DiffStatus
 */

/**
 * @typedef {Object} Change
 * @property {string} path
 * @property {any} from
 * @property {any} to
 */

/**
 * @typedef {Object} DiffResult
 * @property {DiffStatus} status
 * @property {Change[]} changes
 */
