// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PullRequestChecks } from '@goodboy/types';
import { branchFactsOf, type BranchFacts, type BranchStatusFacts } from './branchFactsOf';
import {
  branchEntriesOf,
  branchFoldOf,
  branchSentenceOf,
  type BranchDetailWords,
} from './branchStoryOf';
import type { MountRequestView } from '../../../../store/slices/project-mounts/mountRowModel';
import { aMountRow, aRequest } from './testing/aMountRow';

const BRANCH_ROW_CAP = 8;

const NOW = Date.UTC(2026, 9, 18, 10, 30, 0);
const MINUTE_MS = 60_000;
const FRESH = new Date(NOW - MINUTE_MS).toISOString();
const STALE = new Date(NOW - 12 * MINUTE_MS).toISOString();

type RequestSpec = {
  readonly state?: 'open' | 'queued' | 'merged' | 'closed';
  readonly isDraft?: boolean;
  readonly checks?: PullRequestChecks;
  readonly reviewDecision?: 'approved' | 'changes_requested' | 'review_required' | null;
  readonly isMergeable?: boolean | null;
  readonly isChecksAbsent?: boolean;
  readonly isReviewOptional?: boolean;
  readonly provider?: MountRequestView['provider'];
};

type FactSpec = {
  readonly key?: string;
  readonly request?: RequestSpec;
  readonly status?: BranchStatusFacts;
  readonly behind?: number | null;
  readonly liveCount?: number;
  readonly isStale?: boolean;
  readonly isFinished?: boolean;
};

const factOf = ({
  key = 'api',
  request,
  status,
  behind = null,
  liveCount = 0,
  isStale = false,
  isFinished = false,
}: FactSpec): BranchFacts => {
  const row = {
    ...aMountRow({
      key,
      projectName: 'payments-api',
      branch: `ak/eng-1190-${key}`,
      request:
        request === undefined
          ? null
          : aRequest({
              provider: request.provider ?? 'github',
              number: 309,
              state: request.state,
              isDraft: request.isDraft,
              checks: request.checks,
              reviewDecision: request.reviewDecision,
              isMergeable: request.isMergeable,
              isChecksAbsent: request.isChecksAbsent,
              isReviewOptional: request.isReviewOptional,
            }),
    }),
    isFinished,
  };
  const [fact] = branchFactsOf({
    rows: [row],
    fetchedAtByMountId: new Map([[row.mountId, isStale ? STALE : FRESH]]),
    behindByMountId: new Map([[row.mountId, behind]]),
    liveCountByMountId: new Map([[row.mountId, liveCount]]),
    liveTitleByMountId: new Map([[row.mountId, 'Implementer']]),
    statusByMountId: status === undefined ? new Map() : new Map([[row.mountId, status]]),
    now: NOW,
  });
  if (fact === undefined) {
    throw new Error('One row gives one fact.');
  }
  return fact;
};

type StatusParams = Partial<BranchStatusFacts>;

const status = ({
  ahead = 3,
  push = { kind: 'in-sync' },
  changedFiles = 0,
  isRebasing = false,
}: StatusParams): BranchStatusFacts => ({ ahead, push, changedFiles, isRebasing });

type StoryParams = {
  readonly fact: BranchFacts;
  readonly hasCard?: boolean;
  readonly detail?: BranchDetailWords | null;
};

const storyOf = ({ fact, hasCard = false, detail = null }: StoryParams) => {
  const [entry] = branchEntriesOf({
    facts: [fact],
    cardOrderByMountId: hasCard ? new Map([[fact.mountId, 0]]) : new Map(),
    detailByMountId: detail === null ? new Map() : new Map([[fact.mountId, detail]]),
  });
  if (entry === undefined) {
    throw new Error('One fact gives one entry.');
  }
  return entry.story;
};

const statesOf = ({ fact }: StoryParams): string =>
  storyOf({ fact })
    .steps.map((step) => step.state[0])
    .join('');

