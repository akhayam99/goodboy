// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Session, SessionAttentionReason, SessionId, WorkspaceId } from '@goodboy/types';
import type { StagePullRequest } from './attentionFactsOf';
import { deriveSessionStage } from './deriveSessionStage';

type Params = Parameters<typeof deriveSessionStage>[0];

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

type Outcome = {
  readonly stage: string;
  readonly attention: SessionAttentionReason | null;
  readonly reason: string;
};

type Row = {
  readonly name: string;
  readonly params: Params;
  readonly before: Outcome | null;
  readonly after: Outcome & { readonly isRunning: boolean };
};

const approvedPr = livePr({ state: 'approved', reviewDecision: 'approved' });

const ROWS: ReadonlyArray<Row> = [
  {
    name: 'an open question alone',
    params: { ...base, pr: livePr(), openQuestionCount: 1 },
    before: { stage: 'attention', attention: 'open-question', reason: '1 open question' },
    after: {
      stage: 'attention',
      attention: 'open-question',
      reason: '1 open question',
      isRunning: false,
    },
  },
  {
    name: 'two open questions alone',
    params: { ...base, pr: livePr(), openQuestionCount: 2 },
    before: { stage: 'attention', attention: 'open-question', reason: '2 open questions' },
    after: {
      stage: 'attention',
      attention: 'open-question',
      reason: '2 open questions',
      isRunning: false,
    },
  },
  {
    name: 'a comment that needs you alone',
    params: { ...base, pr: livePr(), fixNeedsYouCount: 1 },
    before: { stage: 'attention', attention: 'fix-needs-you', reason: '1 comment needs you' },
    after: {
      stage: 'attention',
      attention: 'fix-needs-you',
      reason: '1 comment needs you',
      isRunning: false,
    },
  },
  {
    name: 'comments the fix could not fix alone',
    params: { ...base, pr: livePr(), fixCouldntFixCount: 2 },
    before: {
      stage: 'attention',
      attention: 'fix-couldnt-fix',
      reason: "2 comments couldn't be fixed",
    },
    after: {
      stage: 'attention',
      attention: 'fix-couldnt-fix',
      reason: "2 comments couldn't be fixed",
      isRunning: false,
    },
  },
  {
    name: 'an unread reply alone',
    params: { ...base, pr: livePr(), hasUnread: true },
    before: { stage: 'attention', attention: 'unread-reply', reason: 'unread agent reply' },
    after: {
      stage: 'attention',
      attention: 'unread-reply',
      reason: 'unread agent reply',
      isRunning: false,
    },
  },
  {
    name: 'failing checks alone',
    params: { ...base, pr: livePr({ checks: 'failure' }) },
    before: { stage: 'attention', attention: 'ci-failed', reason: 'PR #318: CI failed' },
    after: {
      stage: 'attention',
      attention: 'ci-failed',
      reason: 'PR #318: checks failing',
      isRunning: false,
    },
  },
  {
    name: 'changes requested alone',
    params: { ...base, pr: livePr({ reviewDecision: 'changes_requested' }) },
    before: {
      stage: 'attention',
      attention: 'changes-requested',
      reason: 'PR #318: changes requested',
    },
    after: {
      stage: 'attention',
      attention: 'changes-requested',
      reason: 'PR #318: changes requested',
      isRunning: false,
    },
  },
  {
    name: 'an approved pull request alone',
    params: { ...base, pr: approvedPr },
    before: {
      stage: 'attention',
      attention: 'pr-approved',
      reason: 'PR #318 approved, ready to merge',
    },
    after: {
      stage: 'attention',
      attention: 'pr-approved',
      reason: 'PR #318 approved, ready to merge',
      isRunning: false,
    },
  },
  {
    name: 'a tool waiting for approval',
    params: { ...base, pr: livePr(), hasBlockedAgent: true },
    before: { stage: 'attention', attention: 'needs-approval', reason: 'Needs approval' },
    after: {
      stage: 'attention',
      attention: 'needs-approval',
      reason: 'Needs approval',
      isRunning: false,
    },
  },
  {
    name: 'an agent error',
    params: { ...base, session: errored, pr: livePr() },
    before: { stage: 'attention', attention: 'agent-error', reason: 'agent errored' },
    after: {
      stage: 'attention',
      attention: 'agent-error',
      reason: 'agent errored',
      isRunning: false,
    },
  },
  {
    name: 'running alone',
    params: { ...base, pr: livePr(), hasRunningAgent: true },
    before: { stage: 'running', attention: null, reason: 'agent running' },
    after: { stage: 'running', attention: null, reason: 'agent running', isRunning: true },
  },
  {
    name: 'running with an open question',
    params: { ...base, pr: livePr(), hasRunningAgent: true, openQuestionCount: 1 },
    before: { stage: 'running', attention: null, reason: 'agent running' },
    after: {
      stage: 'attention',
      attention: 'open-question',
      reason: '1 open question',
      isRunning: true,
    },
  },
  {
    name: 'running with a comment that needs you',
    params: { ...base, pr: livePr(), hasRunningAgent: true, fixNeedsYouCount: 1 },
    before: { stage: 'running', attention: null, reason: 'agent running' },
    after: {
      stage: 'attention',
      attention: 'fix-needs-you',
      reason: '1 comment needs you',
      isRunning: true,
    },
  },
  {
    name: 'running with failing checks',
    params: { ...base, pr: livePr({ checks: 'failure' }), hasRunningAgent: true },
    before: { stage: 'running', attention: null, reason: 'agent running' },
    after: { stage: 'running', attention: null, reason: 'agent running', isRunning: true },
  },
  {
    name: 'running with an approved pull request',
    params: { ...base, pr: approvedPr, hasRunningAgent: true },
    before: { stage: 'running', attention: null, reason: 'agent running' },
    after: { stage: 'running', attention: null, reason: 'agent running', isRunning: true },
  },
  {
    name: 'approved with failing checks',
    params: { ...base, pr: livePr({ ...approvedPr, checks: 'failure' }) },
    before: { stage: 'attention', attention: 'ci-failed', reason: 'PR #318: CI failed' },
    after: {
      stage: 'attention',
      attention: 'ci-failed',
      reason: 'PR #318: checks failing',
      isRunning: false,
    },
  },
  {
    name: 'approved with an agent error',
    params: { ...base, session: errored, pr: approvedPr },
    before: { stage: 'attention', attention: 'agent-error', reason: 'agent errored' },
    after: {
      stage: 'attention',
      attention: 'agent-error',
      reason: 'agent errored',
      isRunning: false,
    },
  },
  {
    name: 'a merged pull request with nothing left',
    params: { ...base, pr: livePr({ state: 'merged' }) },
    before: { stage: 'done', attention: null, reason: 'PR #318 merged' },
    after: { stage: 'done', attention: null, reason: 'PR #318 merged', isRunning: false },
  },
  {
    name: 'a branchless session with a question',
    params: { ...base, isBranchless: true, openQuestionCount: 1 },
    before: { stage: 'attention', attention: 'open-question', reason: '1 open question' },
    after: {
      stage: 'attention',
      attention: 'open-question',
      reason: '1 open question',
      isRunning: false,
    },
  },
  {
    name: 'a branchless session that is idle',
    params: { ...base, isBranchless: true },
    before: { stage: 'building', attention: null, reason: 'ready for work' },
    after: { stage: 'building', attention: null, reason: 'ready for work', isRunning: false },
  },
  {
    name: 'a pull request with checks running',
    params: { ...base, pr: livePr({ checks: 'pending' }) },
    before: { stage: 'review', attention: null, reason: 'PR #318: CI running' },
    after: {
      stage: 'review',
      attention: null,
      reason: 'PR #318: checks running',
      isRunning: false,
    },
  },
  {
    name: 'a held plan alone',
    params: { ...base, pr: livePr(), hasPlanWaiting: true },
    before: null,
    after: {
      stage: 'attention',
      attention: 'plan-approval',
      reason: 'plan waiting for approval',
      isRunning: false,
    },
  },
  {
    name: 'running with a held plan',
    params: { ...base, pr: livePr(), hasRunningAgent: true, hasPlanWaiting: true },
    before: null,
    after: {
      stage: 'attention',
      attention: 'plan-approval',
      reason: 'plan waiting for approval',
      isRunning: true,
    },
  },
  {
    name: 'running with a tool waiting for approval',
    params: { ...base, pr: livePr(), hasRunningAgent: true, hasBlockedAgent: true },
    before: { stage: 'attention', attention: 'needs-approval', reason: 'Needs approval' },
    after: {
      stage: 'attention',
      attention: 'needs-approval',
      reason: 'Needs approval',
      isRunning: true,
    },
  },
  {
    name: 'a deciding workflow with an open question',
    params: { ...base, pr: livePr(), isDecidingWorkflow: true, openQuestionCount: 1 },
    before: { stage: 'running', attention: null, reason: 'deciding the next step' },
    after: {
      stage: 'attention',
      attention: 'open-question',
      reason: '1 open question',
      isRunning: true,
    },
  },
  {
    name: 'running with an agent error',
    params: { ...base, session: errored, pr: livePr(), hasRunningAgent: true },
    before: { stage: 'attention', attention: 'agent-error', reason: 'agent errored' },
    after: {
      stage: 'attention',
      attention: 'agent-error',
      reason: 'agent errored',
      isRunning: false,
    },
  },
  {
    name: 'running with comments the fix could not fix',
    params: { ...base, pr: livePr(), hasRunningAgent: true, fixCouldntFixCount: 1 },
    before: { stage: 'running', attention: null, reason: 'agent running' },
    after: { stage: 'running', attention: null, reason: 'agent running', isRunning: true },
  },
  {
    name: 'running with an unread reply',
    params: { ...base, pr: livePr(), hasRunningAgent: true, hasUnread: true },
    before: { stage: 'running', attention: null, reason: 'agent running' },
    after: { stage: 'running', attention: null, reason: 'agent running', isRunning: true },
  },
  {
    name: 'running with changes requested',
    params: {
      ...base,
      pr: livePr({ reviewDecision: 'changes_requested' }),
      hasRunningAgent: true,
    },
    before: { stage: 'running', attention: null, reason: 'agent running' },
    after: { stage: 'running', attention: null, reason: 'agent running', isRunning: true },
  },
];

