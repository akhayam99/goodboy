import { describe, expect, it } from 'vitest';
import { proposalOf } from './proposalOf';
import { proposalBlocksOf } from './proposalBlocksOf';

describe('proposal sections', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['No fix found', null],
    ['## Proposed fix\n   ', null],
    ['Cause\n## Proposed fix\nChange src/ledger.ts\n## Other\nDone', 'Change src/ledger.ts'],
    ['```md\n## Proposed fix\nnot a proposal\n```', null],
    ['~~~md\n## Proposed fix\nnot a proposal\n~~~\n## Proposed fix\nReal fix', 'Real fix'],
    ['## Proposed fix\nFirst\n## Proposed fix\nSecond', 'First'],
    ['x'.repeat(100_000) + '\n## Proposed fix\nCheck ledger-core', 'Check ledger-core'],
    ['## Proposed fix\n```diff\n+new\n-old\n```', '```diff\n+new\n-old\n```'],
  ])('extracts the real section: %s', (text, expected) => {
    expect(proposalOf({ text: text ?? '' })).toBe(expected);
  });
  it('splits a mini diff without repeating surrounding markdown', () => {
    expect(proposalBlocksOf({ text: 'Before\n```diff\n+new\n-old\n```\nAfter' })).toEqual([
      { kind: 'markdown', text: 'Before' },
      { kind: 'diff', text: '+new\n-old' },
      { kind: 'markdown', text: 'After' },
    ]);
  });
});
