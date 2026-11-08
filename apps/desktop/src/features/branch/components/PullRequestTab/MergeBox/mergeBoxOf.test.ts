import { describe, expect, it } from 'vitest';
import type { PrCheckRun, PullRequestReviewer } from '@goodboy/types';
import { bitbucketReviewDecisionOf, gitlabReviewDecisionOf } from '@goodboy/core/review-source';
import type { PullRequestPresentationState } from '../../../../../shared/utils/pullRequestPresentation';
import { checksCountsOf } from '../../../../integrations/github/checksRollup';
import {
  evaluatePrMergeReadiness,
  type MergeReadinessFacts,
} from '../../../../review/prMergeReadiness';
import type { MergeBox } from './mergeBox';
import { mergeBoxOf, type MergeBoxThreads } from './mergeBoxOf';

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

const FAILING = [...PASSING, run({ name: 'e2e member flows', conclusion: 'failure' })];

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

type ReviewerParams = {
  readonly login: string;
  readonly state: PullRequestReviewer['state'];
};

const reviewer = ({ login, state }: ReviewerParams): PullRequestReviewer => ({
  person: { login, name: null, avatarUrl: null },
  state,
});

const NO_THREADS: MergeBoxThreads = { unresolved: 0, needYou: 0, unread: 0 };

type BoxParams = {
  readonly state?: PullRequestPresentationState;
  readonly facts?: Partial<MergeReadinessFacts>;
  readonly runs?: ReadonlyArray<PrCheckRun> | null;
  readonly isChecksUnread?: boolean;
  readonly reviewers?: ReadonlyArray<PullRequestReviewer>;
  readonly behind?: number | null;
  readonly isRebasing?: boolean;
  readonly onlineAhead?: number;
  readonly threads?: MergeBoxThreads;
  readonly unpushed?: number;
  readonly canRequestReview?: boolean;
  readonly queueLine?: string | null;
};

const boxOf = ({
  state = 'open',
  facts = {},
  runs = PASSING,
  isChecksUnread = false,
  reviewers = [],
  behind = 0,
  isRebasing = false,
  onlineAhead = 0,
  threads = NO_THREADS,
  unpushed = 0,
  canRequestReview = true,
  queueLine = null,
}: BoxParams): MergeBox => {
  const merged = { ...FACTS, ...facts };
  return mergeBoxOf({
    state,
    pr: {
      baseBranch: 'main',
      reviewDecision: merged.review,
      mergeable: merged.pr?.mergeable ?? null,
    },
    runs,
    isChecksUnread,
    checks: {
      checks: merged.checks,
      failingChecks: merged.failingChecks,
      runningChecks: merged.runningChecks,
    },
    reviewers,
    readiness: evaluatePrMergeReadiness({ facts: merged }),
    hasConflicts: merged.hasConflicts,
    mergeWord: 'Squash and merge',
    queueLine,
    branch: { ahead: 4, behind, onlineAhead, isRebasing },
    threads,
    unpushed,
    canRequestReview,
  });
};

type LinesParams = {
  readonly box: MergeBox;
};

const linesOf = ({ box }: LinesParams): ReadonlyArray<string> =>
  box.rows.map((row) => `${row.title} (${row.tone})`);

