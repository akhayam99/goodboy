import { describe, expect, it } from 'vitest';
import { runGoalOf } from './runGoalOf';

const HEADER = {
  body: 'This header should live in the layout, not in the page. Follow the payouts route as the model: AppLayout owns the header, the page only passes the title and actions.',
  path: 'src/routes/ledger/LedgerPage.tsx',
  line: 24,
};

const FILTERS = {
  body: 'Same for the filters bar: it belongs to the layout slot.\n\nKeep the query params.',
  path: 'src/routes/ledger/LedgerFilters.tsx',
  line: 9,
};

describe('runGoalOf', () => {
  it('writes one comment as an imperative goal with its place and the route it names as a model', () => {
    expect(runGoalOf({ comments: [HEADER] })).toBe(
      'Change LedgerPage.tsx:24 as the comment asks, the way the payouts route does it. This header should live in the layout, not in the page. Follow the payouts route as the model: AppLayout owns the header, the page only passes the title and actions.',
    );
  });

  it('names every place and the first sentence of each comment when several start the run', () => {
    expect(runGoalOf({ comments: [HEADER, FILTERS] })).toBe(
      'Change LedgerPage.tsx:24 and LedgerFilters.tsx:9 as the comments ask, the way the payouts route does it. This header should live in the layout, not in the page. Same for the filters bar: it belongs to the layout slot.',
    );
  });

  it('counts the places once there are more than three', () => {
    const many = ['a.ts', 'b.ts', 'c.ts', 'd.ts'].map((name, index) => ({
      body: `Rename the export in ${name}.`,
      path: `src/ledger/${name}`,
      line: index + 1,
    }));
    expect(runGoalOf({ comments: many })).toMatch(/^Change 4 places as the comments ask\. /);
  });

  it('names one place once when two comments sit on the same line', () => {
    expect(runGoalOf({ comments: [HEADER, { ...FILTERS, path: HEADER.path, line: 24 }] })).toMatch(
      /^Change LedgerPage\.tsx:24 as the comments ask/,
    );
  });

  it('asks for what the comment asks when it has no file', () => {
    expect(
      runGoalOf({
        comments: [{ body: 'Split this pull request in two.', path: null, line: null }],
      }),
    ).toBe('Do what the comment asks. Split this pull request in two.');
  });

  it('strips markdown and adds no model when none is named', () => {
    expect(
      runGoalOf({
        comments: [
          {
            body: '**Please** rewrite `parseRows` with the new reader.\n\n- keep the totals',
            path: 'src/import/parseRows.ts',
            line: null,
          },
        ],
      }),
    ).toBe(
      'Change parseRows.ts as the comment asks. Please rewrite parseRows with the new reader. keep the totals',
    );
  });

  it('picks up a model named as the way it does it', () => {
    expect(
      runGoalOf({
        comments: [
          {
            body: 'Wire the retries the way the notify-relay worker does it.',
            path: 'src/retry.ts',
            line: 3,
          },
        ],
      }),
    ).toMatch(/^Change retry\.ts:3 as the comment asks, the way the notify-relay worker does it\./);
  });

  it('ends the goal with what the fix agent found when it said the comment needs a run', () => {
    expect(
      runGoalOf({
        comments: [
          { ...HEADER, finding: 'It touches the layout, the payouts route and two new components' },
        ],
      }),
    ).toMatch(
      / Follow the payouts route as the model: AppLayout owns the header, the page only passes the title and actions\. The fix agent found: It touches the layout, the payouts route and two new components\.$/,
    );
  });

  it('quotes one finding per comment, and none for a comment the agent never stopped on', () => {
    const goal = runGoalOf({
      comments: [
        { ...HEADER, finding: 'The header moves into AppLayout.' },
        { ...FILTERS, finding: null },
        {
          body: 'Add a payouts tab.',
          path: null,
          line: null,
          finding: '  It needs a new route.  ',
        },
      ],
    });
    expect(
      goal.endsWith(' The fix agent found: The header moves into AppLayout. It needs a new route.'),
    ).toBe(true);
    expect(goal.match(/The fix agent found:/g)).toHaveLength(1);
  });

  it('clips a very long comment at a word', () => {
    const goal = runGoalOf({
      comments: [{ body: 'word '.repeat(400), path: 'src/a.ts', line: 1 }],
    });
    expect(goal.length).toBeLessThan(700);
    expect(goal.endsWith('word…')).toBe(true);
  });
});
