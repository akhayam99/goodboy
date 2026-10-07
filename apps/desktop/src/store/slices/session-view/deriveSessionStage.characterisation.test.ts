// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Session, SessionAttentionReason, SessionId, WorkspaceId } from '@goodboy/types';
import { deriveSessionStage, type StagePullRequest } from './deriveSessionStage';

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

type Situation = {
  readonly name: string;
  readonly params: Parameters<typeof deriveSessionStage>[0];
  readonly stage: string;
  readonly attention: SessionAttentionReason | null;
  readonly reason: string;
};

const base = { session: idle, pr: null, hasUnread: false, openQuestionCount: 0 } as const;

const SITUATIONS: ReadonlyArray<Situation> = [
  {
    name: 'an open question alone',
    params: { ...base, pr: livePr(), openQuestionCount: 1 },
    stage: 'attention',
    attention: 'open-question',
    reason: '1 open question',
  },
  {
    name: 'two open questions alone',
    params: { ...base, pr: livePr(), openQuestionCount: 2 },
    stage: 'attention',
    attention: 'open-question',
    reason: '2 open questions',
  },
  {
    name: 'a comment that needs you alone',
    params: { ...base, pr: livePr(), fixNeedsYouCount: 1 },
    stage: 'attention',
    attention: 'fix-needs-you',
    reason: '1 comment needs you',
  },
  {
    name: 'comments the fix could not fix alone',
    params: { ...base, pr: livePr(), fixCouldntFixCount: 2 },
    stage: 'attention',
    attention: 'fix-couldnt-fix',
    reason: "2 comments couldn't be fixed",
  },
  {
    name: 'an unread reply alone',
    params: { ...base, pr: livePr(), hasUnread: true },
    stage: 'attention',
    attention: 'unread-reply',
    reason: 'unread agent reply',
  },
  {
    name: 'failing checks alone',
    params: { ...base, pr: livePr({ checks: 'failure' }) },
    stage: 'attention',
    attention: 'ci-failed',
    reason: 'PR #318: CI failed',
  },
  {
    name: 'changes requested alone',
    params: { ...base, pr: livePr({ reviewDecision: 'changes_requested' }) },
    stage: 'attention',
    attention: 'changes-requested',
    reason: 'PR #318: changes requested',
  },
  {
    name: 'an approved pull request alone',
    params: { ...base, pr: livePr({ state: 'approved', reviewDecision: 'approved' }) },
    stage: 'attention',
    attention: 'pr-approved',
    reason: 'PR #318 approved, ready to merge',
  },
  {
    name: 'a tool waiting for approval',
    params: { ...base, pr: livePr(), hasBlockedAgent: true },
    stage: 'attention',
    attention: 'needs-approval',
    reason: 'Needs approval',
  },
  {
    name: 'an agent error',
    params: { ...base, session: errored, pr: livePr() },
    stage: 'attention',
    attention: 'agent-error',
    reason: 'agent errored',
  },
  {
    name: 'running alone',
    params: { ...base, pr: livePr(), hasRunningAgent: true },
    stage: 'running',
    attention: null,
    reason: 'agent running',
  },
  {
    name: 'running with an open question',
    params: { ...base, pr: livePr(), hasRunningAgent: true, openQuestionCount: 1 },
    stage: 'running',
    attention: null,
    reason: 'agent running',
  },
  {
    name: 'running with a comment that needs you',
    params: { ...base, pr: livePr(), hasRunningAgent: true, fixNeedsYouCount: 1 },
    stage: 'running',
    attention: null,
    reason: 'agent running',
  },
  {
    name: 'running with failing checks',
    params: { ...base, pr: livePr({ checks: 'failure' }), hasRunningAgent: true },
    stage: 'running',
    attention: null,
    reason: 'agent running',
  },
  {
    name: 'running with an approved pull request',
    params: {
      ...base,
      pr: livePr({ state: 'approved', reviewDecision: 'approved' }),
      hasRunningAgent: true,
    },
    stage: 'running',
    attention: null,
    reason: 'agent running',
  },
  {
    name: 'approved with failing checks',
    params: {
      ...base,
      pr: livePr({ state: 'approved', reviewDecision: 'approved', checks: 'failure' }),
    },
    stage: 'attention',
    attention: 'ci-failed',
    reason: 'PR #318: CI failed',
  },
  {
    name: 'approved with an agent error',
    params: {
      ...base,
      session: errored,
      pr: livePr({ state: 'approved', reviewDecision: 'approved' }),
    },
    stage: 'attention',
    attention: 'agent-error',
    reason: 'agent errored',
  },
  {
    name: 'a merged pull request with nothing left',
    params: { ...base, pr: livePr({ state: 'merged' }) },
    stage: 'done',
    attention: null,
    reason: 'PR #318 merged',
  },
  {
    name: 'a branchless session with a question',
    params: { ...base, isBranchless: true, openQuestionCount: 1 },
    stage: 'attention',
    attention: 'open-question',
    reason: '1 open question',
  },
  {
    name: 'a branchless session that is idle',
    params: { ...base, isBranchless: true },
    stage: 'building',
    attention: null,
    reason: 'ready for work',
  },
  {
    name: 'a pull request with checks running',
    params: { ...base, pr: livePr({ checks: 'pending' }) },
    stage: 'review',
    attention: null,
    reason: 'PR #318: CI running',
  },
];

describe('deriveSessionStage today', () => {
  it('has twenty situations on record', () => {
    expect(SITUATIONS.length).toBeGreaterThanOrEqual(20);
  });

  it.each(SITUATIONS.map((situation) => [situation.name, situation] as const))(
    'places %s',
    (_name, situation) => {
      const info = deriveSessionStage(situation.params);

      expect({ stage: info.stage, attention: info.attention, reason: info.reason }).toEqual({
        stage: situation.stage,
        attention: situation.attention,
        reason: situation.reason,
      });
    },
  );
});
