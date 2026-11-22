import { describe, expect, it } from 'vitest';
import { commentPayloadOf, type CommentPayload } from './commentPayloadOf';

const PAYLOAD: CommentPayload = {
  source: 'A comment on GitHub',
  root: { author: 'mira', body: 'Batch the ledger writes.\n\nOne insert per page.' },
  replies: [{ author: 'you', body: 'Agreed, keep the order.' }],
  path: 'src/ledger/batch.ts',
  line: 42,
  branch: 'hl/ledger-batch',
  prNumber: 79,
  prUrl: 'https://github.com/harborline/ledger-core/pull/79',
  note: '',
};

describe('commentPayloadOf', () => {
  it('carries the root, the replies, the lines to read, the branch and the PR, never a bare link', () => {
    const text = commentPayloadOf({ payload: PAYLOAD });

    expect(text).toContain('mira:\n> Batch the ledger writes.\n>\n> One insert per page.');
    expect(text).toContain('you:\n> Agreed, keep the order.');
    expect(text).toContain('src/ledger/batch.ts:42');
    expect(text).toContain('lines 32 to 52');
    expect(text).toContain(
      'Where: branch hl/ledger-batch, PR #79, https://github.com/harborline/ledger-core/pull/79.',
    );
    expect(text).not.toContain('A note from me');
  });

  it('adds the note and reads a comment on the whole change', () => {
    const text = commentPayloadOf({
      payload: {
        ...PAYLOAD,
        path: null,
        line: null,
        prNumber: null,
        prUrl: null,
        note: ' Do it first ',
      },
    });

    expect(text).toContain('It is about the whole change.');
    expect(text).toContain('Where: branch hl/ledger-batch.');
    expect(text).toContain('A note from me: Do it first');
  });
});
