import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import type { CommentThread } from '../github/comment-threads';
import { draftFixes, draftRoutingOf } from './draftFixes';

const { startResolve, reviewRowsOf } = vi.hoisted(() => ({
  startResolve: vi.fn(async () => [] as ReadonlyArray<AgentId>),
  reviewRowsOf: vi.fn(),
}));

vi.mock('./startResolve', () => ({ startResolve }));
vi.mock('./reviewRows', () => ({ reviewRowsOf }));

const SESSION_ID = 'session-1' as SessionId;

const commentThread = { head: { threadId: 'PRRT_1' }, replies: [] } as unknown as CommentThread;

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
  startResolve.mockClear();
  reviewRowsOf.mockReset();
  reviewRowsOf.mockReturnValue([{ thread: { threadId: 'PRRT_1' }, commentThread }]);
});

describe('draftFixes', () => {
  it('hands the hint to startResolve so it lands in the operator notes', async () => {
    const state = stateOf({ lastRouting: null });
    await draftFixes({
      getState: () => state,
      sessionId: SESSION_ID,
      threadIds: ['PRRT_1'],
      note: 'Use ON CONFLICT',
    });

    expect(startResolve).toHaveBeenCalledWith(expect.objectContaining({ note: 'Use ON CONFLICT' }));
  });

  it('sends an empty note when no hint is typed', async () => {
    const state = stateOf({ lastRouting: null });
    await draftFixes({ getState: () => state, sessionId: SESSION_ID, threadIds: ['PRRT_1'] });

    expect(startResolve).toHaveBeenCalledWith(expect.objectContaining({ note: '' }));
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
