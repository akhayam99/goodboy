// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Session, SessionAttentionReason, SessionId, WorkspaceId } from '@goodboy/types';
import {
  attentionFactsOf,
  internReasons,
  isHumanInputReason,
  type StagePullRequest,
} from './attentionFactsOf';

const DATE = '2026-10-07T00:00:00.000Z';

const idle: Session = {
  id: 'session-1' as SessionId,
  workspaceId: 'workspace-1' as WorkspaceId,
  goal: 'Retry failed webhook deliveries',
  state: { kind: 'idle', lastActivityAt: DATE as Session['createdAt'] },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
  permissionMode: 'bypassPermissions',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: DATE as Session['createdAt'],
  updatedAt: DATE as Session['updatedAt'],
};

const errored: Session = {
  ...idle,
  state: { kind: 'error', message: 'provider gave up', failedAt: DATE as Session['createdAt'] },
};

const livePr = (over: Partial<StagePullRequest> = {}): StagePullRequest => ({
  number: 318,
  state: 'open',
  isDraft: false,
  checks: 'success',
  reviewDecision: null,
  ...over,
});

const base = { session: idle, pr: null, hasUnread: false, openQuestionCount: 0 } as const;

describe('attentionFactsOf', () => {
  it('lists nothing for a quiet session', () => {
    expect(attentionFactsOf({ ...base, pr: livePr() })).toEqual([]);
  });

  it('lists failing checks, then the approval, for an approved pull request with failing checks', () => {
    const facts = attentionFactsOf({
      ...base,
      pr: livePr({ state: 'approved', reviewDecision: 'approved', checks: 'failure' }),
    });

    expect(facts).toEqual(['ci-failed', 'pr-approved']);
  });

  it('lists the approval and an agent error in that rank', () => {
    const facts = attentionFactsOf({
      ...base,
      session: errored,
      pr: livePr({ state: 'approved', reviewDecision: 'approved' }),
    });

    expect(facts).toEqual(['agent-error', 'pr-approved']);
  });

  it('lists every reason that holds, in priority order', () => {
    const facts = attentionFactsOf({
      session: errored,
      pr: livePr({ checks: 'failure', reviewDecision: 'changes_requested' }),
      hasUnread: true,
      openQuestionCount: 2,
      fixNeedsYouCount: 1,
      fixCouldntFixCount: 3,
      pushFailedCount: 1,
      hasBlockedAgent: true,
      hasPlanWaiting: true,
    });

    expect(facts).toEqual([
      'needs-approval',
      'agent-error',
      'push-failed',
      'plan-approval',
      'open-question',
      'fix-needs-you',
      'ci-failed',
      'changes-requested',
      'fix-couldnt-fix',
      'unread-reply',
    ]);
  });

  it.each<[string, Parameters<typeof attentionFactsOf>[0], SessionAttentionReason]>([
    ['a blocked agent', { ...base, hasBlockedAgent: true }, 'needs-approval'],
    ['a push that failed', { ...base, pr: livePr(), pushFailedCount: 2 }, 'push-failed'],
    ['a held plan', { ...base, hasPlanWaiting: true }, 'plan-approval'],
    ['an open question', { ...base, openQuestionCount: 1 }, 'open-question'],
    ['a comment that needs you', { ...base, pr: livePr(), fixNeedsYouCount: 1 }, 'fix-needs-you'],
    [
      'a comment it could not fix',
      { ...base, pr: livePr(), fixCouldntFixCount: 1 },
      'fix-couldnt-fix',
    ],
    ['an unread reply', { ...base, hasUnread: true }, 'unread-reply'],
    ['failing checks', { ...base, pr: livePr({ checks: 'failure' }) }, 'ci-failed'],
    [
      'changes requested',
      { ...base, pr: livePr({ reviewDecision: 'changes_requested' }) },
      'changes-requested',
    ],
    [
      'an approved pull request',
      { ...base, pr: livePr({ state: 'approved', reviewDecision: 'approved' }) },
      'pr-approved',
    ],
    [
      'a pull request in the merge queue, whatever its review decision',
      { ...base, pr: livePr({ state: 'queued', reviewDecision: 'approved' }) },
      'pr-queued',
    ],
  ])('lists %s alone', (_name, params, reason) => {
    expect(attentionFactsOf(params)).toEqual([reason]);
  });

  it('ranks a push that failed right after an agent error and never as a human input', () => {
    expect(
      attentionFactsOf({
        ...base,
        session: errored,
        pr: livePr(),
        pushFailedCount: 1,
        openQuestionCount: 1,
      }),
    ).toEqual(['agent-error', 'push-failed', 'open-question']);
    expect(isHumanInputReason({ reason: 'push-failed' })).toBe(false);
  });

  it('ranks the merge queue below what needs you and above an unread reply', () => {
    const queued = livePr({ state: 'queued', reviewDecision: 'approved' });

    expect(
      attentionFactsOf({ ...base, pr: queued, fixCouldntFixCount: 1, hasUnread: true }),
    ).toEqual(['fix-couldnt-fix', 'pr-queued', 'unread-reply']);
    expect(attentionFactsOf({ ...base, pr: { ...queued, checks: 'failure' } })).toEqual([
      'ci-failed',
      'pr-queued',
    ]);
    expect(
      attentionFactsOf({ ...base, pr: { ...queued, reviewDecision: 'changes_requested' } }),
    ).toEqual(['changes-requested', 'pr-queued']);
  });

  it('never calls a pull request in the merge queue approved, ready to merge', () => {
    const queued = livePr({ state: 'queued', reviewDecision: 'approved' });

    expect(attentionFactsOf({ ...base, pr: queued })).not.toContain('pr-approved');
  });

  it('ignores a pull request that is merged or closed', () => {
    const merged = livePr({ state: 'merged', checks: 'failure', reviewDecision: 'approved' });
    const closed = livePr({ state: 'closed', checks: 'failure' });

    expect(attentionFactsOf({ ...base, pr: merged })).toEqual([]);
    expect(attentionFactsOf({ ...base, pr: closed })).toEqual([]);
  });

  it('lists comments that need you on a merged pull request, as the stage always did', () => {
    const merged = livePr({ state: 'merged' });

    expect(attentionFactsOf({ ...base, pr: merged, fixNeedsYouCount: 1 })).toEqual([
      'fix-needs-you',
    ]);
  });

  it('keeps a branchless session to what it can hold: tools, plans, questions and replies', () => {
    const facts = attentionFactsOf({
      ...base,
      isBranchless: true,
      pr: livePr({ checks: 'failure', reviewDecision: 'approved' }),
      fixNeedsYouCount: 2,
      fixCouldntFixCount: 2,
      hasUnread: true,
      openQuestionCount: 1,
      hasPlanWaiting: true,
    });

    expect(facts).toEqual(['plan-approval', 'open-question', 'unread-reply']);
  });

  it('hands back the same list for the same facts, so a shallow compare holds', () => {
    const first = attentionFactsOf({ ...base, pr: livePr({ checks: 'failure' }), hasUnread: true });
    const second = attentionFactsOf({
      ...base,
      pr: livePr({ checks: 'failure', number: 9 }),
      hasUnread: true,
    });

    expect(second).toBe(first);
    expect(attentionFactsOf({ ...base })).toBe(attentionFactsOf({ ...base, hasUnread: false }));
  });
});

