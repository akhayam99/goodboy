import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import { RECHECK_NO_ANSWER } from '../../../features/resolve/commentVerdict';
import { recheckThread, settleThreadRecheck } from './recheckThread';
import { resolveInitialState } from './state';
import type { ThreadGitFacts } from './threadGitState';
import type { GetFn, SetFn } from './types';

const h = vi.hoisted(() => ({
  execute: vi.fn(async () => undefined),
  select: vi.fn(),
  startRecheck: vi.fn(),
  updateStatus: vi.fn(async () => undefined),
  listAgents: vi.fn(async () => []),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: h }));
vi.mock('../../../features/resolve/startRecheck', () => ({ startRecheck: h.startRecheck }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.listAgents,
  invokeAgentUpdateStatus: h.updateStatus,
}));

const sessionId = 'session' as SessionId;
const agentId = 'agent-1' as AgentId;
const threadId = 'PRRT_1';

const facts = (overrides: Partial<ThreadGitFacts>): ThreadGitFacts => ({
  gitState: 'missing',
  onOrigin: null,
  elsewhere: null,
  missing: { sha: '9f2c1ab', wasPushed: false, isPathGone: false },
  folded: null,
  userReply: null,
  verdict: null,
  ...overrides,
});

type Harness = {
  readonly state: Record<string, unknown>;
  readonly set: SetFn;
  readonly get: GetFn;
  readonly closers: ReadonlyArray<ReturnType<typeof vi.fn>>;
};

const harness = ({ afterRefresh }: { readonly afterRefresh: ThreadGitFacts }): Harness => {
  const closers = [vi.fn(), vi.fn(), vi.fn()];
  const state: Record<string, unknown> = {
    ...resolveInitialState,
    sessionThreadGit: { [sessionId]: { [threadId]: facts({}) } },
    sessionPhaseRuns: {
      [sessionId]: [{ id: agentId, sourceKind: 'comment_recheck', sourceThreadIds: [threadId] }],
    },
    refreshThreadGitState: vi.fn(async () => {
      state.sessionThreadGit = { [sessionId]: { [threadId]: afterRefresh } };
    }),
    replyAndResolveThread: closers[0],
    resolveThreadOnly: closers[1],
    answerItemWithoutFix: closers[2],
  };
  const set = ((update: unknown) => {
    Object.assign(state, typeof update === 'function' ? update(state) : update);
  }) as unknown as SetFn;
  const get = (() => state) as unknown as GetFn;
  return { state, set, get, closers };
};

const rechecks = (state: Record<string, unknown>) =>
  (state.sessionThreadRechecks as Record<string, Record<string, unknown>>)[sessionId] ?? {};

describe('recheckThread', () => {
  beforeEach(() => {
    h.execute.mockClear();
    h.startRecheck.mockReset();
    h.updateStatus.mockClear();
  });

  it('settles on the deterministic check and never starts an agent', async () => {
    const { state, set, get } = harness({
      afterRefresh: facts({
        gitState: 'folded',
        missing: null,
        folded: { sha: '9f2c1ab', landedAs: 'e31b9f4' },
      }),
    });
    const outcome = await recheckThread({ set, get, sessionId, threadId });
    expect(outcome).toBe('settled');
    expect(h.startRecheck).not.toHaveBeenCalled();
    expect(rechecks(state)[threadId]).toBeUndefined();
  });

  it('starts one read-only agent when the facts are not enough', async () => {
    h.startRecheck.mockResolvedValue([agentId]);
    const { state, set, get } = harness({ afterRefresh: facts({}) });
    const outcome = await recheckThread({ set, get, sessionId, threadId });
    expect(outcome).toBe('started');
    expect(h.startRecheck).toHaveBeenCalledTimes(1);
    expect(h.startRecheck.mock.calls[0]?.[0]).toMatchObject({ sessionId, threadId });
    expect(rechecks(state)[threadId]).toEqual({ agentId, error: null });
  });

  it('does not start a second check while one runs', async () => {
    h.startRecheck.mockResolvedValue([agentId]);
    const { set, get } = harness({ afterRefresh: facts({}) });
    await recheckThread({ set, get, sessionId, threadId });
    await recheckThread({ set, get, sessionId, threadId });
    expect(h.startRecheck).toHaveBeenCalledTimes(1);
  });
});

describe('settleThreadRecheck', () => {
  beforeEach(() => {
    h.execute.mockClear();
    h.updateStatus.mockClear();
  });

  const settle = async ({ text }: { readonly text: string }) => {
    const built = harness({ afterRefresh: facts({}) });
    built.set((state) => ({
      sessionThreadRechecks: {
        ...state.sessionThreadRechecks,
        [sessionId]: { [threadId]: { agentId, error: null } },
      },
    }));
    await settleThreadRecheck({
      set: built.set,
      get: built.get,
      sessionId,
      agentId,
      assistantText: text,
    });
    return built;
  };

  it.each([
    ['fixed-here', 'verdict="fixed-here" sha="e31b9f4" evidence="folded in"', 'fixed_elsewhere'],
    ['not-relevant', 'verdict="not-relevant" sha="6b0e9f1" evidence="deleted"', 'obsolete'],
    ['still-needed', 'verdict="still-needed" evidence="back to old text"', 'refix'],
  ])('stores the %s verdict and closes nothing by itself', async (_name, attrs, kind) => {
    const { state, closers } = await settle({
      text: `done\n<<comment-verdict threadId="${threadId}" ${attrs}>>`,
    });
    const stored = (state.sessionThreadGit as Record<string, Record<string, ThreadGitFacts>>)[
      sessionId
    ]?.[threadId];
    expect(stored?.verdict?.kind).toBe(kind);
    expect(rechecks(state)[threadId]).toBeUndefined();
    expect(h.execute).toHaveBeenCalledWith(
      expect.stringContaining('verdict_json'),
      expect.arrayContaining([expect.stringContaining(kind)]),
    );
    for (const closer of closers) {
      expect(closer).not.toHaveBeenCalled();
    }
    expect(h.updateStatus).toHaveBeenCalledWith(
      agentId,
      expect.objectContaining({ status: 'completed' }),
    );
  });

  it('keeps the comment as it was when the agent gave no verdict', async () => {
    const { state, closers } = await settle({ text: 'I looked but have no answer' });
    const stored = (state.sessionThreadGit as Record<string, Record<string, ThreadGitFacts>>)[
      sessionId
    ]?.[threadId];
    expect(stored?.verdict).toBeNull();
    expect(rechecks(state)[threadId]).toEqual({ agentId: null, error: RECHECK_NO_ANSWER });
    expect(h.updateStatus).toHaveBeenCalledWith(
      agentId,
      expect.objectContaining({ status: 'failed' }),
    );
    for (const closer of closers) {
      expect(closer).not.toHaveBeenCalled();
    }
  });
});
