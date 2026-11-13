import { describe, expect, it } from 'vitest';
import type { PrCheckRun, PullRequestReviewer } from '@goodboy/types';
import { bitbucketReviewDecisionOf, gitlabReviewDecisionOf } from '@goodboy/core/review-source';
import type { PullRequestPresentationState } from '../../../../../shared/utils/pullRequestPresentation';
import { checksCountsOf, checksSummaryOf } from '../../../../integrations/github/checksRollup';
import {
  evaluatePrMergeReadiness,
  type MergeReadinessFacts,
} from '../../../../review/prMergeReadiness';
import {
  branchStepsOf,
  NO_COMMENT_FACTS,
  type BranchDueStep,
  type BranchStep,
} from '../../../branchStepOf';
import { pullRequestNextStepOf } from '../../../pullRequestNextStepOf';
import type { MergeBox } from './mergeBox';
import { mergeBoxOf, type MergeBoxThreads } from './mergeBoxOf';
import { verdictStepTextOf } from './verdictStepTextOf';

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
  readonly hasQuestion?: boolean;
  readonly isPushing?: boolean;
};

type Header = {
  readonly steps: ReadonlyArray<BranchDueStep>;
  readonly step: BranchStep;
};

type Built = {
  readonly box: MergeBox;
  readonly header: Header;
};

const build = ({
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
  hasQuestion = false,
  isPushing = false,
}: BoxParams): Built => {
  const merged = { ...FACTS, ...facts };
  const readiness = evaluatePrMergeReadiness({ facts: merged });
  const headerFacts = {
    state,
    lifecycle: pullRequestNextStepOf({
      state,
      facts: merged,
      readiness,
      hasReviewer: reviewers.length > 0,
      behind: behind ?? 0,
      isStopOpen: false,
    }),
    hasConflicts: merged.hasConflicts,
    comments: { ...NO_COMMENT_FACTS, questionThreadId: hasQuestion ? 'thread-omar' : null },
    checks: { isFailing: merged.checks === 'failing', isAwaitingRun: false, chain: 'none' },
    push: { isInFlight: isPushing, failed: 0, canPush: unpushed > 0, replies: 0 },
  } as const;
  const header = { steps: branchStepsOf(headerFacts), step: branchStepsOf(headerFacts)[0] ?? null };
  const box = mergeBoxOf({
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
    readiness,
    hasConflicts: merged.hasConflicts,
    mergeWord: 'Squash and merge',
    queueLine,
    branch: { ahead: 4, behind, onlineAhead, isRebasing },
    steps: header.steps,
    threads,
    unpushed,
    canRequestReview,
  });
  return { box, header };
};

const boxOf = ({ ...params }: BoxParams): MergeBox => build(params).box;

type LinesParams = {
  readonly box: MergeBox;
};

const linesOf = ({ box }: LinesParams): ReadonlyArray<string> =>
  box.rows.map((row) => `${row.title} (${row.tone})`);

