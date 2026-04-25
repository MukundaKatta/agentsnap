const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

const STATUS_COLOR = {
  PASSED: COLORS.green,
  OUTPUT_DRIFT: COLORS.yellow,
  TOOLS_REORDERED: COLORS.yellow,
  TOOLS_CHANGED: COLORS.red,
  REGRESSION: COLORS.red,
};

const useColor =
  typeof process !== 'undefined' &&
  process.stdout?.isTTY &&
  !process.env.NO_COLOR;

/**
 * Render a diff result as a human-readable terminal block.
 *
 * @param {import('./diff.js').DiffResult} result
 * @param {string} [path]
 * @returns {string}
 */
export function formatDiff(result, path) {
  const lines = [];
  const headerColor = STATUS_COLOR[result.status] ?? COLORS.red;

  lines.push(c(headerColor + COLORS.bold, `agentsnap: ${result.status}`));
  if (path) lines.push(c(COLORS.dim, `  snapshot: ${path}`));
  lines.push('');

  if (!result.changes || result.changes.length === 0) {
    lines.push(c(COLORS.dim, '  (no diff details)'));
    return lines.join('\n');
  }

  for (const change of result.changes) {
    lines.push(c(COLORS.bold, `  • ${change.path}`));
    lines.push(c(COLORS.red, '    - ' + display(change.from)));
    lines.push(c(COLORS.green, '    + ' + display(change.to)));
    lines.push('');
  }

  if (result.status !== 'PASSED') {
    lines.push(
      c(COLORS.dim, '  Regenerate with: AGENTSNAP_UPDATE=1 <test command>')
    );
  }

  return lines.join('\n');
}

function display(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.every((v) => typeof v === 'string')) {
      return '[' + value.map((v) => JSON.stringify(v)).join(', ') + ']';
    }
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

function c(color, text) {
  if (!useColor) return text;
  return color + text + COLORS.reset;
}
