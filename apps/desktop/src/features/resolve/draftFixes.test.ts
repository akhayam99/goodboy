import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { draftFixes, draftRoutingOf } from './draftFixes';

const { startBatch } = vi.hoisted(() => ({
  startBatch: vi.fn(async () => ({ batchId: 'batch-1', agentIds: [] as ReadonlyArray<AgentId> })),
}));

vi.mock('./startBatch', () => ({ startBatch }));

const SESSION_ID = 'session-1' as SessionId;

const stateOf = ({ lastRouting }: { readonly lastRouting: unknown }): AppStore =>
  ({
    resolveQueueView: { [SESSION_ID]: { lastRouting } },
    sessionGithub: {},
    sessions: [],
    projects: [],
    workspaceOverrides: {},
    sessionActiveProject: {},
    spawnAgent: vi.fn(),
    setAgentConfig: vi.fn(),
  }) as unknown as AppStore;

beforeEach(() => {
  startBatch.mockClear();
});

describe('draftFixes', () => {
  it('hands the hint to the batch launch choice so it lands in the operator notes', async () => {
    const state = stateOf({ lastRouting: null });
    await draftFixes({
      getState: () => state,
      sessionId: SESSION_ID,
      threadIds: ['PRRT_1'],
      note: 'Use ON CONFLICT',
    });

    expect(startBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        launchChoice: expect.objectContaining({ hint: 'Use ON CONFLICT' }),
      }),
    );
  });

  it('sends no hint when none is typed', async () => {
    const state = stateOf({ lastRouting: null });
    await draftFixes({ getState: () => state, sessionId: SESSION_ID, threadIds: ['PRRT_1'] });

    expect(startBatch).toHaveBeenCalledWith(
      expect.objectContaining({ launchChoice: expect.objectContaining({ hint: null }) }),
    );
  });
});

describe('draftRoutingOf', () => {
  it('reads the model picked for the session before the role default', () => {
    const picked = { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' };
    expect(draftRoutingOf({ state: stateOf({ lastRouting: picked }), sessionId: SESSION_ID })).toBe(
      picked,
    );
  });
});
