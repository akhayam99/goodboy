import { describe, expect, it } from 'vitest';
import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import { useAppStore, type AppStore } from '../../store/store';
import { selectKindRouting } from '../../store/slices/agents/selectKindRouting';
import type { AgentKindRouting } from '../session/agent-kind';
import { draftRoutingOf, pickedRoutingOf } from './draftRouting';

const SESSION_ID = 'session-1' as SessionId;
const OTHER_SESSION_ID = 'session-2' as SessionId;

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
  lastRouting = null,
  pickedIn = SESSION_ID,
  attempts = [],
}: {
  readonly lastRouting?: AgentKindRouting | null;
  readonly pickedIn?: SessionId;
  readonly attempts?: ReadonlyArray<ResolveAttempt>;
}): AppStore => ({
  ...useAppStore.getState(),
  resolveQueueView:
    lastRouting === null
      ? {}
      : {
          [pickedIn]: {
            order: [],
            scrollTop: 0,
            detailScrollTop: 0,
            isDeferredShown: false,
            isCompletedShown: false,
            lastRouting,
          },
        },
  sessionResolveAttempts: { [SESSION_ID]: attempts },
});

describe('draftRoutingOf', () => {
  it('starts on the resolver role default when nothing was picked', () => {
    const state = stateOf({});
    expect(pickedRoutingOf({ state, sessionId: SESSION_ID })).toBeNull();
    expect(draftRoutingOf({ state, sessionId: SESSION_ID })).toEqual(
      selectKindRouting({ state, sessionId: SESSION_ID, kind: 'resolver' }),
    );
  });

  it('holds the model picked for the session before the role default', () => {
    const state = stateOf({ lastRouting: PICKED });
    expect(pickedRoutingOf({ state, sessionId: SESSION_ID })).toBe(PICKED);
    expect(draftRoutingOf({ state, sessionId: SESSION_ID })).toBe(PICKED);
  });

  it('never carries the model of a previous launch into the next one', () => {
    const state = stateOf({ attempts: [attemptOf()] });
    expect(draftRoutingOf({ state, sessionId: SESSION_ID })).toEqual(
      selectKindRouting({ state, sessionId: SESSION_ID, kind: 'resolver' }),
    );
    expect(draftRoutingOf({ state, sessionId: SESSION_ID }).model).not.toBe('gpt-5.5');
  });

  it('keeps a pick inside the session it was made in', () => {
    const state = stateOf({ lastRouting: PICKED, pickedIn: OTHER_SESSION_ID });
    expect(draftRoutingOf({ state, sessionId: SESSION_ID })).toEqual(
      selectKindRouting({ state, sessionId: SESSION_ID, kind: 'resolver' }),
    );
    expect(draftRoutingOf({ state, sessionId: OTHER_SESSION_ID })).toBe(PICKED);
  });
});
