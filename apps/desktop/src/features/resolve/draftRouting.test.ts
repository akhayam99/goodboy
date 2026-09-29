import { describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { draftRoutingOf } from './draftRouting';

const SESSION_ID = 'session-1' as SessionId;

const stateOf = ({
  lastRouting,
  attempts = [],
}: {
  readonly lastRouting: unknown;
  readonly attempts?: ReadonlyArray<unknown>;
}): AppStore =>
  ({
    resolveQueueView: { [SESSION_ID]: { lastRouting } },
    sessionResolveAttempts: { [SESSION_ID]: attempts },
    sessionGithub: {},
    sessions: [],
    projects: [],
    workspaceOverrides: {},
    sessionActiveProject: {},
    spawnAgent: vi.fn(),
    setAgentConfig: vi.fn(),
  }) as unknown as AppStore;

describe('draftRoutingOf', () => {
  it('reads the model picked for the session before the role default', () => {
    const picked = { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' };
    expect(draftRoutingOf({ state: stateOf({ lastRouting: picked }), sessionId: SESSION_ID })).toBe(
      picked,
    );
  });

  it('prefers the launch choice of the comment latest attempt over the session pick', () => {
    const picked = { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' };
    const attempts = [
      {
        threadIds: ['PRRT_1'],
        batchId: 'batch-1',
        launchChoice: {
          provider: 'codex',
          model: 'gpt-5.5',
          effort: 'medium',
          commitStyle: null,
          hint: null,
        },
      },
    ];
    const state = stateOf({ lastRouting: picked, attempts });
    expect(draftRoutingOf({ state, sessionId: SESSION_ID, threadId: 'PRRT_1' })).toEqual({
      provider: 'codex',
      model: 'gpt-5.5',
      effort: 'medium',
    });
    expect(draftRoutingOf({ state, sessionId: SESSION_ID, threadId: 'PRRT_2' })).toBe(picked);
  });
});