const CHANGED_ROWS: ReadonlyArray<string> = [
  'failing checks alone',
  'running with an open question',
  'running with a comment that needs you',
  'approved with failing checks',
  'a pull request with checks running',
  'a deciding workflow with an open question',
];

describe('deriveSessionStage matrix', () => {
  it.each(ROWS.map((row) => [row.name, row] as const))('places %s', (_name, row) => {
    const info = deriveSessionStage(row.params);

    expect({
      stage: info.stage,
      attention: info.attention,
      reason: info.reason,
      isRunning: info.isRunning,
    }).toEqual(row.after);
  });

  it('changes only the rows the round meant to change, against the recorded situations', () => {
    const changed = ROWS.filter(
      (row) =>
        row.before !== null &&
        (row.before.stage !== row.after.stage ||
          row.before.attention !== row.after.attention ||
          row.before.reason !== row.after.reason),
    ).map((row) => row.name);

    expect(changed.sort()).toEqual([...CHANGED_ROWS].sort());
  });

  it('turns a running session with a human-input reason into needs you, still running', () => {
    const turned = ROWS.filter(
      (row) =>
        row.before?.stage === 'running' && row.after.stage === 'attention' && row.after.isRunning,
    ).map((row) => row.after.attention);

    expect(turned.sort()).toEqual(['fix-needs-you', 'open-question', 'open-question']);
  });

  it('says checks, never CI, in every reason', () => {
    const reasons = ROWS.map((row) => deriveSessionStage(row.params).reason);

    expect(reasons.filter((reason) => /\bCI\b/.test(reason))).toEqual([]);
  });
});

