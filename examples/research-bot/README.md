# research-bot demo

Realistic agentsnap demo using the real Anthropic SDK. Same prompt, two models, see whether the tool sequence drifts.

## Run it

```bash
cd examples/research-bot
npm install
export ANTHROPIC_API_KEY=sk-ant-...
node demo.js
```

## What happens

1. A 3-tool research bot (`search_web`, `read_page`, `save_note`) is asked to research RLHF and save 3 findings.
2. Run 1 uses `claude-sonnet-4-6` — captured as the baseline snapshot.
3. Run 2 uses `claude-haiku-4-5-20251001` with the **same prompt** — diffed against baseline.
4. agentsnap prints the colored diff that would block CI.

The tools return deterministic mock data, so any diff you see is a real change in agent behavior — not flaky network state.

## Cost

~6-10 Anthropic API calls per run. Roughly $0.05-0.20 total per `node demo.js`.
