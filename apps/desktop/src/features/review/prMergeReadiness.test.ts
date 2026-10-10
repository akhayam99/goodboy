// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { PullRequestState, SessionId } from '@goodboy/types';
import { pullRequestFacts, type PullRequestFacts } from '../actions/kinds/pullRequestFacts';
import { evaluatePrMergeReadiness, mergeIsClear, mergeabilityNoteOf } from './prMergeReadiness';

const PR: PullRequestState = {
  number: 248,
  title: 'Retry failed requests',
  url: 'https://github.com/acme/web/pull/248',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'feature/retry',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-01-01T00:00:00Z',
};

type Patch = Omit<Partial<PullRequestFacts>, 'pr'> & {
  readonly pr?: Partial<PullRequestState> | null;
};

const factsOf = (patch: Patch = {}): PullRequestFacts => {
  const { pr: prPatch, ...rest } = patch;
  const base = pullRequestFacts({
    sessionId: 'session-harborline' as SessionId,
    pr: prPatch === null ? null : { ...PR, ...prPatch },
    checks: null,
    comments: [],
    reviews: [],
    viewer: null,
    writeInFlight: null,
    isScribeWriting: false,
  });
  return { ...base, ...rest };
};

type Row = {
  readonly name: string;
  readonly facts: PullRequestFacts;
  readonly status: 'ready' | 'unknown' | 'blocked';
  readonly reason: string;
  readonly word: string;
  readonly isClear: boolean;
};