const PRIORITY: ReadonlyArray<SessionAttentionReason> = [
  'needs-approval',
  'agent-error',
  'plan-approval',
  'open-question',
  'fix-needs-you',
  'ci-failed',
  'changes-requested',
  'fix-couldnt-fix',
  'pr-approved',
  'unread-reply',
];

const HUMAN_INPUT: ReadonlyArray<SessionAttentionReason> = [
  'needs-approval',
  'plan-approval',
  'open-question',
  'fix-needs-you',
];

const paramsHolding = ({
  reasons,
  isRunning,
}: {
  readonly reasons: ReadonlyArray<SessionAttentionReason>;
  readonly isRunning: boolean;
}): Params => {
  const holds = (reason: SessionAttentionReason) => reasons.includes(reason);
  const pr = livePr({
    ...(holds('ci-failed') && { checks: 'failure' as const }),
    ...(holds('changes-requested') && { reviewDecision: 'changes_requested' as const }),
    ...(holds('pr-approved') && {
      state: 'approved' as const,
      reviewDecision: 'approved' as const,
    }),
  });
  return {
    session: holds('agent-error') ? errored : idle,
    pr,
    hasUnread: holds('unread-reply'),
    openQuestionCount: holds('open-question') ? 1 : 0,
    fixNeedsYouCount: holds('fix-needs-you') ? 1 : 0,
    fixCouldntFixCount: holds('fix-couldnt-fix') ? 1 : 0,
    hasBlockedAgent: holds('needs-approval'),
    hasPlanWaiting: holds('plan-approval'),
    hasRunningAgent: isRunning,
  };
};

