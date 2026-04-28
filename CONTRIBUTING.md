# Contributing to agentsnap

Small, focused PRs welcome. Bigger design changes — open an issue first
so we can sanity-check direction before you build.

## Setup

```sh
gh repo clone MukundaKatta/agentsnap
cd agentsnap
npm install
```

## Run

```sh
npm test                 # 37 tests via Node's built-in runner
npm run test:coverage    # gates at 70% branches / 80% lines+funcs+stmts
```

## Style

- Plain ESM, zero runtime dependencies. If you think a dep is needed,
  open an issue first — likely the answer is "no, but here's the inline
  pattern."
- One PR = one focused change.

## Releases

This repo uses semver. `0.1.x` is patch releases (bug fixes / tooling /
no API change). Cutting `0.2.0` requires a migration note in the README.
