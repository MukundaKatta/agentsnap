# Security Policy

## Supported Versions

agentsnap is at v0.1.x. Security fixes will be issued for the current minor (0.1.x). Older minors will not receive backports.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately by emailing `mukunda.vjcs6@gmail.com` with the subject `[agentsnap security]`. Include:

- A description of the vulnerability and its impact.
- The version of agentsnap affected (`npm ls @mukundakatta/agentsnap`).
- Reproduction steps or a minimal proof-of-concept.
- Any suggested mitigation, if you have one.

You can expect:

- An acknowledgment within 5 business days.
- A status update within 14 days.
- A coordinated disclosure window of at most 90 days from the acknowledgment.

## Specific Risk Surfaces

agentsnap is a small, zero-runtime-dependency JavaScript library for recording and asserting on agent tool-call traces. It runs entirely in the test process. Areas worth special attention:

- **Snapshot file deserialization.** agentsnap reads JSON files from `__snapshots__/` directories that callers point it at. The reader uses `JSON.parse`, no `eval`, no `Function`. If you find a path where a maliciously crafted snapshot file can execute code, write outside the snapshot directory, or cause `expectSnapshot` to silently pass a regressing run, that's a high-severity report.
- **Path traversal via snapshot names.** Snapshot names are caller-provided and combine into a filesystem path. If a snapshot name containing `..`, absolute-path components, or null bytes can escape the configured snapshot directory, please report.
- **`AGENTSNAP_UPDATE=1` foot-gun.** The env var rewrites snapshot baselines on disk. This is intentional, but if you find a way it can be triggered without the env var being set in the current process (e.g. through an argument, through configuration, through a default), report it.
- **Tool-trace redaction bypass.** Callers can configure redactors that scrub keys / values from a recorded trace before it's written. If you find a path where a redactor is silently skipped (deep nesting, prototype-poisoned input, cyclic references handled by relaxing redaction), that's worth reporting.
- **Prototype pollution.** The library merges caller-provided options with defaults. Any input that mutates `Object.prototype` and survives across calls is a real issue.

## Out of scope

- **Network exfiltration via the agent under test.** agentsnap records what your agent did; it does not sandbox the agent. If your tools fetch URLs, that's a job for [agentguard](https://github.com/MukundaKatta/agentguard), not agentsnap.
- **LLM provider behavior.** Snapshot expectations are about *your* agent's tool-call shape, not about what the model emits.
- **Secret scrubbing in snapshots.** Use a redactor. Out-of-the-box, agentsnap will record what you give it.

## Dependencies

agentsnap has **zero** runtime dependencies, by design. The only dev dependency is `c8` for coverage reporting. Any future addition is reviewed for security impact and dependency confusion risk.

We will not pay bug bounties at this time.