describe('mergeBoxOf', () => {
  it('says the passed checks with the same line as the rail', () => {
    const box = boxOf({ runs: PASSING });

    expect(box.passing[0]).toBe(checksSummaryOf({ runs: PASSING })?.line);
  });

  it('waits for a review nobody was asked for, with what passes folded apart', () => {
    const box = boxOf({});

    expect(box.verdict).toMatchObject({
      kind: 'waiting',
      word: 'Waiting for a review',
      line: 'Nobody has been asked yet.',
    });
    expect(linesOf({ box })).toEqual(['No approval yet (info)']);
    expect(box.rows[0]).toMatchObject({ detail: 'Nobody asked yet', opens: 'reviewers' });
    expect(box.passing).toEqual(['2 of 2 passed', 'No conflicts', 'Up to date with main']);
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
      hasQuestion: true,
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
      line: 'Answer omar-t, then fix the failing check.',
    });
    expect(box.passing).toEqual(['No conflicts']);
  });

  it('names the next steps in the order the header takes them, not the order of the rows', () => {
    const { box, header } = build({
      runs: FAILING,
      reviewers: [reviewer({ login: 'omar-t', state: 'changes_requested' })],
      facts: {
        checks: 'failing',
        failingChecks: ['e2e member flows'],
        review: 'changes_requested',
        changesRequestedBy: ['omar-t'],
      },
      unpushed: 2,
      hasQuestion: true,
    });

    expect(header.step).toBe('answer');
    expect(box.rows[0]?.id).toBe('checks');
    expect(box.verdict.line).toBe('Answer omar-t, then push your commits.');
    expect(boxOf({ runs: FAILING, facts: { checks: 'failing' }, unpushed: 2 }).verdict.line).toBe(
      'Push your commits, then fix the failing check.',
    );
  });

  it('fixes the checks first when the branch only diverged online, as the header does', () => {
    const { box, header } = build({
      runs: FAILING,
      facts: { checks: 'failing', failingChecks: ['e2e member flows'] },
      onlineAhead: 2,
    });

    expect(header.step).toBe('fixChecks');
    expect(box.verdict.line).toBe('Fix the failing check.');
  });

  it('keeps a push in flight ahead of a question, as the header does', () => {
    const { box, header } = build({ unpushed: 2, isPushing: true, hasQuestion: true });

    expect(header.step).toBe('push');
    expect(box.verdict.line).toBe('Push your commits, then answer the comments.');
  });

  describe('agrees with the header for every mix of facts', () => {
    type BitParams = {
      readonly mask: number;
      readonly bit: number;
    };
    const isOn = ({ mask, bit }: BitParams): boolean => (mask & (1 << bit)) !== 0;
    const combos = Array.from({ length: 2 ** 8 }, (_, mask) => ({
      hasQuestion: isOn({ mask, bit: 0 }),
      isFailing: isOn({ mask, bit: 1 }),
      isDiverged: isOn({ mask, bit: 2 }),
      hasUnpushed: isOn({ mask, bit: 3 }),
      isPushing: isOn({ mask, bit: 4 }),
      hasConflicts: isOn({ mask, bit: 5 }),
      isDraft: isOn({ mask, bit: 6 }),
      isBehind: isOn({ mask, bit: 7 }),
    }));

    it.each(combos)('%o', (combo) => {
      const { box, header } = build({
        state: combo.isDraft ? 'draft' : 'open',
        runs: combo.isFailing ? FAILING : PASSING,
        facts: {
          checks: combo.isFailing ? 'failing' : 'green',
          failingChecks: combo.isFailing ? ['e2e member flows'] : [],
          hasConflicts: combo.hasConflicts,
          pr: { baseBranch: 'main', mergeable: !combo.hasConflicts },
          unpushed: combo.hasUnpushed ? 2 : 0,
        },
        onlineAhead: combo.isDiverged ? 2 : 0,
        unpushed: combo.hasUnpushed ? 2 : 0,
        isPushing: combo.isPushing,
        hasQuestion: combo.hasQuestion,
        behind: combo.isBehind ? 3 : 0,
      });
      const named = header.steps.slice(0, 2).map((step) =>
        verdictStepTextOf({
          step,
          facts: {
            base: 'main',
            changesBy: null,
            failing: 1,
            hasConflicts: combo.hasConflicts,
            isRebasing: false,
            mergeWord: 'Squash and merge',
          },
        }),
      );
      const sentence = named.join(', then ');
      const expected = `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;

      const isNaming =
        (box.verdict.kind === 'blocked' && header.step !== null) ||
        (box.verdict.kind === 'draft' && header.step !== null && header.step !== 'markReady');

      expect(header.steps[0] ?? null).toBe(header.step);
      expect(isNaming ? box.verdict.line : expected).toBe(expected);
    });
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
    expect(box.verdict.line).toBe('Resolve the conflicts with main.');
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
      '2 of 2 passed',
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
      hasQuestion: true,
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
      line: 'Ask for a review.',
    });
    expect(box.rows.map((row) => row.id)).toEqual(['checks', 'review']);
  });

  it('says what readiness names when the header has no step', () => {
    const box = boxOf({
      runs: null,
      isChecksUnread: true,
      facts: { checks: 'unknown' },
      reviewers: [reviewer({ login: 'dana-r', state: 'pending' })],
    });

    expect(box.verdict).toMatchObject({ kind: 'blocked', line: 'Checks unknown.' });
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
