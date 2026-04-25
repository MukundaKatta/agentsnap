import { test } from 'node:test';
import assert from 'node:assert/strict';

import { formatDiff } from '../src/format.js';

test('formatDiff prints status and snapshot path', () => {
  const out = formatDiff(
    {
      status: 'TOOLS_CHANGED',
      changes: [
        { path: 'tools[0].args', from: { q: 'x' }, to: { q: 'y' } },
      ],
    },
    '/tmp/foo.snap.json'
  );
  assert.match(out, /TOOLS_CHANGED/);
  assert.match(out, /\/tmp\/foo\.snap\.json/);
  assert.match(out, /tools\[0\]\.args/);
  assert.match(out, /AGENTSNAP_UPDATE=1/);
});

test('formatDiff handles passed result without crashing', () => {
  const out = formatDiff({ status: 'PASSED', changes: [] });
  assert.match(out, /PASSED/);
  assert.doesNotMatch(out, /AGENTSNAP_UPDATE=1/);
});

test('formatDiff displays string and array values readably', () => {
  const out = formatDiff({
    status: 'TOOLS_REORDERED',
    changes: [{ path: 'tools[].order', from: ['a', 'b'], to: ['b', 'a'] }],
  });
  assert.match(out, /\["a", "b"\]/);
  assert.match(out, /\["b", "a"\]/);
});