describe('branchStoryOf, no pull request', () => {
  it('says Nothing committed with a ring on Commits', () => {
    const fact = factOf({
      status: status({ ahead: 0, push: { kind: 'not-pushed', commits: 0 }, changedFiles: 4 }),
    });
    const story = storyOf({ fact });
    expect(story.word).toBe('Nothing committed');
    expect(story.blocker).toBe('4 files changed');
    expect(statesOf({ fact })).toBe('drttttt');
  });

  it('says Not pushed with the commits that are only local', () => {
    const fact = factOf({ status: status({ push: { kind: 'not-pushed', commits: 3 } }) });
    const story = storyOf({ fact });
    expect(story.word).toBe('Not pushed');
    expect(story.blocker).toBe('3 commits only on this Mac');
    expect(story.rank).toBe(4);
  });

  it('says No PR yet once pushed', () => {
    const story = storyOf({ fact: factOf({ status: status({ ahead: 2 }) }) });
    expect(story.word).toBe('No PR yet');
    expect(story.blocker).toBe('2 commits pushed');
    expect(story.tone).toBe('warning');
  });

  it('says what is unknown when the status is not read yet', () => {
    const story = storyOf({ fact: factOf({}) });
    expect(story.word).toBe('Branch');
    expect(story.blocker).toBe('');
  });
});

describe('branchStoryOf, pull request', () => {
  it('fails on checks first and names them when the detail is read', () => {
    const fact = factOf({ request: { checks: 'failure' }, status: status({}) });
    expect(storyOf({ fact }).blocker).toBe('Checks failed on the last push');
    const named = storyOf({
      fact,
      detail: { failingChecks: ['static-analysis'], openThreads: 0 },
    });
    expect(named.word).toBe('Checks failing');
    expect(named.blocker).toBe('static-analysis failed on the last push');
    expect(named.rank).toBe(0);
    expect(named.tone).toBe('danger');
  });

  it('counts open conversations when changes are requested', () => {
    const fact = factOf({
      request: { checks: 'success', reviewDecision: 'changes_requested' },
      status: status({}),
    });
    expect(storyOf({ fact }).blocker).toBe('A reviewer asked for changes');
    const named = storyOf({ fact, detail: { failingChecks: [], openThreads: 2 } });
    expect(named.word).toBe('Changes requested');
    expect(named.blocker).toBe('2 open conversations to resolve');
  });

  it('says Draft, then Checks running, then Review required', () => {
    expect(
      storyOf({
        fact: factOf({ request: { isDraft: true, checks: 'success' }, status: status({}) }),
      }).word,
    ).toBe('Draft');
    expect(
      storyOf({ fact: factOf({ request: { checks: 'pending' }, status: status({}) }) }).word,
    ).toBe('Checks running');
    const review = storyOf({
      fact: factOf({
        request: { checks: 'success', reviewDecision: 'review_required' },
        status: status({}),
      }),
    });
    expect(review.word).toBe('Review required');
    expect(review.tone).toBe('warning');
  });

  it('says Ready to merge when approved and green', () => {
    const story = storyOf({
      fact: factOf({
        request: { checks: 'success', reviewDecision: 'approved' },
        status: status({}),
      }),
    });
    expect(story.word).toBe('Ready to merge');
    expect(story.rank).toBe(1);
    expect(story.steps.at(-1)?.state).toBe('current');
  });

  it('says why an approved branch cannot merge', () => {
    const story = storyOf({
      fact: factOf({
        request: { checks: 'success', reviewDecision: 'approved', isMergeable: false },
        status: status({}),
        behind: 6,
      }),
    });
    expect(story.word).toBe('Approved');
    expect(story.blocker).toBe('6 behind main, so it cannot merge yet');
  });

  it('ends the story on Merged and keeps it last', () => {
    const story = storyOf({
      fact: factOf({ request: { state: 'merged' }, isFinished: true }),
      hasCard: true,
    });
    expect(story.word).toBe('Merged');
    expect(story.blocker).toBe('Merged into main');
    expect(story.rank).toBe(5);
    expect(story.steps.every((step) => step.state !== 'todo')).toBe(true);
  });

  it('turns the checks dot into a ring and says when it was checked when stale', () => {
    const fact = factOf({ request: { checks: 'failure' }, status: status({}), isStale: true });
    const story = storyOf({ fact });
    expect(story.word).toBe('Open');
    expect(story.blocker).toBe('Checked 12m ago');
    expect(story.steps[4]?.state).toBe('ring');
  });

  it('says who works on the branch and keeps a failing branch first', () => {
    const working = storyOf({
      fact: factOf({ request: { isDraft: true, checks: 'success' }, liveCount: 1 }),
    });
    expect(working.blocker).toBe('Implementer is working');
    expect(working.rank).toBe(2);
    const failing = storyOf({
      fact: factOf({ request: { checks: 'failure' }, liveCount: 1 }),
    });
    expect(failing.rank).toBe(0);
  });

  it('adds how far behind main it is when nothing else blocks', () => {
    const story = storyOf({
      fact: factOf({ request: { checks: 'pending' }, status: status({}), behind: 4 }),
    });
    expect(story.blocker).toBe('Then a review from the team, 4 behind main');
  });
});

