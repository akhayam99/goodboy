// @vitest-environment node

import { describe, expect, it } from 'vitest';
import {
  brandId,
  type ProviderRunId,
  type SessionAttentionReason,
  type SessionId,
  type TurnState,
} from '@goodboy/types';
import { aSession, anAgent, TEST_NOW } from '@goodboy/types/testing';
import {
  attentionFactsOf,
  isHumanInputReason,
  type AttentionFactsParams,
  type StagePullRequest,
} from '../../store/slices/session-view/attentionFactsOf';
import { deriveSessionStage } from '../../store/slices/session-view/deriveSessionStage';
import { liveWorkOfSession } from '../../store/runtime/live-work/selectLiveWork';
import { agentStateOf, NEEDS_PERMISSION_WORD } from '../workTreeModel/agentStateOf';
import { attentionPlace } from './attentionPlace';
import { ATTENTION_REASON_META, attentionWordsOf } from './session-stage';

const SESSION_ID = brandId<SessionId>({ value: 'session-registry' });
const SESSION = aSession({ id: SESSION_ID });
const ERRORED = aSession({
  id: SESSION_ID,
  state: { kind: 'error', message: 'provider gave up', failedAt: SESSION.createdAt },
});

const livePr = (over: Partial<StagePullRequest> = {}): StagePullRequest => ({
  number: 318,
  state: 'open',
  isDraft: false,
  checks: 'success',
  reviewDecision: null,
  ...over,
});

const BASE = { session: SESSION, pr: null, hasUnread: false, openQuestionCount: 0 } as const;

const HOLDING: Record<SessionAttentionReason, AttentionFactsParams> = {
  'needs-approval': { ...BASE, hasBlockedAgent: true },
  'agent-error': { ...BASE, session: ERRORED },
  'push-failed': { ...BASE, pr: livePr(), pushFailedCount: 1 },
  'plan-approval': { ...BASE, hasPlanWaiting: true },
  'open-question': { ...BASE, openQuestionCount: 1 },
  'fix-needs-you': { ...BASE, pr: livePr(), fixNeedsYouCount: 1 },
  'ci-failed': { ...BASE, pr: livePr({ checks: 'failure' }) },
  'changes-requested': { ...BASE, pr: livePr({ reviewDecision: 'changes_requested' }) },
  'fix-couldnt-fix': { ...BASE, pr: livePr(), fixCouldntFixCount: 1 },
  'pr-queued': { ...BASE, pr: livePr({ state: 'queued', reviewDecision: 'approved' }) },
  'pr-approved': { ...BASE, pr: livePr({ state: 'approved', reviewDecision: 'approved' }) },
  'unread-reply': { ...BASE, hasUnread: true },
  'run-stopped': { ...BASE, hasStoppedRun: true },
  'run-paused-at-limit': { ...BASE, hasLimitPausedRun: true },
  'run-waits-for-go': { ...BASE, hasRunWaitingForGo: true },
  'auto-needs-you': { ...BASE, hasAutoNeedsYou: true },
  'slack-reply-waiting': { ...BASE, hasSlackReplyWaiting: true },
};

const isReason = (value: string): value is SessionAttentionReason =>
  Object.hasOwn(ATTENTION_REASON_META, value);

const REASONS = Object.keys(ATTENTION_REASON_META).filter(isReason);

const MARKS: ReadonlySet<string> = new Set(['!', '?', 'approval', 'queue', 'approved', 'none']);

const TONES: ReadonlySet<string> = new Set(['danger', 'warning', 'info', 'success', 'primary']);

const STATE = {
  sessions: [SESSION],
  sessionPhaseRuns: { [SESSION_ID]: [] },
  agentTurnState: {},
};