const PAIRS = PRIORITY.flatMap((first, index) =>
  PRIORITY.slice(index + 1).flatMap((second) =>
    first === 'changes-requested' && second === 'pr-approved' ? [] : [[first, second] as const],
  ),
);

describe('deriveSessionStage pairs of reasons', () => {
  it.each(PAIRS)('ranks %s above %s and keeps the other as a fact', (first, second) => {
    const info = deriveSessionStage(paramsHolding({ reasons: [second, first], isRunning: false }));

    expect(info.stage).toBe('attention');
    expect(info.attention).toBe(first);
    expect(info.otherReasons).toEqual([second]);
    expect(info.isRunning).toBe(false);
  });

  it.each(PAIRS)('with an agent running, %s then %s', (first, second) => {
    const info = deriveSessionStage(paramsHolding({ reasons: [second, first], isRunning: true }));
    const isHeld = first === 'agent-error' || HUMAN_INPUT.includes(first);

    if (!isHeld) {
      expect(info).toMatchObject({
        stage: 'running',
        attention: null,
        isRunning: true,
        otherReasons: [first, second],
      });
      return;
    }
    expect(info).toMatchObject({
      stage: 'attention',
      attention: first,
      isRunning: first !== 'agent-error',
      otherReasons: [second],
    });
  });

  it.each(PRIORITY)('with an agent running, %s alone', (reason) => {
    const info = deriveSessionStage(paramsHolding({ reasons: [reason], isRunning: true }));

    if (reason === 'agent-error' || HUMAN_INPUT.includes(reason)) {
      expect(info).toMatchObject({
        stage: 'attention',
        attention: reason,
        isRunning: reason !== 'agent-error',
        otherReasons: [],
      });
      return;
    }
    expect(info).toMatchObject({
      stage: 'running',
      attention: null,
      isRunning: true,
      otherReasons: [reason],
    });
  });
});

describe('deriveSessionStage counts', () => {
  it('records the counts the words need', () => {
    const info = deriveSessionStage({
      ...base,
      pr: livePr(),
      openQuestionCount: 3,
      fixNeedsYouCount: 2,
      fixCouldntFixCount: 4,
    });

    expect(info).toMatchObject({
      openQuestionCount: 3,
      fixNeedsYouCount: 2,
      fixCouldntFixCount: 4,
    });
  });
});
