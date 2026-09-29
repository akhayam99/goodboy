import { describe, expect, it } from 'vitest';
import type { BranchCommit, HistoryPlanPrediction } from '@goodboy/types';
import {
  hasReviewRewrite,
  predictedConflicts,
  presetChoices,
  presetOf,
  replacedOnOrigin,
  reviewAfterCommits,
  reviewCommitRows,
  reviewPlanItems,
  type ReviewThreadCommits,
} from './reviewCommits';

const sha = (seed: string): string => seed.padEnd(40, '0');

const commit = ({
  seed,
  subject,
  pushed,
}: {
  readonly seed: string;
  readonly subject: string;
  readonly pushed: boolean;
}): BranchCommit => ({
  sha: sha(seed),
  shortSha: seed,
  subject,
  author: 'Ada',
  timestamp: 0,
  pushed,
  parentSha: null,
});

const COMMITS: ReadonlyArray<BranchCommit> = [
  commit({ seed: 'd4e7b20', subject: 'Emit one metric per attempt', pushed: false }),
  commit({ seed: '9f2c1ab', subject: 'fixup! Add the retry policy', pushed: true }),
  commit({ seed: 'c81e5aa', subject: 'Stop retrying forever on a 429', pushed: true }),
  commit({ seed: '7be41d0', subject: 'Add the retry policy', pushed: true }),
  commit({ seed: '3f9a2c1', subject: 'Dedupe webhook credits on the event id', pushed: true }),
];

const THREADS: ReadonlyArray<ReviewThreadCommits> = [
  {
    threadId: 'mara',
    author: 'Mara Quint',
    location: 'retryPolicy.ts:42',
    commitShas: [sha('c81e5aa')],
    fixupOfSha: sha('7be41d0'),
  },
  {
    threadId: 'theo',
    author: 'Theo Varga',
    location: 'config.ts:3',
    commitShas: [sha('9f2c1ab')],
    fixupOfSha: null,
  },
  {
    threadId: 'ines',
    author: 'Ines Okafor',
    location: 'metrics.ts:18',
    commitShas: [sha('d4e7b20')],
    fixupOfSha: sha('3f9a2c1'),
  },
];

const ROWS = reviewCommitRows({ commits: COMMITS, threads: THREADS });

describe('reviewCommitRows', () => {
  it('lists oldest first and links resolve commits to their comment', () => {
    expect(ROWS.map((row) => row.shortSha)).toEqual([
      '3f9a2c1',
      '7be41d0',
      'c81e5aa',
      '9f2c1ab',
      'd4e7b20',
    ]);
    expect(ROWS.filter((row) => row.isResolve).map((row) => row.threads[0]?.threadId)).toEqual([
      'mara',
      'theo',
      'ines',
    ]);
  });

  it('takes the fixup target from fixup_of_sha, or from a fixup! subject', () => {
    expect(ROWS[2]?.fixupOf).toBe(sha('7be41d0'));
    expect(ROWS[3]?.fixupOf).toBe(sha('7be41d0'));
    expect(ROWS[4]?.fixupOf).toBe(sha('3f9a2c1'));
  });
});

describe('presets', () => {
  it('keeps everything as it is', () => {
    const items = reviewPlanItems({
      rows: ROWS,
      choices: presetChoices({ rows: ROWS, preset: 'keep', prNumber: 318 }),
    });
    expect(items.every((step) => step.verb === 'pick')).toBe(true);
    expect(hasReviewRewrite({ rows: ROWS, items })).toBe(false);
  });

  it('folds each resolve commit into its fixup_of_sha target', () => {
    const items = reviewPlanItems({
      rows: ROWS,
      choices: presetChoices({ rows: ROWS, preset: 'fold', prNumber: 318 }),
    });
    expect(items.filter((step) => step.verb === 'fixup')).toEqual([
      { sha: sha('c81e5aa'), verb: 'fixup', target: sha('7be41d0') },
      { sha: sha('9f2c1ab'), verb: 'fixup', target: sha('7be41d0') },
      { sha: sha('d4e7b20'), verb: 'fixup', target: sha('3f9a2c1') },
    ]);
    expect(replacedOnOrigin({ rows: ROWS, items })).toBe(4);
  });

  it('squashes the review into one reworded commit', () => {
    const items = reviewPlanItems({
      rows: ROWS,
      choices: presetChoices({ rows: ROWS, preset: 'one', prNumber: 318 }),
    });
    expect(items[2]).toEqual({
      sha: sha('c81e5aa'),
      verb: 'reword',
      message: 'Address review on #318',
    });
    expect(items.slice(3).map((step) => step.target)).toEqual([sha('c81e5aa'), sha('c81e5aa')]);
    expect(replacedOnOrigin({ rows: ROWS, items })).toBe(2);
  });

  it('names the preset a set of choices matches, or none when custom', () => {
    const fold = presetChoices({ rows: ROWS, preset: 'fold', prNumber: 318 });
    expect(presetOf({ rows: ROWS, choices: fold, prNumber: 318 })).toBe('fold');
    expect(
      presetOf({
        rows: ROWS,
        choices: { [sha('d4e7b20')]: { kind: 'fold', target: sha('3f9a2c1') } },
        prNumber: 318,
      }),
    ).toBeNull();
  });
});

describe('reviewAfterCommits', () => {
  it('previews the resulting commits with the predicted shas', () => {
    const items = reviewPlanItems({
      rows: ROWS,
      choices: presetChoices({ rows: ROWS, preset: 'fold', prNumber: 318 }),
    });
    const prediction: HistoryPlanPrediction = {
      isSupported: true,
      head: sha('e31b9f4'),
      isTreeEqual: true,
      changedFiles: [],
      steps: [
        { sha: sha('3f9a2c1'), outcome: 'clean', files: [], newSha: sha('1111111') },
        { sha: sha('d4e7b20'), outcome: 'clean', files: [], newSha: sha('a52d7c8') },
        { sha: sha('7be41d0'), outcome: 'clean', files: [], newSha: sha('2222222') },
        { sha: sha('c81e5aa'), outcome: 'clean', files: [], newSha: sha('3333333') },
        { sha: sha('9f2c1ab'), outcome: 'conflict', files: ['config.ts'], newSha: sha('e31b9f4') },
      ],
    };
    const after = reviewAfterCommits({ rows: ROWS, items, prediction });
    expect(after.map((entry) => [entry.subject, entry.newSha, entry.members])).toEqual([
      ['Dedupe webhook credits on the event id', sha('a52d7c8'), ['3f9a2c1', 'd4e7b20']],
      ['Add the retry policy', sha('e31b9f4'), ['7be41d0', 'c81e5aa', '9f2c1ab']],
    ]);
    expect(predictedConflicts({ prediction })).toEqual(['config.ts']);
  });
});