describe('branchEntriesOf and branchFoldOf', () => {
  const failing = factOf({ key: 'failing', request: { checks: 'failure' }, status: status({}) });
  const local = factOf({
    key: 'local',
    status: status({ push: { kind: 'not-pushed', commits: 2 }, ahead: 2 }),
  });
  const ready = factOf({
    key: 'ready',
    request: { checks: 'success', reviewDecision: 'approved' },
    status: status({}),
  });
  const merged = factOf({ key: 'merged', request: { state: 'merged' }, isFinished: true });

  it('ranks failing, your move, local, merged and breaks ties by the card order', () => {
    const entries = branchEntriesOf({
      facts: [merged, local, ready, failing],
      cardOrderByMountId: new Map([[ready.mountId, 0]]),
      detailByMountId: new Map(),
    });
    expect(entries.map((entry) => entry.fact.branch)).toEqual([
      'ak/eng-1190-failing',
      'ak/eng-1190-ready',
      'ak/eng-1190-local',
      'ak/eng-1190-merged',
    ]);
    expect(entries[1]?.hasCard).toBe(true);
  });

  it('lifts a local branch with a card above one without', () => {
    const other = factOf({
      key: 'other',
      status: status({ push: { kind: 'not-pushed', commits: 1 }, ahead: 1 }),
    });
    const entries = branchEntriesOf({
      facts: [other, local],
      cardOrderByMountId: new Map([[local.mountId, 0]]),
      detailByMountId: new Map(),
    });
    expect(entries[0]?.fact.branch).toBe('ak/eng-1190-local');
  });

  it('does not fold up to the cap and counts what it hides past it', () => {
    const facts = Array.from({ length: BRANCH_ROW_CAP + 3 }, (_, index) =>
      factOf({
        key: `b${index}`,
        request: index < BRANCH_ROW_CAP + 1 ? { checks: 'pending' } : { state: 'merged' },
        isFinished: index >= BRANCH_ROW_CAP + 1,
      }),
    );
    const entries = branchEntriesOf({
      facts,
      cardOrderByMountId: new Map(),
      detailByMountId: new Map(),
    });
    expect(branchFoldOf({ entries: entries.slice(0, BRANCH_ROW_CAP) }).label).toBeNull();
    const oneOver = branchFoldOf({ entries: entries.slice(0, BRANCH_ROW_CAP + 1) });
    expect(oneOver.label).toBeNull();
    expect(oneOver.shown).toHaveLength(BRANCH_ROW_CAP + 1);
    const fold = branchFoldOf({ entries });
    expect(fold.shown).toHaveLength(BRANCH_ROW_CAP);
    expect(fold.label).toBe('3 more branches, 2 merged');
  });

  it('writes the row name as a sentence that starts with the branch', () => {
    const [entry] = branchEntriesOf({
      facts: [failing],
      cardOrderByMountId: new Map([[failing.mountId, 0]]),
      detailByMountId: new Map(),
    });
    if (entry === undefined) {
      throw new Error('One fact gives one entry.');
    }
    expect(branchSentenceOf(entry)).toBe(
      'ak/eng-1190-failing, payments-api, #309: Checks failing, Checks failed on the last push. Has a card in Next.',
    );
  });
});