const ROWS: ReadonlyArray<Row> = [
  {
    name: 'a mergeable pull request with nothing outstanding',
    facts: factsOf(),
    status: 'ready',
    reason: 'Ready to merge',
    word: 'Ready to merge',
    isClear: true,
  },
  {
    name: 'a repository with no review rule and no checks',
    facts: factsOf({ pr: { reviewDecision: null, checks: null } }),
    status: 'ready',
    reason: 'Ready to merge',
    word: 'Ready to merge',
    isClear: true,
  },
  {
    name: 'a head that conflicts with the base',
    facts: factsOf({ pr: { mergeable: false } }),
    status: 'blocked',
    reason: 'Conflicts with main. Rebase on main from the Branch header.',
    word: 'Blocked: conflicts with main',
    isClear: false,
  },
  {
    name: 'a draft',
    facts: factsOf({ pr: { isDraft: true } }),
    status: 'blocked',
    reason: 'Mark this pull request ready before merging.',
    word: 'Draft, not open for review yet',
    isClear: false,
  },
  {
    name: 'a merged pull request',
    facts: factsOf({ pr: { state: 'merged' } }),
    status: 'blocked',
    reason: 'This pull request is already merged.',
    word: 'Merged',
    isClear: false,
  },
  {
    name: 'a closed pull request',
    facts: factsOf({ pr: { state: 'closed' } }),
    status: 'blocked',
    reason: 'Reopen this pull request before merging.',
    word: 'Closed',
    isClear: false,
  },
  {
    name: 'a pull request GitHub is already set to merge',
    facts: factsOf({ pr: { state: 'queued' } }),
    status: 'blocked',
    reason: 'GitHub is already set to merge this pull request.',
    word: 'Set to merge when checks pass',
    isClear: false,
  },
  {
    name: 'no pull request',
    facts: factsOf({ pr: null }),
    status: 'blocked',
    reason: 'This session has no pull request.',
    word: 'No pull request yet',
    isClear: false,
  },
  {
    name: 'checks the list could not read',
    facts: factsOf({ pr: { checks: null, checksUnknown: true } }),
    status: 'blocked',
    reason: 'Checks unknown.',
    word: 'Blocked: checks unknown',
    isClear: false,
  },
  {
    name: 'one failing check',
    facts: factsOf({ checks: 'failing', failingChecks: ['unit tests'] }),
    status: 'blocked',
    reason: '1 check failing: unit tests.',
    word: 'Blocked: 1 check failing',
    isClear: false,
  },
  {
    name: 'two failing checks',
    facts: factsOf({ checks: 'failing', failingChecks: ['unit tests', 'lint'] }),
    status: 'blocked',
    reason: '2 checks failing: unit tests, lint.',
    word: 'Blocked: 2 checks failing',
    isClear: false,
  },
  {
    name: 'running checks',
    facts: factsOf({ checks: 'pending', runningChecks: 2 }),
    status: 'blocked',
    reason: '2 checks still running.',
    word: 'Waiting on checks',
    isClear: false,
  },
  {
    name: 'running checks and a review still required',
    facts: factsOf({ checks: 'pending', runningChecks: 2, review: 'review_required' }),
    status: 'blocked',
    reason: '2 checks still running.',
    word: 'Waiting on checks and review',
    isClear: false,
  },
  {
    name: 'changes requested by a named reviewer',
    facts: factsOf({ review: 'changes_requested', changesRequestedBy: ['kenji-w'] }),
    status: 'blocked',
    reason: 'kenji-w asked for changes.',
    word: 'Changes requested',
    isClear: false,
  },
  {
    name: 'changes requested by someone unnamed',
    facts: factsOf({ review: 'changes_requested' }),
    status: 'blocked',
    reason: 'A reviewer asked for changes.',
    word: 'Changes requested',
    isClear: false,
  },
  {
    name: 'a review still required',
    facts: factsOf({ review: 'review_required' }),
    status: 'blocked',
    reason: 'Needs an approving review.',
    word: 'Waiting on review',
    isClear: false,
  },
  {
    name: 'a write already in flight',
    facts: factsOf({ writeInFlight: 'Goodboy is already merging #248' }),
    status: 'blocked',
    reason: 'Goodboy is already merging #248.',
    word: 'Ready to merge',
    isClear: false,
  },
  {
    name: 'a mergeable flag GitHub has not computed',
    facts: factsOf({ pr: { mergeable: null } }),
    status: 'unknown',
    reason: 'GitHub has not finished checking whether this branch merges.',
    word: 'Ready to merge',
    isClear: false,
  },
  {
    name: 'comments waiting for the owner',
    facts: factsOf({ commentsNeedYou: 3 }),
    status: 'ready',
    reason: '3 comments need you',
    word: '3 comments need you',
    isClear: false,
  },
  {
    name: 'one comment waiting for the owner',
    facts: factsOf({ commentsNeedYou: 1 }),
    status: 'ready',
    reason: '1 comment needs you',
    word: '1 comment needs you',
    isClear: false,
  },
  {
    name: 'a fix run that is live',
    facts: factsOf({ isFixRunLive: true }),
    status: 'ready',
    reason: 'A run is live on this branch',
    word: 'A run is live on this branch',
    isClear: false,
  },
  {
    name: 'comments waiting and a fix run live',
    facts: factsOf({ commentsNeedYou: 2, isFixRunLive: true }),
    status: 'ready',
    reason: '2 comments need you, a run is live',
    word: '2 comments need you, a run is live',
    isClear: false,
  },
];

describe('evaluatePrMergeReadiness tone', () => {
  it.each([
    ['nothing outstanding', factsOf(), 'success'],
    ['comments waiting', factsOf({ commentsNeedYou: 2 }), 'warning'],
    ['a live run', factsOf({ isFixRunLive: true }), 'info'],
    ['changes requested', factsOf({ review: 'changes_requested' }), 'warning'],
    ['a failing check', factsOf({ checks: 'failing', failingChecks: ['lint'] }), 'danger'],
    ['conflicts', factsOf({ pr: { mergeable: false } }), 'danger'],
    ['running checks', factsOf({ checks: 'pending', runningChecks: 1 }), 'neutral'],
    ['a draft', factsOf({ pr: { isDraft: true } }), 'neutral'],
    ['a merged pull request', factsOf({ pr: { state: 'merged' } }), 'neutral'],
    ['mergeability not computed', factsOf({ pr: { mergeable: null } }), 'neutral'],
  ] as const)('is %s', (_name, facts, tone) => {
    expect(evaluatePrMergeReadiness({ facts }).tone).toBe(tone);
  });
});

