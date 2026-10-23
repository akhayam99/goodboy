import { describe, expect, it } from 'vitest';
import type { PrCheckRun, PullRequestReviewer } from '@goodboy/types';
import { checksCountsOf } from '../../../integrations/github/checksRollup';
import {
  evaluatePrMergeReadiness,
  type MergeReadinessFacts,
} from '../../../review/prMergeReadiness';
import { pullRequestCellsOf } from './pullRequestCellsOf';

type RunParams = {
  readonly name: string;
  readonly conclusion: PrCheckRun['conclusion'];
};

const run = ({ name, conclusion }: RunParams): PrCheckRun => ({
  name,
  conclusion,
  detailsUrl: null,
  durationMs: null,
});

const PASSING = [
  run({ name: 'build', conclusion: 'success' }),
  run({ name: 'unit tests', conclusion: 'success' }),
];

const FACTS: MergeReadinessFacts = {
  pr: { baseBranch: 'main', mergeable: true },
  phase: 'open',
  checks: 'green',
  failingChecks: [],
  runningChecks: 0,
  review: 'review_required',
  changesRequestedBy: [],
  hasConflicts: false,
  writeInFlight: null,
  commentsNeedYou: 0,
  isFixRunLive: false,
};

const DANA: PullRequestReviewer = {
  person: { login: 'dana-r', name: null, avatarUrl: null },
  state: 'pending',
};

type CellsParams = {
  readonly facts?: Partial<MergeReadinessFacts>;
  readonly runs?: ReadonlyArray<PrCheckRun> | null;
  readonly people?: ReadonlyArray<PullRequestReviewer>;
  readonly behind?: number | null;
  readonly isRebasing?: boolean;
  readonly onlineAhead?: number;
};

const cellsOf = ({
  facts = {},
  runs = PASSING,
  people = [],
  behind = 0,
  isRebasing = false,
  onlineAhead = 0,
}: CellsParams) => {
  const merged = { ...FACTS, ...facts };
  return pullRequestCellsOf({
    state: 'open',
    pr: { baseBranch: 'main', reviewDecision: merged.review },
    runs,
    isChecksUnread: false,
    people,
    readiness: evaluatePrMergeReadiness({ facts: merged }),
    hasConflicts: merged.hasConflicts,
    mergeWord: 'Squash and merge',
    queueLine: null,
    branch: { ahead: 4, behind, onlineAhead, isRebasing },
  });
};

type WordsParams = {
  readonly cells: ReturnType<typeof cellsOf>;
};

const wordsOf = ({ cells }: WordsParams) =>
  cells.map((cell) => `${cell.label}: ${cell.word} (${cell.tone})`);

describe('pullRequestCellsOf', () => {
  it('keeps checks, review, merge and branch in that order', () => {
    expect(cellsOf({}).map((cell) => cell.id)).toEqual(['checks', 'review', 'merge', 'branch']);
  });

  it('says the open pull request nobody was asked to review', () => {
    expect(wordsOf({ cells: cellsOf({}) })).toEqual([
      'Checks: 2 passed (success)',
      'Review: No approval yet (warning)',
      'Merge: Blocked (neutral)',
      'Branch: Up to date (neutral)',
    ]);
  });

  it('names the failing check and blocks the merge by checks', () => {
    const runs = [...PASSING, run({ name: 'e2e member flows', conclusion: 'failure' })];
    const cells = cellsOf({
      runs,
      people: [DANA],
      facts: { checks: 'failing', failingChecks: ['e2e member flows'] },
    });

    expect(cells[0]).toMatchObject({
      word: '1 failing',
      detail: 'e2e member flows',
      tone: 'danger',
    });
    expect(cells[1]).toMatchObject({ word: 'Waiting', detail: 'on dana-r' });
    expect(cells[2]).toMatchObject({ word: 'Blocked', detail: 'by checks' });
  });

  it('draws conflicts amber, as the branch state map does', () => {
    const cells = cellsOf({ facts: { hasConflicts: true }, isRebasing: true, behind: 7 });

    expect(cells[2]).toMatchObject({ word: 'Conflicts', tone: 'warning' });
    expect(cells[3]).toMatchObject({ word: 'Rebasing', detail: '7 behind main' });
  });

  it('is ready with the merge method once approved and green', () => {
    const cells = cellsOf({ facts: { review: 'approved' } });

    expect(cells[1]).toMatchObject({ word: 'Approved', tone: 'success' });
    expect(cells[2]).toMatchObject({ word: 'Ready', detail: 'Squash and merge into main' });
  });

  it('says the branch diverged when someone pushed online', () => {
    expect(cellsOf({ onlineAhead: 2 })[3]).toMatchObject({
      word: 'Diverged',
      detail: '4 here, 2 online',
      tone: 'warning',
    });
  });

  it('counts the checks the way the rail does and opens Checks', () => {
    const runs = [
      ...PASSING,
      run({ name: 'lint', conclusion: 'pending' }),
      run({ name: 'docs', conclusion: 'skipped' }),
    ];
    const counts = checksCountsOf({ checks: runs });
    const checks = cellsOf({ runs, facts: { checks: 'pending', runningChecks: 1 } })[0];

    expect(checks?.word).toBe(`Running, ${counts.passed + counts.skipped} of ${runs.length}`);
    expect(checks?.opens).toBe('checks');
  });
});