const sentenceOf = ({ fact }: StoryParams): string => {
  const [entry] = branchEntriesOf({
    facts: [fact],
    cardOrderByMountId: new Map(),
    detailByMountId: new Map(),
  });
  if (entry === undefined) {
    throw new Error('One fact gives one entry.');
  }
  return branchSentenceOf(entry);
};

describe('branchStoryOf, steps that do not apply', () => {
  it('draws a dash on Checks when the host reports no checks after a fresh read', () => {
    const fact = factOf({ request: { checks: null, isChecksAbsent: true } });
    expect(statesOf({ fact })).toBe('dddcstt');
    expect(storyOf({ fact }).blocker).toBe('No checks on this repo');
    expect(storyOf({ fact }).steps[4]?.name).toBe('Checks skipped');
  });

  it('keeps the circle before the first fresh read', () => {
    const fact = factOf({
      request: { checks: null, isChecksAbsent: true, isReviewOptional: true },
      isStale: true,
    });
    expect(statesOf({ fact })).not.toContain('s');
  });

  it('keeps the circle when the host cannot say whether there are checks', () => {
    const fact = factOf({ request: { checks: null } });
    expect(statesOf({ fact })).toBe('dddcttt');
  });

  it('draws a dash on Review when no review is required', () => {
    const fact = factOf({
      request: { checks: 'success', reviewDecision: null, isReviewOptional: true },
    });
    expect(statesOf({ fact })).toBe('dddddsc');
    expect(storyOf({ fact }).blocker).toBe('Every check passed, no review required');
  });

  it('keeps the circle on Review when the host cannot say review is optional', () => {
    const fact = factOf({ request: { checks: 'success', reviewDecision: null } });
    expect(storyOf({ fact }).steps[5]?.state).toBe('done');
    expect(storyOf({ fact }).steps[5]?.name).toBe('Review');
  });

  it('is ready to merge with both dashes on a repo with neither', () => {
    const fact = factOf({
      request: { checks: null, isChecksAbsent: true, isReviewOptional: true },
    });
    const story = storyOf({ fact });
    expect(story.word).toBe('Ready to merge');
    expect(story.blocker).toBe('No checks or review required');
    expect(statesOf({ fact })).toBe('ddddssc');
  });

  it('never skips a failing check', () => {
    const fact = factOf({
      request: { checks: 'failure', isChecksAbsent: true, isReviewOptional: true },
    });
    expect(statesOf({ fact })).toBe('ddddcst');
  });

  it('shows the Queued word on the Merged step', () => {
    const fact = factOf({ request: { state: 'queued', checks: 'success' } });
    const story = storyOf({ fact });
    expect(story.word).toBe('Queued');
    expect(story.steps[6]?.state).toBe('current');
    expect(story.tone).toBe('info');
  });

  it('keeps the circle on a queued PR that was not read lately', () => {
    const fact = factOf({ request: { state: 'queued' }, isStale: true });
    expect(storyOf({ fact }).word).not.toBe('Queued');
  });

  it.each(['github', 'gitlab', 'bitbucket'] as const)(
    'lists the skipped steps in the row name for %s',
    (provider) => {
      const fact = factOf({
        request: { provider, checks: null, isChecksAbsent: true, isReviewOptional: true },
      });
      expect(sentenceOf({ fact })).toContain('Checks skipped, Review skipped.');
    },
  );
});
