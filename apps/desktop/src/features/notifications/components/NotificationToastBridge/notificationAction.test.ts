import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationAction } from '@goodboy/db';
import type { AgentId, SessionId } from '@goodboy/types';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

import { mapNotificationAction } from './';

const retrySummarizerSpy = vi.fn();
const retryStepSummarySpy = vi.fn(async () => undefined);

type FakeStore = {
  summarizerStatus: Record<
    string,
    { lastAttempt?: { turnInput: string; turnOutput: string } } | undefined
  >;
  retrySummarizer: typeof retrySummarizerSpy;
  retryStepSummary: typeof retryStepSummarySpy;
};

function buildStore(overrides: Partial<FakeStore> = {}): FakeStore {
  return {
    summarizerStatus: {},
    retrySummarizer: retrySummarizerSpy,
    retryStepSummary: retryStepSummarySpy,
    ...overrides,
  };
}

describe('mapNotificationAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retry-summarizer: returns undefined when lastAttempt is missing', () => {
    const action: NotificationAction = { kind: 'retry-summarizer', sessionId: SESSION_ID };
    const store = buildStore({ summarizerStatus: { [SESSION_ID]: undefined } });
    const result = mapNotificationAction(action, store as never);
    expect(result).toBeUndefined();
  });

  it('retry-summarizer: returns action with Retry label when lastAttempt exists', () => {
    const lastAttempt = { turnInput: 'user prompt', turnOutput: 'agent reply' };
    const action: NotificationAction = { kind: 'retry-summarizer', sessionId: SESSION_ID };
    const store = buildStore({ summarizerStatus: { [SESSION_ID]: { lastAttempt } } });
    const toastAction = mapNotificationAction(action, store as never);
    expect(toastAction?.label).toBe('Retry');
  });

  it('retry-summarizer: onClick calls retrySummarizer with sessionId', () => {
    const lastAttempt = { turnInput: 'user prompt', turnOutput: 'agent reply' };
    const action: NotificationAction = { kind: 'retry-summarizer', sessionId: SESSION_ID };
    const store = buildStore({ summarizerStatus: { [SESSION_ID]: { lastAttempt } } });
    const toastAction = mapNotificationAction(action, store as never);
    toastAction?.onClick();
    expect(retrySummarizerSpy).toHaveBeenCalledWith(SESSION_ID);
  });

  it('retry-step-summary: returns action with Retry label', () => {
    const action: NotificationAction = {
      kind: 'retry-step-summary',
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    };
    const store = buildStore();
    const toastAction = mapNotificationAction(action, store as never);
    expect(toastAction?.label).toBe('Retry');
  });

  it('retry-step-summary: onClick calls retryStepSummary with correct params', () => {
    const action: NotificationAction = {
      kind: 'retry-step-summary',
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    };
    const store = buildStore();
    const toastAction = mapNotificationAction(action, store as never);
    toastAction?.onClick();
    expect(retryStepSummarySpy).toHaveBeenCalledWith({ sessionId: SESSION_ID, agentId: AGENT_ID });
  });
});
