// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Session, SessionAttentionReason, SessionId, WorkspaceId } from '@goodboy/types';
import type { StagePullRequest } from './attentionFactsOf';
import { ATTENTION_REASON_META } from '../../../features/session/session-stage';
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

const queuedPr = livePr({ state: 'queued', reviewDecision: 'approved' });

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
      reason: '2 comments failed',
    },
    after: {
      stage: 'attention',
      attention: 'fix-couldnt-fix',
      reason: '2 comments failed',
      isRunning: false,
    },
  },
  {
    name: 'an unread reply alone',
    params: { ...base, pr: livePr(), hasUnread: true },
    before: { stage: 'attention', attention: 'unread-reply', reason: 'Unread reply' },
    after: {
      stage: 'attention',
      attention: 'unread-reply',
      reason: 'Unread reply',
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
    name: 'a queued pull request alone',
    params: { ...base, pr: queuedPr },
    before: null,
    after: {
      stage: 'review',
      attention: 'pr-queued',
      reason: 'PR #318 in the merge queue',
      isRunning: false,
    },
  },
  {
    name: 'running with a queued pull request',
    params: { ...base, pr: queuedPr, hasRunningAgent: true },
    before: null,
    after: { stage: 'running', attention: null, reason: 'agent running', isRunning: true },
  },
  {
    name: 'a queued pull request with an open question',
    params: { ...base, pr: queuedPr, openQuestionCount: 1 },
    before: null,
    after: {
      stage: 'attention',
      attention: 'open-question',
      reason: '1 open question',
      isRunning: false,
    },
  },
  {
    name: 'a queued pull request with failing checks',
    params: { ...base, pr: livePr({ ...queuedPr, checks: 'failure' }) },
    before: null,
    after: {
      stage: 'attention',
      attention: 'ci-failed',
      reason: 'PR #318: checks failing',
      isRunning: false,
    },
  },
  {
    name: 'a tool waiting for approval',
    params: { ...base, pr: livePr(), hasBlockedAgent: true },
    before: { stage: 'attention', attention: 'needs-approval', reason: 'Needs permission' },
    after: {
      stage: 'attention',
      attention: 'needs-approval',
      reason: 'Needs permission',
      isRunning: false,
    },
  },
  {
    name: 'an agent error',
    params: { ...base, session: errored, pr: livePr() },
    before: { stage: 'attention', attention: 'agent-error', reason: 'An agent failed' },
    after: {
      stage: 'attention',
      attention: 'agent-error',
      reason: 'An agent failed',
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
    before: { stage: 'attention', attention: 'agent-error', reason: 'An agent failed' },
    after: {
      stage: 'attention',
      attention: 'agent-error',
      reason: 'An agent failed',
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
      reason: 'Needs approval',
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
      reason: 'Needs approval',
      isRunning: true,
    },
  },
  {
    name: 'running with a tool waiting for approval',
    params: { ...base, pr: livePr(), hasRunningAgent: true, hasBlockedAgent: true },
    before: { stage: 'attention', attention: 'needs-approval', reason: 'Needs permission' },
    after: {
      stage: 'attention',
      attention: 'needs-approval',
      reason: 'Needs permission',
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
    before: { stage: 'attention', attention: 'agent-error', reason: 'An agent failed' },
    after: {
      stage: 'attention',
      attention: 'agent-error',
      reason: 'An agent failed',
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
  {
    name: 'a Scout answer with no mount',
    params: { ...base, isBranchless: true, settledOutcome: 'answered' },
    before: null,
    after: {
      stage: 'done',
      attention: null,
      reason: 'answered',
      isRunning: false,
    },
  },
  {
    name: 'a report with no mount',
    params: { ...base, isBranchless: true, settledOutcome: 'report-ready' },
    before: null,
    after: {
      stage: 'done',
      attention: null,
      reason: 'report ready',
      isRunning: false,
    },
  },
  {
    name: 'a plan with no mount',
    params: { ...base, isBranchless: true, settledOutcome: 'plan-ready' },
    before: null,
    after: {
      stage: 'done',
      attention: null,
      reason: 'plan ready',
      isRunning: false,
    },
  },
  {
    name: 'a Documents folder edit that finished',
    params: { ...base, isBranchless: true, settledOutcome: 'finished' },
    before: null,
    after: {
      stage: 'done',
      attention: null,
      reason: 'finished',
      isRunning: false,
    },
  },
  {
    name: 'a read-only answer on a mounted project with no pull request',
    params: { ...base, settledOutcome: 'answered' },
    before: null,
    after: {
      stage: 'done',
      attention: null,
      reason: 'answered',
      isRunning: false,
    },
  },
  {
    name: 'the same answer while the host has not answered',
    params: { ...base, settledOutcome: 'answered', prFetchState: 'unknown' },
    before: null,
    after: {
      stage: 'building',
      attention: null,
      reason: 'checking GitHub',
      isRunning: false,
    },
  },
  {
    name: 'a GitLab mount with no merge request while GitLab has not answered',
    params: { ...base, settledOutcome: 'answered', prFetchState: 'unknown', requestHost: 'gitlab' },
    before: null,
    after: {
      stage: 'building',
      attention: null,
      reason: 'checking GitLab',
      isRunning: false,
    },
  },
  {
    name: 'a GitLab mount with no merge request while GitLab is unreachable',
    params: { ...base, prFetchState: 'unreachable', requestHost: 'gitlab' },
    before: null,
    after: {
      stage: 'building',
      attention: null,
      reason: 'GitLab unreachable',
      isRunning: false,
    },
  },
  {
    name: 'a GitLab mount with no merge request once GitLab answered',
    params: { ...base, prFetchState: 'known', requestHost: 'gitlab' },
    before: null,
    after: {
      stage: 'building',
      attention: null,
      reason: 'no MR yet',
      isRunning: false,
    },
  },
  {
    name: 'a Bitbucket mount with no pull request while Bitbucket is unreachable',
    params: { ...base, prFetchState: 'unreachable', requestHost: 'bitbucket' },
    before: null,
    after: {
      stage: 'building',
      attention: null,
      reason: 'Bitbucket unreachable',
      isRunning: false,
    },
  },
  {
    name: 'an answer with an unread reply',
    params: { ...base, hasUnread: true, isBranchless: true, settledOutcome: 'answered' },
    before: null,
    after: {
      stage: 'attention',
      attention: 'unread-reply',
      reason: 'Unread reply',
      isRunning: false,
    },
  },
  {
    name: 'an answer with an open question',
    params: { ...base, openQuestionCount: 1, isBranchless: true, settledOutcome: 'answered' },
    before: null,
    after: {
      stage: 'attention',
      attention: 'open-question',
      reason: '1 open question',
      isRunning: false,
    },
  },
  {
    name: 'an answer when the person writes again',
    params: { ...base, hasRunningAgent: true, isBranchless: true, settledOutcome: 'answered' },
    before: null,
    after: {
      stage: 'running',
      attention: null,
      reason: 'agent running',
      isRunning: true,
    },
  },
  {
    name: 'an answer next to an open pull request',
    params: { ...base, pr: livePr(), settledOutcome: 'answered' },
    before: null,
    after: {
      stage: 'review',
      attention: null,
      reason: 'PR #318 awaiting review',
      isRunning: false,
    },
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
  'pr-queued',
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
    ...(holds('pr-queued') && { state: 'queued' as const }),
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
    (first === 'changes-requested' && second === 'pr-approved') ||
    (first === 'pr-queued' && second === 'pr-approved')
      ? []
      : [[first, second] as const],
  ),
);

describe('deriveSessionStage pairs of reasons', () => {
  it.each(PAIRS)('ranks %s above %s and keeps the other as a fact', (first, second) => {
    const info = deriveSessionStage(paramsHolding({ reasons: [second, first], isRunning: false }));

    expect(info.stage).toBe(first === 'pr-queued' ? 'review' : 'attention');
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

describe('deriveSessionStage on a settled branch, one case per reason', () => {
  const SETTLED_AT = 2_000;
  const BEFORE = 1_000;
  const AFTER = 3_000;

  type SettleOver = Partial<NonNullable<Params['settle']>>;

  const settleOf = (over: SettleOver = {}): NonNullable<Params['settle']> => ({
    isSettled: true,
    settledAt: SETTLED_AT,
    isRunLive: false,
    unreadAt: BEFORE,
    stoppedRunAt: BEFORE,
    ...over,
  });

  type SettleRow = {
    readonly reason: SessionAttentionReason;
    readonly params: Partial<Params>;
    readonly isDroppedAtRest: boolean;
    readonly isDroppedWhileLive: boolean;
  };

  const mergedPr = livePr({ state: 'merged' });
  const openPr = livePr({ state: 'open' });

  const SETTLE_ROWS: ReadonlyArray<SettleRow> = [
    {
      reason: 'needs-approval',
      params: { hasBlockedAgent: true },
      isDroppedAtRest: true,
      isDroppedWhileLive: false,
    },
    {
      reason: 'agent-error',
      params: { session: errored, isFailureEnded: true },
      isDroppedAtRest: true,
      isDroppedWhileLive: true,
    },
    {
      reason: 'run-stopped',
      params: { hasStoppedRun: true },
      isDroppedAtRest: true,
      isDroppedWhileLive: true,
    },
    {
      reason: 'push-failed',
      params: { pushFailedCount: 1 },
      isDroppedAtRest: false,
      isDroppedWhileLive: false,
    },
    {
      reason: 'plan-approval',
      params: { hasPlanWaiting: true },
      isDroppedAtRest: true,
      isDroppedWhileLive: false,
    },
    {
      reason: 'open-question',
      params: { openQuestionCount: 1 },
      isDroppedAtRest: false,
      isDroppedWhileLive: false,
    },
    {
      reason: 'run-waits-for-go',
      params: { hasRunWaitingForGo: true },
      isDroppedAtRest: true,
      isDroppedWhileLive: false,
    },
    {
      reason: 'auto-needs-you',
      params: { hasAutoNeedsYou: true },
      isDroppedAtRest: true,
      isDroppedWhileLive: false,
    },
    {
      reason: 'slack-reply-waiting',
      params: { hasSlackReplyWaiting: true },
      isDroppedAtRest: false,
      isDroppedWhileLive: false,
    },
    {
      reason: 'fix-needs-you',
      params: { fixNeedsYouCount: 1 },
      isDroppedAtRest: false,
      isDroppedWhileLive: false,
    },
    {
      reason: 'run-paused-at-limit',
      params: { hasLimitPausedRun: true },
      isDroppedAtRest: true,
      isDroppedWhileLive: false,
    },
    {
      reason: 'ci-failed',
      params: { pr: livePr({ state: 'open', checks: 'failure' }) },
      isDroppedAtRest: true,
      isDroppedWhileLive: true,
    },
    {
      reason: 'changes-requested',
      params: { pr: livePr({ state: 'open', reviewDecision: 'changes_requested' }) },
      isDroppedAtRest: true,
      isDroppedWhileLive: true,
    },
    {
      reason: 'fix-couldnt-fix',
      params: { fixCouldntFixCount: 1 },
      isDroppedAtRest: false,
      isDroppedWhileLive: false,
    },
    {
      reason: 'pr-queued',
      params: { pr: livePr({ state: 'queued', reviewDecision: 'approved' }) },
      isDroppedAtRest: true,
      isDroppedWhileLive: true,
    },
    {
      reason: 'pr-approved',
      params: { pr: livePr({ state: 'approved', reviewDecision: 'approved' }) },
      isDroppedAtRest: true,
      isDroppedWhileLive: true,
    },
    {
      reason: 'unread-reply',
      params: { hasUnread: true },
      isDroppedAtRest: true,
      isDroppedWhileLive: true,
    },
  ];

  const holdsOf = (params: Params): ReadonlyArray<SessionAttentionReason> => {
    const info = deriveSessionStage(params);
    return [...(info.attention === null ? [] : [info.attention]), ...(info.otherReasons ?? [])];
  };

  const settledParams = ({ row, settle }: { row: SettleRow; settle: SettleOver }): Params => ({
    ...base,
    ...row.params,
    pr: PR_REASONS.includes(row.reason) ? mergedPr : (row.params.pr ?? mergedPr),
    settle: settleOf(settle),
  });

  const PR_REASONS: ReadonlyArray<SessionAttentionReason> = [
    'ci-failed',
    'changes-requested',
    'pr-queued',
    'pr-approved',
  ];

  it('lists every reason once', () => {
    expect(SETTLE_ROWS.map((row) => row.reason).sort()).toEqual(
      Object.keys(ATTENTION_REASON_META).sort(),
    );
  });

  it.each(SETTLE_ROWS)('$reason: holds as the table says on a merged branch', (row) => {
    const holds = holdsOf(settledParams({ row, settle: {} }));

    expect(holds.includes(row.reason)).toBe(!row.isDroppedAtRest);
  });

  it.each(SETTLE_ROWS)('$reason: holds as the table says while a run is live', (row) => {
    const holds = holdsOf(settledParams({ row, settle: { isRunLive: true } }));

    expect(holds.includes(row.reason)).toBe(!row.isDroppedWhileLive);
  });

  it.each(SETTLE_ROWS)('$reason: comes back when the request is reopened', (row) => {
    const reopened: Params = {
      ...base,
      ...row.params,
      pr: row.params.pr ?? openPr,
      isFailureEnded: false,
      settle: settleOf({ isSettled: false, settledAt: null }),
    };

    expect(holdsOf(reopened)).toContain(row.reason);
  });

  it.each(['unread-reply', 'run-stopped'] as const)(
    '%s: stays when it happened after the merge or its time is unknown',
    (reason) => {
      const row = SETTLE_ROWS.find((candidate) => candidate.reason === reason);
      if (row === undefined) {
        throw new Error('missing row');
      }
      const field = reason === 'unread-reply' ? 'unreadAt' : 'stoppedRunAt';

      expect(holdsOf(settledParams({ row, settle: { [field]: AFTER } }))).toContain(reason);
      expect(holdsOf(settledParams({ row, settle: { [field]: null } }))).toContain(reason);
    },
  );

  it('a merged branch with nothing left reads as done', () => {
    const info = deriveSessionStage({
      ...base,
      pr: mergedPr,
      settle: settleOf(),
    });

    expect(info).toMatchObject({ stage: 'done', attention: null });
  });
});
