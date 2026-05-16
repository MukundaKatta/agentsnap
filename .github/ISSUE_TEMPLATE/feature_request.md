---
name: Feature request
about: Propose a new snapshot strategy, a new redactor, or a behavior change.
title: "[feat] "
labels: enhancement
assignees: ''
---

## Scope check

Before opening, please confirm this proposal fits the project scope:

- [ ] It does **not** add a runtime dependency. (Zero deps is a hard line; PRs that add one will be redirected to an issue discussion first.)
- [ ] It does **not** perform network I/O. (agentsnap runs in the test process and reads/writes local snapshot files only.)
- [ ] It does **not** make the library "sandbox" the agent under test. (For tool egress controls, see [agentguard](https://github.com/MukundaKatta/agentguard); for arg validation, see [agentvet](https://github.com/MukundaKatta/agentvet).)

If any of those are unchecked, the right home is probably a sibling library in the agent-stack.

## What you want

A clear description of the proposed feature.

## Why

What real-world snapshot-test workflow does this address? Concrete example of the test pattern that would benefit.

## Proposed API shape

```jsonc
// new export or option:
// signature:
// snapshot file shape (if applicable):
```

## Alternatives considered

What workarounds exist today (custom matcher, hand-rolled diff, jest-style snapshot lib) and why aren't they good enough for tool-call traces?
