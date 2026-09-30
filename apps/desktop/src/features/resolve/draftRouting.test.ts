import { describe, expect, it } from 'vitest';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore, type AppStore } from '../../store/store';
import type { AgentKindRouting } from '../session/agent-kind';
import { draftRoutingOf } from './draftRouting';

const SESSION_ID = 'session-1' as SessionId;

const PICKED: AgentKindRouting = { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' };

const attemptOf = (): ResolveAttempt => ({
  id: 'attempt-1',
  sessionId: SESSION_ID,
  agentId: 'agent-attempt-1' as AgentId,
  prNumber: 318,
  threadIds: ['PRRT_1'],
  provider: 'codex',
  model: 'gpt-5.5',
  effort: 'medium',
  instructions: null,
  phase: 'failed',
  mountTarget: null,
  startedAt: null,
  endedAt: null,
  error: null,
  createdAt: 1,
  batchId: 'batch-1',
  copyPath: null,
  launchChoice: {
    provider: 'codex',
    model: 'gpt-5.5',
    effort: 'medium',
    commitStyle: null,
    hint: null,
  },
});

const stateOf = ({
  lastRouting,
  attempts = [],
}: {
  readonly lastRouting: AgentKindRouting;
  readonly attempts?: ReadonlyArray<ResolveAttempt>;
}): AppStore => {
  const base = useAppStore.getState();
  return {
    ...base,
    resolveQueueView: {
      [SESSION_ID]: {
        order: [],
        scrollTop: 0,
        detailScrollTop: 0,
        isDeferredShown: false,
        isCompletedShown: false,
        lastRouting,
      },
    },
    sessionResolveAttempts: { [SESSION_ID]: attempts },
  };
};

describe('draftRoutingOf', () => {
  it('reads the model picked for the session before the role default', () => {
    expect(draftRoutingOf({ state: stateOf({ lastRouting: PICKED }), sessionId: SESSION_ID })).toBe(
      PICKED,
    );
  });

  it('prefers the launch choice of the comment latest attempt over the session pick', () => {
    const attempts = [attemptOf()];
    const state = stateOf({ lastRouting: PICKED, attempts });
    expect(draftRoutingOf({ state, sessionId: SESSION_ID, threadId: 'PRRT_1' })).toEqual({
      provider: 'codex',
      model: 'gpt-5.5',
      effort: 'medium',
    });
    expect(draftRoutingOf({ state, sessionId: SESSION_ID, threadId: 'PRRT_2' })).toBe(PICKED);
  });
});