describe('evaluatePrMergeReadiness', () => {
  it.each(ROWS)('reads $name', ({ facts, status, reason, word, isClear }) => {
    const readiness = evaluatePrMergeReadiness({ facts });

    expect(readiness.status).toBe(status);
    expect(readiness.reason).toBe(reason);
    expect(readiness.word).toBe(word);
    expect(mergeIsClear({ readiness })).toBe(isClear);
  });

  it('keeps the blockers apart from the caveats', () => {
    const readiness = evaluatePrMergeReadiness({
      facts: factsOf({ checks: 'failing', failingChecks: ['unit tests'], commentsNeedYou: 2 }),
    });

    expect(readiness.blockers).toEqual(['1 check failing: unit tests.']);
    expect(readiness.caveats).toEqual(['2 comments need you']);
  });

  it('lists every blocker in the order the header prints them', () => {
    const readiness = evaluatePrMergeReadiness({
      facts: factsOf({
        pr: { mergeable: false },
        checks: 'failing',
        failingChecks: ['lint'],
        review: 'review_required',
      }),
    });

    expect(readiness.blockers).toEqual([
      'Conflicts with main. Rebase on main from the Branch header.',
      '1 check failing: lint.',
      'Needs an approving review.',
    ]);
  });

  it('says why a draft cannot merge before it says anything about checks', () => {
    const readiness = evaluatePrMergeReadiness({
      facts: factsOf({ pr: { isDraft: true, checks: null, checksUnknown: true } }),
    });

    expect(readiness.reason).toBe('Mark this pull request ready before merging.');
  });

  it.each(['denied', 'failed'] as const)(
    'is never clear while the detail read of the checks is %s',
    (checksRead) => {
      const facts = pullRequestFacts({
        sessionId: 'session-harborline' as SessionId,
        pr: PR,
        checks: [],
        checksRead,
        comments: [],
        reviews: [],
        viewer: null,
        writeInFlight: null,
        isScribeWriting: false,
      });

      expect(evaluatePrMergeReadiness({ facts }).status).toBe('blocked');
      expect(evaluatePrMergeReadiness({ facts }).reason).toBe('Checks unknown.');
    },
  );
});

describe('merge readiness on Bitbucket', () => {
  const bitbucket = (patch: Patch = {}): PullRequestFacts =>
    factsOf({
      host: 'bitbucket',
      ...patch,
      pr: patch.pr === null ? null : { mergeable: null, ...patch.pr },
    });

  it('is ready, not unknown, when the host gives no mergeability and nothing blocks', () => {
    const readiness = evaluatePrMergeReadiness({ facts: bitbucket() });

    expect(readiness.status).toBe('ready');
    expect(readiness.blockers).toEqual([]);
    expect(mergeIsClear({ readiness })).toBe(true);
  });

  it('still blocks on failing checks and asked-for changes', () => {
    const readiness = evaluatePrMergeReadiness({
      facts: bitbucket({
        checks: 'failing',
        failingChecks: ['lint'],
        review: 'changes_requested',
        changesRequestedBy: ['omar-t'],
      }),
    });

    expect(readiness.status).toBe('blocked');
    expect(readiness.blockers).toEqual(['1 check failing: lint.', 'omar-t asked for changes.']);
  });

  it('says a declined pull request was declined, with no Reopen to suggest', () => {
    const readiness = evaluatePrMergeReadiness({ facts: bitbucket({ phase: 'closed' }) });

    expect(readiness.reason).toBe('This pull request was declined.');
    expect(readiness.word).toBe('Closed');
  });

  it('keeps GitHub unknown while it has not finished checking', () => {
    const readiness = evaluatePrMergeReadiness({
      facts: factsOf({ pr: { mergeable: null } }),
    });

    expect(readiness.status).toBe('unknown');
    expect(mergeabilityNoteOf({ host: 'github', mergeable: null })).toBeNull();
  });

  it('words the caveat of a host that never says', () => {
    expect(mergeabilityNoteOf({ host: 'bitbucket', mergeable: null })).toBe(
      'Bitbucket checks this when you merge',
    );
    expect(mergeabilityNoteOf({ host: 'bitbucket', mergeable: true })).toBeNull();
  });
});