describe('internReasons', () => {
  it('shares one list per sequence and one empty list', () => {
    const one = internReasons({ reasons: ['ci-failed', 'unread-reply'] });
    const two = internReasons({ reasons: ['ci-failed', 'unread-reply'] });
    const other = internReasons({ reasons: ['unread-reply', 'ci-failed'] });

    expect(two).toBe(one);
    expect(other).not.toBe(one);
    expect(internReasons({ reasons: [] })).toBe(internReasons({ reasons: [] }));
    expect(internReasons({ reasons: [] })).toBe(attentionFactsOf({ ...base }));
  });
});

describe('isHumanInputReason', () => {
  it.each<[SessionAttentionReason, boolean]>([
    ['needs-approval', true],
    ['plan-approval', true],
    ['open-question', true],
    ['fix-needs-you', true],
    ['agent-error', false],
    ['ci-failed', false],
    ['changes-requested', false],
    ['fix-couldnt-fix', false],
    ['pr-queued', false],
    ['pr-approved', false],
    ['unread-reply', false],
    ['run-stopped', false],
    ['run-paused-at-limit', true],
    ['run-waits-for-go', true],
    ['auto-needs-you', true],
    ['slack-reply-waiting', true],
  ])('says %s is human input: %s', (reason, expected) => {
    expect(isHumanInputReason({ reason })).toBe(expected);
  });
});

describe('attentionFactsOf and a deferred reason', () => {
  const deferred = (...reasons: ReadonlyArray<SessionAttentionReason>) => new Set(reasons);

  it('leaves out failing checks that the person put away, and keeps the rest', () => {
    const pr = livePr({ checks: 'failure', reviewDecision: 'changes_requested' });

    expect(attentionFactsOf({ ...base, pr, deferredReasons: deferred('ci-failed') })).toEqual([
      'changes-requested',
    ]);
  });

  it('leaves out an approval that Not now put away', () => {
    const pr = livePr({ state: 'approved', reviewDecision: 'approved' });

    expect(attentionFactsOf({ ...base, pr, deferredReasons: deferred('pr-approved') })).toEqual([]);
  });

  it('brings the reason back when the deferral ends', () => {
    const pr = livePr({ checks: 'failure' });

    expect(attentionFactsOf({ ...base, pr, deferredReasons: deferred() })).toEqual(['ci-failed']);
    expect(attentionFactsOf({ ...base, pr })).toEqual(['ci-failed']);
  });

  it.each<SessionAttentionReason>([
    'needs-approval',
    'plan-approval',
    'open-question',
    'fix-needs-you',
    'run-waits-for-go',
    'auto-needs-you',
    'slack-reply-waiting',
    'run-paused-at-limit',
  ])('never defers %s, which asks the person for input', (reason) => {
    const holding = {
      ...base,
      pr: livePr(),
      hasBlockedAgent: reason === 'needs-approval',
      hasPlanWaiting: reason === 'plan-approval',
      openQuestionCount: reason === 'open-question' ? 1 : 0,
      fixNeedsYouCount: reason === 'fix-needs-you' ? 1 : 0,
      hasRunWaitingForGo: reason === 'run-waits-for-go',
      hasAutoNeedsYou: reason === 'auto-needs-you',
      hasSlackReplyWaiting: reason === 'slack-reply-waiting',
      hasLimitPausedRun: reason === 'run-paused-at-limit',
    };

    expect(attentionFactsOf({ ...holding, deferredReasons: deferred(reason) })).toEqual([reason]);
  });
});
