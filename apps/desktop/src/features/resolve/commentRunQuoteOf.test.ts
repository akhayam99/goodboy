import { describe, expect, it } from 'vitest';
import { commentRunQuoteOf } from './commentRunQuoteOf';

describe('commentRunQuoteOf', () => {
  it('quotes a note and a host comment word for word, each with its source and place', () => {
    expect(
      commentRunQuoteOf({
        comments: [
          {
            source: 'A local note',
            author: 'You',
            body: 'Move the header.\n\nKeep LedgerHeader.',
            path: 'src/routes/ledger/LedgerPage.tsx',
            line: 24,
          },
          {
            source: 'A GitHub comment',
            author: 'mira-s',
            body: 'Same for the filters bar.',
            path: 'src/routes/ledger/LedgerFilters.tsx',
            line: null,
          },
        ],
      }),
    ).toBe(
      [
        'The comments this run comes from, word for word:',
        'A local note from You on src/routes/ledger/LedgerPage.tsx:24:\n> Move the header.\n>\n> Keep LedgerHeader.',
        'A GitHub comment from mira-s on src/routes/ledger/LedgerFilters.tsx:\n> Same for the filters bar.',
      ].join('\n\n'),
    );
  });

  it('says the whole change for a comment with no file, and nothing for no comment', () => {
    expect(
      commentRunQuoteOf({
        comments: [
          { source: 'A GitLab comment', author: 'kai', body: 'Split it.', path: null, line: null },
        ],
      }),
    ).toContain('A GitLab comment from kai on the whole change:\n> Split it.');
    expect(commentRunQuoteOf({ comments: [] })).toBe('');
  });
});