describe('mergeBoxOf', () => {
  it('waits for a review nobody was asked for, with what passes folded apart', () => {
    const box = boxOf({});

    expect(box.verdict).toMatchObject({
      kind: 'waiting',
      word: 'Waiting for a review',
      line: 'Nobody has been asked yet.',
    });
    expect(linesOf({ box })).toEqual(['No approval yet (info)']);
    expect(box.rows[0]).toMatchObject({ detail: 'Nobody asked yet', opens: 'reviewers' });
    expect(box.passing).toEqual(['2 checks passed', 'No conflicts', 'Up to date with main']);
  });

  it('opens Comments instead of the picker when the host cannot ask for a review', () => {
    expect(boxOf({ canRequestReview: false }).rows[0]?.opens).toBe('comments');
  });

  it('puts what blocks the merge first, the worst first, and says the next two steps', () => {
    const box = boxOf({
      runs: FAILING,
      reviewers: [reviewer({ login: 'omar-t', state: 'changes_requested' })],
      facts: {
        checks: 'failing',
        failingChecks: ['e2e member flows'],
        review: 'changes_requested',
        changesRequestedBy: ['omar-t'],
      },
      threads: { unresolved: 2, needYou: 1, unread: 0 },
      behind: 3,
    });

    expect(linesOf({ box })).toEqual([
      '1 check failing (danger)',
      'Changes requested by omar-t (warning)',
      '3 commits behind main (neutral)',
    ]);
    expect(box.rows.map((row) => row.opens)).toEqual(['checks', 'comments', 'commits']);
    expect(box.rows[0]?.detail).toBe('e2e member flows');
    expect(box.rows[1]?.detail).toBe('2 open threads · 1 needs you');
    expect(box.verdict).toMatchObject({
      kind: 'blocked',
      word: 'Not ready to merge',
      tone: 'danger',
      line: 'Fix the failing check, then answer omar-t.',
    });
    expect(box.passing).toEqual(['No conflicts']);
  });

  it('draws conflicts amber, as the branch state map does, and drops the behind row', () => {
    const box = boxOf({
      facts: { hasConflicts: true, review: 'approved' },
      behind: 7,
      isRebasing: true,
    });

    expect(linesOf({ box })).toEqual([
      'Conflicts with main (warning)',
      'Rebasing onto main (warning)',
    ]);
    expect(box.rows[0]).toMatchObject({ opens: 'files', detail: 'main moved 7 commits ahead' });
    expect(box.verdict.line).toBe('Resolve the conflicts with main, then finish the rebase.');
  });

  it('is ready with the merge method once approved and green, and repeats no button', () => {
    const box = boxOf({
      facts: { review: 'approved' },
      reviewers: [reviewer({ login: 'kenji-w', state: 'approved' })],
    });

    expect(box.rows).toEqual([]);
    expect(box.verdict).toEqual({
      kind: 'ready',
      word: 'Ready to merge',
      line: 'Squash and merge into main. Nothing is waiting.',
      tone: 'success',
    });
    expect(box.passing).toEqual([
      '2 checks passed',
      'No conflicts',
      'Approved by kenji-w',
      'Up to date with main',
    ]);
  });

  it('says the branch diverged when someone pushed online', () => {
    const box = boxOf({ onlineAhead: 2, facts: { review: 'approved' } });

    expect(box.rows[0]).toMatchObject({
      title: 'Diverged from the online branch',
      detail: '4 here, 2 online',
      tone: 'warning',
      opens: 'commits',
    });
  });

  it('counts the checks the way the rail does while they run', () => {
    const runs = [
      ...PASSING,
      run({ name: 'lint', conclusion: 'pending' }),
      run({ name: 'docs', conclusion: 'skipped' }),
    ];
    const counts = checksCountsOf({ checks: runs });
    const box = boxOf({ runs, facts: { checks: 'pending', runningChecks: 1, review: 'approved' } });

    expect(box.rows[0]).toMatchObject({
      title: 'Checks running',
      detail: `${counts.passed + counts.skipped} of ${runs.length} done`,
      opens: 'checks',
    });
    expect(box.verdict).toMatchObject({ kind: 'waiting', word: 'Waiting for checks' });
  });

  it('turns open threads that need you into a warning row that opens Comments', () => {
    const box = boxOf({
      facts: { review: 'approved', commentsNeedYou: 2 },
      threads: { unresolved: 5, needYou: 2, unread: 1 },
    });

    expect(box.rows[0]).toMatchObject({
      title: '2 threads need you',
      detail: '5 open threads · 1 unread',
      tone: 'warning',
      opens: 'comments',
    });
    expect(box.verdict.line).toBe('Answer the comments.');
  });

  it('says commits not pushed before anything else that warns', () => {
    const box = boxOf({ unpushed: 3, facts: { review: 'approved', unpushed: 3 } });

    expect(linesOf({ box })).toEqual(['3 commits not pushed (warning)']);
    expect(box.verdict.line).toBe('Push your commits.');
  });

  it('keeps unknown checks out of the passing line', () => {
    const box = boxOf({ runs: null, isChecksUnread: true, facts: { checks: 'unknown' } });

    expect(box.rows.find((row) => row.id === 'checks')).toMatchObject({
      title: 'Checks unknown',
      tone: 'warning',
    });
    expect(box.passing).not.toContain('No checks');
  });

  it('ranks unknown checks above a pending review, as readiness does', () => {
    const box = boxOf({ runs: null, isChecksUnread: true, facts: { checks: 'unknown' } });

    expect(box.verdict).toMatchObject({
      kind: 'blocked',
      word: 'Not ready to merge',
      line: 'Checks unknown.',
    });
    expect(box.rows.map((row) => row.id)).toEqual(['checks', 'review']);
  });

  it('keeps the checks it already knows failing while the runs load', () => {
    const box = boxOf({
      runs: null,
      facts: { checks: 'failing', failingChecks: ['e2e member flows'], review: 'approved' },
    });

    expect(box.rows[0]).toMatchObject({
      title: '1 check failing',
      detail: 'e2e member flows',
      tone: 'danger',
    });
    expect(box.verdict).toMatchObject({ kind: 'blocked', line: 'Fix the failing check.' });
  });

  it('keeps running checks visible while the runs load', () => {
    const box = boxOf({
      runs: null,
      facts: { checks: 'pending', runningChecks: 2, review: 'approved' },
    });

    expect(box.rows[0]).toMatchObject({ title: 'Checks running', detail: null });
    expect(box.verdict).toMatchObject({ kind: 'waiting', word: 'Waiting for checks' });
  });

  it('never waits when readiness holds the merge for another reason', () => {
    const box = boxOf({ facts: { writeInFlight: 'Merging' } });

    expect(box.verdict).toMatchObject({ kind: 'blocked', line: 'Merging.' });
  });

  describe('an optional reviewer', () => {
    const asked = [reviewer({ login: 'dana-r', state: 'pending' })];

    it('does not hold a ready GitHub pull request', () => {
      const box = boxOf({ reviewers: asked, facts: { review: null } });

      expect(box.verdict).toMatchObject({ kind: 'ready', word: 'Ready to merge' });
      expect(box.rows[0]).toMatchObject({
        title: 'Waiting on dana-r',
        detail: 'Not required to merge',
        tone: 'neutral',
      });
    });

    it('does not hold a GitLab request that needs no approval', () => {
      const review = gitlabReviewDecisionOf({ approvals: { approvalsLeft: 0, approvedBy: [] } });
      const box = boxOf({ reviewers: asked, facts: { review, host: 'gitlab' } });

      expect(review).toBeNull();
      expect(box.verdict).toMatchObject({ kind: 'ready' });
    });

    it('holds a GitLab request that still needs approvals', () => {
      const review = gitlabReviewDecisionOf({ approvals: { approvalsLeft: 1, approvedBy: [] } });
      const box = boxOf({ reviewers: asked, facts: { review, host: 'gitlab' } });

      expect(box.verdict).toMatchObject({ kind: 'waiting', word: 'Waiting for a review' });
      expect(box.rows[0]).toMatchObject({ title: 'Waiting on dana-r', tone: 'info' });
    });

    it('does not hold a Bitbucket request once one reviewer approved', () => {
      const review = bitbucketReviewDecisionOf({
        participants: [
          { user: null, role: 'REVIEWER', approved: true, state: 'approved' },
          { user: null, role: 'REVIEWER', approved: false, state: null },
        ],
      });
      const box = boxOf({
        reviewers: [...asked, reviewer({ login: 'kenji-w', state: 'approved' })],
        facts: { review, host: 'bitbucket' },
      });

      expect(review).toBe('approved');
      expect(box.verdict).toMatchObject({ kind: 'ready' });
    });

    it('holds a Bitbucket request nobody approved', () => {
      const review = bitbucketReviewDecisionOf({
        participants: [{ user: null, role: 'REVIEWER', approved: false, state: null }],
      });
      const box = boxOf({ reviewers: asked, facts: { review, host: 'bitbucket' } });

      expect(review).toBe('review_required');
      expect(box.verdict).toMatchObject({ kind: 'waiting', word: 'Waiting for a review' });
    });
  });

  it('says a merged or closed request in one line, with nothing to fix', () => {
    const merged = boxOf({ state: 'merged', runs: FAILING });
    expect(merged).toEqual({
      verdict: { kind: 'merged', word: 'Merged into main', line: null, tone: 'merged' },
      rows: [],
      passing: [],
    });
    expect(boxOf({ state: 'closed' }).verdict.word).toBe('Closed without merging');
  });

  it('keeps the queue line on a queued request and skips the review on a draft', () => {
    const queued = boxOf({ state: 'queued', queueLine: 'Queued to merge, 3rd in line' });
    expect(queued.verdict).toMatchObject({
      kind: 'queued',
      line: 'Queued to merge, 3rd in line',
    });

    const draft = boxOf({ state: 'draft' });
    expect(draft.verdict).toMatchObject({ kind: 'draft', word: 'Draft' });
    expect(draft.rows.map((row) => row.id)).not.toContain('review');
  });
});
