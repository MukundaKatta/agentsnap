#!/usr/bin/env node
/**
 * agentsnap CLI — diff/normalize/update agent traces from the terminal.
 *
 * Subcommands:
 *   agentsnap diff <baseline.json> <current.json> [--pretty]
 *   agentsnap normalize <trace.json|->            [--pretty]
 *   agentsnap update <baseline.json> <current.json> [--yes] [--pretty]
 *
 * Conventions shared across the @mukundakatta agent CLIs:
 *   - `-` reads stdin
 *   - JSON to stdout for machine consumers; --pretty for humans
 *   - exit 0 = no drift, 1 = drift / parse error, 2 = usage error
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { diff } from './diff.js';
import { VERSION } from './version.js';

const USAGE = `agentsnap v${VERSION} — snapshot diff/normalize/update for agent traces.

Usage:
  agentsnap diff <baseline.json> <current.json>      [--pretty]
  agentsnap normalize <trace.json|->                 [--pretty]
  agentsnap update <baseline.json> <current.json>    [--yes] [--pretty]
  agentsnap --help | --version

Notes:
  Pass '-' as the input to read from stdin (where supported).
  diff      emits the result of the diff() API as JSON; exits 1 on drift.
  normalize emits the canonical (key-sorted, fingerprint-stripped) trace.
  update    overwrites <baseline.json> with <current.json> after diffing.
            Refuses to overwrite if there is no drift unless --yes is set.
  Exit codes: 0 ok / no drift, 1 drift / parse error, 2 usage error.
`;

// --- main ---

export async function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    process.stdout.write(USAGE);
    return 0;
  }
  if (argv[0] === '--version' || argv[0] === '-v') {
    process.stdout.write(VERSION + '\n');
    return 0;
  }

  const sub = argv[0];
  const rest = argv.slice(1);
  try {
    if (sub === 'diff') return await runDiff(rest);
    if (sub === 'normalize') return await runNormalize(rest);
    if (sub === 'update') return await runUpdate(rest);
    process.stderr.write(`agentsnap: unknown subcommand '${sub}'\n\n${USAGE}`);
    return 2;
  } catch (err) {
    return reportError(err);
  }
}

// --- diff ---

async function runDiff(args) {
  const flags = parseFlags(args, { boolean: ['pretty'] });
  if (flags._.length < 2) {
    process.stderr.write('agentsnap diff: requires <baseline.json> <current.json>\n');
    return 2;
  }
  const baseline = await readJson(flags._[0]);
  const current = await readJson(flags._[1]);
  const result = diff(baseline, current);
  emit(result, flags.pretty);
  return result.status === 'PASSED' ? 0 : 1;
}

// --- normalize ---

async function runNormalize(args) {
  const flags = parseFlags(args, { boolean: ['pretty'] });
  if (flags._.length === 0) {
    process.stderr.write('agentsnap normalize: missing <trace.json|-> argument\n');
    return 2;
  }
  const trace = await readJson(flags._[0]);
  // Strip the runtime fingerprint and sort keys deterministically — same logic
  // diff() uses internally, exposed so users can canonicalize before storage.
  const { fingerprint: _ignored, ...rest } = trace ?? {};
  const canonical = sortKeys(rest);
  emit(canonical, flags.pretty);
  return 0;
}

// --- update ---

async function runUpdate(args) {
  const flags = parseFlags(args, { boolean: ['yes', 'pretty'] });
  if (flags._.length < 2) {
    process.stderr.write('agentsnap update: requires <baseline.json> <current.json>\n');
    return 2;
  }
  const baselinePath = flags._[0];
  const currentPath = flags._[1];

  const baseline = existsSync(baselinePath) ? await readJson(baselinePath) : null;
  const current = await readJson(currentPath);

  let driftStatus = 'CREATED';
  if (baseline) {
    const r = diff(baseline, current);
    driftStatus = r.status;
    if (r.status === 'PASSED' && !flags.yes) {
      // No drift detected, so writing would be a no-op. Refuse unless --yes
      // tells us "I know, write it anyway."
      emit({ updated: false, reason: 'no-drift', baseline: baselinePath }, flags.pretty);
      return 0;
    }
  }

  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, JSON.stringify(current, null, 2) + '\n', 'utf8');
  emit({ updated: true, baseline: baselinePath, prevStatus: driftStatus }, flags.pretty);
  return 0;
}

// --- helpers ---

async function readJson(arg) {
  const raw = await resolveInput(arg);
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new ParseError(`'${arg}' is not valid JSON: ${err.message}`);
  }
}

async function resolveInput(arg) {
  if (arg === '-') return await readStdin();
  if (existsSync(arg)) return readFileSync(arg, 'utf8');
  throw new UsageError(`file not found: ${arg}`);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

// Same key-sort used by diff.js; duplicated here so normalize() doesn't depend
// on internal helpers (keeps the public surface stable).
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

/**
 * Tiny argv parser. Same shape as the other @mukundakatta CLIs.
 */
function parseFlags(argv, schema) {
  const flags = { _: [] };
  for (const name of schema.boolean ?? []) flags[name] = false;
  for (const name of schema.string ?? []) flags[name] = undefined;

  const wantsValue = new Set(schema.string ?? []);

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (tok === '--') {
      flags._.push(...argv.slice(i + 1));
      break;
    }
    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      const name = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
      const inlineValue = eq === -1 ? null : tok.slice(eq + 1);
      if (wantsValue.has(name)) {
        const raw = inlineValue ?? argv[++i];
        if (raw === undefined) throw new UsageError(`flag --${name} requires a value`);
        flags[name] = raw;
      } else if ((schema.boolean ?? []).includes(name)) {
        flags[name] = true;
      } else {
        throw new UsageError(`unknown flag --${name}`);
      }
    } else {
      flags._.push(tok);
    }
  }
  return flags;
}

function emit(value, pretty) {
  const json = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  process.stdout.write(json + '\n');
}

class UsageError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UsageError';
    this.exitCode = 2;
  }
}

class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ParseError';
    this.exitCode = 1;
  }
}

function reportError(err) {
  if (err && (err.name === 'UsageError' || err.name === 'ParseError')) {
    process.stderr.write(`agentsnap: ${err.message}\n`);
    return err.exitCode ?? 2;
  }
  process.stderr.write(`agentsnap: ${err?.message ?? err}\n`);
  return 1;
}

const isMain =
  process.argv[1] && (process.argv[1].endsWith('cli.js') || process.argv[1].endsWith('agentsnap'));
if (isMain) {
  main().then(
    (code) => process.exit(code ?? 0),
    (err) => {
      process.stderr.write(`agentsnap: ${err?.stack ?? err}\n`);
      process.exit(1);
    }
  );
}
