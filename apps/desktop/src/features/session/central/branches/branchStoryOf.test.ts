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
  readonly detail?: BranchDetailWords | null;
};

type EntriesParams = {
  readonly facts: ReadonlyArray<BranchFacts>;
  readonly detailByMountId?: ReadonlyMap<string, BranchDetailWords>;
};

const allEntriesOf = ({ facts, detailByMountId = new Map() }: EntriesParams) => {
  const { live, finished } = branchEntriesOf({ facts, detailByMountId });
  return [...live, ...finished];
};

const storyOf = ({ fact, detail = null }: StoryParams) => {
  const [entry] = allEntriesOf({
    facts: [fact],
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
  it('says Nothing committed on the current Commit stage', () => {
    const fact = factOf({
      status: status({ ahead: 0, push: { kind: 'not-pushed', commits: 0 }, changedFiles: 4 }),
    });
    const story = storyOf({ fact });
    expect(story.word).toBe('Nothing committed');
    expect(story.blocker).toBe('4 files changed');
    expect(statesOf({ fact })).toBe('cttttt');
  });

  it('says Not pushed with the commits to push', () => {
    const fact = factOf({ status: status({ push: { kind: 'not-pushed', commits: 3 } }) });
    const story = storyOf({ fact });
    expect(story.word).toBe('Not pushed');
    expect(story.blocker).toBe('3 commits to push');
    expect(story.rank).toBe(2);
  });

  it('says No pull request once pushed, in a neutral tone', () => {
    const story = storyOf({ fact: factOf({ status: status({ ahead: 2 }) }) });
    expect(story.word).toBe('No pull request');
    expect(story.blocker).toBe('2 commits pushed');
    expect(story.tone).toBe('neutral');
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
    expect(storyOf({ fact }).blocker).toBe('Failed on the last push');
    const named = storyOf({
      fact,
      detail: { failingChecks: ['static-analysis'], openThreads: 0 },
    });
    expect(named.word).toBe('Checks failing');
    expect(named.blocker).toBe('static-analysis failed');
    expect(named.rank).toBe(0);
    expect(named.tone).toBe('danger');
  });

  it('counts threads to answer when changes are requested', () => {
    const fact = factOf({
      request: { checks: 'success', reviewDecision: 'changes_requested' },
      status: status({}),
    });
    expect(storyOf({ fact }).blocker).toBe('A reviewer asked for changes');
    const named = storyOf({ fact, detail: { failingChecks: [], openThreads: 2 } });
    expect(named.word).toBe('Changes requested');
    expect(named.tone).toBe('warning');
    expect(named.blocker).toBe('2 threads to answer');
  });

  it('says Draft, then Checks running, then In review', () => {
    const draft = storyOf({
      fact: factOf({ request: { isDraft: true, checks: 'success' }, status: status({}) }),
    });
    expect(draft.word).toBe('Draft');
    expect(draft.tone).toBe('neutral');
    expect(
      storyOf({ fact: factOf({ request: { checks: 'pending' }, status: status({}) }) }).word,
    ).toBe('Checks running');
    const review = storyOf({
      fact: factOf({
        request: { checks: 'success', reviewDecision: 'review_required' },
        status: status({}),
      }),
    });
    expect(review.word).toBe('In review');
    expect(review.tone).toBe('info');
  });

  it('says Approved in green when approved and green', () => {
    const story = storyOf({
      fact: factOf({
        request: { checks: 'success', reviewDecision: 'approved' },
        status: status({}),
      }),
    });
    expect(story.word).toBe('Approved');
    expect(story.tone).toBe('success');
    expect(story.rank).toBe(1);
    expect(story.steps.at(-1)?.state).toBe('current');
  });

  it('says Conflicts in amber when an approved branch cannot merge', () => {
    const story = storyOf({
      fact: factOf({
        request: { checks: 'success', reviewDecision: 'approved', isMergeable: false },
        status: status({}),
        behind: 6,
      }),
    });
    expect(story.word).toBe('Conflicts');
    expect(story.tone).toBe('warning');
    expect(story.blocker).toBe('6 behind main');
  });

  it('ends the story on Merged and keeps it last', () => {
    const story = storyOf({
      fact: factOf({ request: { state: 'merged' }, isFinished: true }),
    });
    expect(story.word).toBe('Merged');
    expect(story.tone).toBe('merged');
    expect(story.blocker).toBe('Into main');
    expect(story.rank).toBe(5);
    expect(story.steps.every((step) => step.state !== 'todo')).toBe(true);
  });

  it('stands on Checks and says when it was checked when stale', () => {
    const fact = factOf({ request: { checks: 'failure' }, status: status({}), isStale: true });
    const story = storyOf({ fact });
    expect(story.word).toBe('Open');
    expect(story.blocker).toBe('Checked 12m ago');
    expect(story.steps[3]?.state).toBe('current');
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

  it.each([
    {
      name: 'not pushed',
      fact: () => factOf({ status: status({ push: { kind: 'not-pushed', commits: 2 } }) }),
      states: 'dctttt',
    },
    {
      name: 'draft',
      fact: () => factOf({ request: { isDraft: true }, status: status({}) }),
      states: 'ddcttt',
    },
    {
      name: 'in review',
      fact: () =>
        factOf({
          request: { checks: 'success', reviewDecision: 'review_required' },
          status: status({}),
        }),
      states: 'ddddct',
    },
    {
      name: 'approved',
      fact: () =>
        factOf({ request: { checks: 'success', reviewDecision: 'approved' }, status: status({}) }),
      states: 'dddddc',
    },
  ])('stands a $name branch on six stages, $states', ({ fact, states }) => {
    const story = storyOf({ fact: fact() });
    expect(story.steps.map((step) => step.label)).toEqual([
      'Commit',
      'Push',
      'Pull request',
      'Checks',
      'Review',
      'Merge',
    ]);
    expect(story.steps.map((step) => step.state[0]).join('')).toBe(states);
  });

  it('says one fact and leaves how far behind main out of the detail', () => {
    const story = storyOf({
      fact: factOf({ request: { checks: 'pending' }, status: status({}), behind: 4 }),
    });
    expect(story.blocker).toBe('Review comes next');
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

  it('ranks blocked, ready, your move, an agent at work, waiting on others, merged out', () => {
    const inReview = factOf({
      key: 'review',
      request: { checks: 'success', reviewDecision: 'review_required' },
      status: status({}),
    });
    const working = factOf({ key: 'working', request: { checks: 'pending' }, liveCount: 1 });
    const { live, finished } = branchEntriesOf({
      facts: [merged, inReview, local, working, ready, failing],
      detailByMountId: new Map(),
    });
    expect(live.map((entry) => [entry.fact.branch, entry.story.rank])).toEqual([
      ['ak/eng-1190-failing', 0],
      ['ak/eng-1190-ready', 1],
      ['ak/eng-1190-local', 2],
      ['ak/eng-1190-working', 3],
      ['ak/eng-1190-review', 4],
    ]);
    expect(finished.map((entry) => entry.fact.branch)).toEqual(['ak/eng-1190-merged']);
  });

  it('keeps the first seen order between two branches of one rank, a Next card moves nothing', () => {
    const other = factOf({
      key: 'other',
      status: status({ push: { kind: 'not-pushed', commits: 1 }, ahead: 1 }),
    });
    const { live } = branchEntriesOf({ facts: [other, local], detailByMountId: new Map() });
    expect(live.map((entry) => entry.fact.branch)).toEqual([
      'ak/eng-1190-other',
      'ak/eng-1190-local',
    ]);
  });

  it('does not fold up to the cap and counts what it hides past it', () => {
    const facts = Array.from({ length: BRANCH_ROW_CAP + 3 }, (_, index) =>
      factOf({
        key: `b${index}`,
        request: index < BRANCH_ROW_CAP + 1 ? { checks: 'pending' } : { state: 'merged' },
        isFinished: index >= BRANCH_ROW_CAP + 1,
      }),
    );
    const entries = allEntriesOf({ facts });
    expect(branchFoldOf({ entries: entries.slice(0, BRANCH_ROW_CAP) }).label).toBeNull();
    const oneOver = branchFoldOf({ entries: entries.slice(0, BRANCH_ROW_CAP + 1) });
    expect(oneOver.label).toBeNull();
    expect(oneOver.shown).toHaveLength(BRANCH_ROW_CAP + 1);
    const fold = branchFoldOf({ entries });
    expect(fold.shown).toHaveLength(BRANCH_ROW_CAP);
    expect(fold.label).toBe('3 more branches, 2 merged');
  });

  it('says one short fact per branch', () => {
    const details = [
      storyOf({ fact: factOf({ status: status({ push: { kind: 'ahead', ahead: 24 } }) }) }),
      storyOf({
        fact: factOf({ request: { isDraft: true, checks: 'success' }, status: status({}) }),
      }),
      storyOf({ fact: factOf({ request: { checks: 'pending' }, status: status({}) }) }),
      storyOf({
        fact: factOf({
          request: { checks: 'success', reviewDecision: 'review_required' },
          status: status({}),
        }),
      }),
      storyOf({
        fact: factOf({
          request: { checks: 'success', reviewDecision: 'approved' },
          status: status({}),
        }),
      }),
    ].map((story) => story.blocker);
    expect(details).toEqual([
      '24 commits to push',
      'Checks passed',
      'Review comes next',
      'Waiting for a reviewer',
      'Ready to merge',
    ]);
    expect(details.every((detail) => detail.length <= 24 && !detail.includes(','))).toBe(true);
  });

  it('writes the row name as a sentence that starts with the branch, without the card', () => {
    const [entry] = allEntriesOf({ facts: [failing] });
    if (entry === undefined) {
      throw new Error('One fact gives one entry.');
    }
    expect(branchSentenceOf(entry)).toBe(
      'ak/eng-1190-failing, payments-api, #309: Checks failing, Failed on the last push.',
    );
  });
});

const sentenceOf = ({ fact }: StoryParams): string => {
  const [entry] = allEntriesOf({ facts: [fact] });
  if (entry === undefined) {
    throw new Error('One fact gives one entry.');
  }
  return branchSentenceOf(entry);
};

describe('branchStoryOf, steps that do not apply', () => {
  it('draws a dash on Checks when the host reports no checks after a fresh read', () => {
    const fact = factOf({ request: { checks: null, isChecksAbsent: true } });
    expect(statesOf({ fact })).toBe('ddcstt');
    expect(storyOf({ fact }).blocker).toBe('No checks on this repo');
    expect(storyOf({ fact }).steps[3]?.name).toBe('Checks skipped');
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
    expect(statesOf({ fact })).toBe('ddcttt');
  });

  it('draws a dash on Review when no review is required', () => {
    const fact = factOf({
      request: { checks: 'success', reviewDecision: null, isReviewOptional: true },
    });
    expect(statesOf({ fact })).toBe('ddddsc');
    expect(storyOf({ fact }).blocker).toBe('No review required');
  });

  it('keeps the circle on Review when the host cannot say review is optional', () => {
    const fact = factOf({ request: { checks: 'success', reviewDecision: null } });
    expect(storyOf({ fact }).steps[4]?.state).toBe('done');
    expect(storyOf({ fact }).steps[4]?.name).toBe('Review');
  });

  it('is ready to merge with both dashes on a repo with neither', () => {
    const fact = factOf({
      request: { checks: null, isChecksAbsent: true, isReviewOptional: true },
    });
    const story = storyOf({ fact });
    expect(story.word).toBe('Ready to merge');
    expect(story.blocker).toBe('No checks or review required');
    expect(statesOf({ fact })).toBe('dddssc');
  });

  it('never skips a failing check', () => {
    const fact = factOf({
      request: { checks: 'failure', isChecksAbsent: true, isReviewOptional: true },
    });
    expect(statesOf({ fact })).toBe('dddcst');
  });

  it('shows In merge queue on the Merged step', () => {
    const fact = factOf({ request: { state: 'queued', checks: 'success' } });
    const story = storyOf({ fact });
    expect(story.word).toBe('In merge queue');
    expect(story.steps[5]?.state).toBe('current');
    expect(story.tone).toBe('primary');
  });

  it('keeps the circle on a queued PR that was not read lately', () => {
    const fact = factOf({ request: { state: 'queued' }, isStale: true });
    expect(storyOf({ fact }).word).not.toBe('In merge queue');
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