describe('the attention registry, one table for every reason', () => {
  it('knows how to hold every reason the type names', () => {
    expect(Object.keys(HOLDING).sort()).toEqual([...REASONS].sort());
  });

  it.each(REASONS)('holds %s alone from its own fact', (reason) => {
    expect(attentionFactsOf(HOLDING[reason])).toEqual([reason]);
  });

  it.each(REASONS)('gives %s a mark and a tone that the surfaces can draw', (reason) => {
    const meta = ATTENTION_REASON_META[reason];

    expect(MARKS.has(meta.mark), reason).toBe(true);
    expect(TONES.has(meta.tone), reason).toBe(true);
  });

  it.each(REASONS)('gives %s a sentence of its own', (reason) => {
    const words = attentionWordsOf({ reason });

    expect(words.length, reason).toBeGreaterThan(0);
    expect(REASONS.filter((other) => attentionWordsOf({ reason: other }) === words)).toEqual([
      reason,
    ]);
  });

  it.each(REASONS)('sends %s to a place', (reason) => {
    expect(attentionPlace({ state: STATE, sessionId: SESSION_ID, reason })).toMatchObject({
      sessionId: SESSION_ID,
    });
  });

  it.each(REASONS)('lets the stage explain %s in words', (reason) => {
    const info = deriveSessionStage(HOLDING[reason]);

    expect(info.attention).toBe(reason);
    expect(info.reason.length, reason).toBeGreaterThan(0);
    expect(info.stage).toBe(reason === 'pr-queued' ? 'review' : 'attention');
  });

  it('lists all of them, each once, when every fact holds', () => {
    const facts = attentionFactsOf({
      ...HOLDING['agent-error'],
      pr: livePr({ checks: 'failure', reviewDecision: 'changes_requested' }),
      hasUnread: true,
      openQuestionCount: 1,
      fixNeedsYouCount: 1,
      fixCouldntFixCount: 1,
      pushFailedCount: 1,
      hasBlockedAgent: true,
      hasPlanWaiting: true,
      hasStoppedRun: true,
      hasLimitPausedRun: true,
      hasRunWaitingForGo: true,
      hasAutoNeedsYou: true,
      hasSlackReplyWaiting: true,
    });

    expect(
      facts.filter((reason) => reason !== 'pr-queued' && reason !== 'pr-approved').sort(),
    ).toEqual(
      REASONS.filter((reason) => reason !== 'pr-queued' && reason !== 'pr-approved').sort(),
    );
  });

  it('ranks a stopped run just below an agent error and the waits next to a question', () => {
    const facts = attentionFactsOf({
      ...HOLDING['agent-error'],
      pr: livePr({ checks: 'failure' }),
      openQuestionCount: 1,
      hasStoppedRun: true,
      hasRunWaitingForGo: true,
      hasAutoNeedsYou: true,
      hasSlackReplyWaiting: true,
      hasLimitPausedRun: true,
    });

    expect(facts.slice(0, 2)).toEqual(['agent-error', 'run-stopped']);
    expect(facts.indexOf('open-question')).toBeLessThan(facts.indexOf('run-waits-for-go'));
    expect(facts.indexOf('slack-reply-waiting')).toBeLessThan(facts.indexOf('ci-failed'));
  });

  it('treats a run that waits for you like a question, so a live agent does not hide it', () => {
    for (const reason of [
      'run-waits-for-go',
      'auto-needs-you',
      'slack-reply-waiting',
      'run-paused-at-limit',
    ] satisfies ReadonlyArray<SessionAttentionReason>) {
      expect(isHumanInputReason({ reason }), reason).toBe(true);
      expect(
        deriveSessionStage({ ...HOLDING[reason], hasRunningAgent: true }),
        reason,
      ).toMatchObject({ stage: 'attention', attention: reason, isRunning: true });
    }
  });

  it('keeps a stopped run in needs you without a spinner, like an agent error', () => {
    expect(isHumanInputReason({ reason: 'run-stopped' })).toBe(false);
    expect(deriveSessionStage({ ...HOLDING['run-stopped'], hasRunningAgent: true })).toMatchObject({
      stage: 'attention',
      attention: 'run-stopped',
      isRunning: false,
    });
  });

  it.each([
    { kind: 'idle', lastActivityAt: TEST_NOW },
    { kind: 'starting', startedAt: TEST_NOW },
    { kind: 'running', runId: brandId<ProviderRunId>({ value: 'run-1' }), startedAt: TEST_NOW },
    { kind: 'blocked', runId: brandId<ProviderRunId>({ value: 'run-1' }), blockedAt: TEST_NOW },
  ] satisfies ReadonlyArray<TurnState>)(
    'holds needs-approval exactly when the agent isReadingNeedsPermission Needs permission, turn $kind',
    (turn) => {
      const agent = anAgent({ sessionId: SESSION_ID, status: 'running' });
      const live = liveWorkOfSession({
        state: {
          sessionPhaseRuns: { [SESSION_ID]: [agent] },
          agentTurnState: { [agent.id]: turn },
          orchestratingWorkflowRuns: {},
        },
        session: SESSION,
      });
      const facts = attentionFactsOf({ ...BASE, hasBlockedAgent: live.isBlocked });
      const isReadingNeedsPermission =
        agentStateOf({ agent, turn, openQuestions: [] }).word === NEEDS_PERMISSION_WORD;

      expect(facts.includes('needs-approval')).toBe(isReadingNeedsPermission);
      expect(isReadingNeedsPermission).toBe(turn.kind === 'blocked');
    },
  );
});
