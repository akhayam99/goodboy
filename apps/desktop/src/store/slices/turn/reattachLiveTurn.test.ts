// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import type { TurnOwner } from '../../../features/chat/turnCursor';

const h = vi.hoisted(() => ({
  events: [] as TurnEvent[],
  failure: null as Error | null,
  attachTurn: vi.fn(),
  updateProviderRunStatus: vi.fn(async () => undefined),
  updateSessionState: vi.fn(async () => undefined),
  insertMessage: vi.fn(async () => undefined),
  invokeAgentUpdateStatus: vi.fn(async () => undefined),
  invokeAgentList: vi.fn(async () => []),
  completeResolvedAgent: vi.fn(async () => true as boolean | null),
  recordTurnSpan: vi.fn(async () => undefined),
  captureArtifactsFromTurn: vi.fn(async () => ({ plan: null, artifact: null, error: null })),
  enqueueSummarizer: vi.fn(),
  captureMaterializeRequestsFromTurn: vi.fn(async () => undefined),
}));

vi.mock('../../../features/chat/turn', () => ({
  attachTurn: (params: unknown) => {
    h.attachTurn(params);
    return (async function* () {
      for (const event of h.events) {
        yield event;
      }
      if (h.failure !== null) {
        throw h.failure;
      }
    })();
  },
}));
vi.mock('@goodboy/db', () => ({
  insertMessage: h.insertMessage,
  updateProviderRunStatus: h.updateProviderRunStatus,
  updateSessionState: h.updateSessionState,
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));
vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: h.invokeAgentList,
  invokeAgentUpdateStatus: h.invokeAgentUpdateStatus,
}));
vi.mock('../../turn-helpers', () => ({
  captureArtifactsFromTurn: h.captureArtifactsFromTurn,
  captureMaterializeRequestsFromTurn: h.captureMaterializeRequestsFromTurn,
  enqueueSummarizer: h.enqueueSummarizer,
}));
vi.mock('./completeResolvedAgent', () => ({ completeResolvedAgent: h.completeResolvedAgent }));
vi.mock('./recordTurnSpan', () => ({ recordTurnSpan: h.recordTurnSpan }));
vi.mock('./recordUsageTelemetry', () => ({ recordUsageTelemetry: vi.fn(async () => undefined) }));
vi.mock('./collectTouchedMounts', () => ({ collectTouchedMounts: vi.fn(async () => []) }));
vi.mock('./snapshotMountChanges', () => ({
  snapshotMountChanges: vi.fn(() => Promise.resolve(new Map())),
}));
vi.mock('../project-mounts/selectors', () => ({ selectWritableMounts: vi.fn(() => []) }));

import { selectWritableMounts } from '../project-mounts/selectors';
import { reattachLiveTurn } from './reattachLiveTurn';
import { isTurnSettling } from './turnSettled';

const RUN_ID = 'run-1' as ProviderRunId;
const AGENT_ID = 'agent-1' as AgentId;
const SESSION_ID = 'session-1' as SessionId;
const AT = '2026-09-27T10:00:00.000Z' as IsoDateTime;

const OWNER: TurnOwner = {
  agentId: AGENT_ID,
  sessionId: SESSION_ID,
  workspaceId: 'workspace-1' as never,
  workflowRunId: 'wfrun-1' as never,
  stepRole: 'implementer',
  provider: 'anthropic',
  model: 'claude-sonnet-5',
  effort: 'high',
  startedAt: AT,
  workingDir: '/tmp/worktree',
  mountId: null,
};

type FakeState = Record<string, unknown> & {
  agentTurnState: Record<string, unknown>;
  sessions: ReadonlyArray<unknown>;
};

const buildStore = () => {
  const appended: TurnEvent[] = [];
  const maybeAutoAdvanceWorkflow = vi.fn(async () => undefined);
  const drainAgentQueue = vi.fn(async () => undefined);
  let state: FakeState = {
    agentTurnState: {},
    sessions: [{ id: SESSION_ID, state: { kind: 'idle', lastActivityAt: AT } }],
    sessionPhaseRuns: { [SESSION_ID]: [{ id: AGENT_ID, name: 'Implement' }] },
    transcripts: { [AGENT_ID]: [{ kind: 'user_text', text: 'build it', at: AT }] },
    appendTurnEvent: (_agent: AgentId, _session: SessionId, event: TurnEvent) => {
      appended.push(event);
    },
    recordProviderLimits: vi.fn(),
    maybeAutoAdvanceWorkflow,
    drainAgentQueue,
  };
  const get = () => state as never;
  const set = (patch: unknown) => {
    const next = typeof patch === 'function' ? (patch as (s: FakeState) => unknown)(state) : patch;
    state = { ...state, ...(next as Partial<FakeState>) };
  };
  return { get, set: set as never, appended, maybeAutoAdvanceWorkflow, drainAgentQueue };
};

beforeEach(() => {
  vi.clearAllMocks();
  h.events = [];
  h.failure = null;
});

describe('reattachLiveTurn', () => {
  it('stores the rest of the stream and settles the step so the workflow moves on', async () => {
    h.events = [
      { kind: 'assistant_text', runId: RUN_ID, delta: 'done ', at: AT },
      { kind: 'assistant_text', runId: RUN_ID, delta: 'here', at: AT },
    ];
    const store = buildStore();

    await reattachLiveTurn({
      set: store.set,
      get: store.get,
      runId: RUN_ID,
      cursor: { seq: 4, index: 0, owner: OWNER },
    });

    expect(h.attachTurn).toHaveBeenCalledWith(
      expect.objectContaining({ runId: RUN_ID, provider: 'anthropic' }),
    );
    expect(store.appended.map((event) => event.kind)).toEqual(['assistant_text', 'assistant_text']);
    expect(h.recordTurnSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        span: expect.objectContaining({
          runId: RUN_ID,
          workflowRunId: 'wfrun-1',
          startedAt: AT,
          endReason: 'succeeded',
        }),
      }),
    );
    expect(h.updateProviderRunStatus).toHaveBeenCalledWith({}, RUN_ID, {
      kind: 'succeeded',
      finishedAt: expect.any(String),
    });
    expect(h.completeResolvedAgent).toHaveBeenCalledWith(
      expect.objectContaining({ resolvedAgentId: AGENT_ID, assistantText: 'done here' }),
    );
    expect(h.enqueueSummarizer).toHaveBeenCalledWith(
      expect.objectContaining({ turnInput: 'build it', turnOutput: 'done here' }),
    );
    expect(store.maybeAutoAdvanceWorkflow).toHaveBeenCalledWith(SESSION_ID);
    expect(store.drainAgentQueue).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
    });
  });

  it('marks the agent failed with a retryable error when the run is gone', async () => {
    h.failure = new Error('This run ended while the window reloaded.');
    const store = buildStore();

    await reattachLiveTurn({
      set: store.set,
      get: store.get,
      runId: RUN_ID,
      cursor: { seq: 4, index: 0, owner: OWNER },
    });

    expect(store.appended).toEqual([
      expect.objectContaining({
        kind: 'error',
        message: 'This run ended while the window reloaded.',
        retryable: true,
      }),
    ]);
    expect(h.invokeAgentUpdateStatus).toHaveBeenCalledWith(AGENT_ID, {
      status: 'failed',
      completedAt: expect.any(String),
    });
    expect(h.completeResolvedAgent).not.toHaveBeenCalled();
    expect(store.maybeAutoAdvanceWorkflow).not.toHaveBeenCalled();
  });

  it('does not leave the turn marked active when setup throws before the stream starts', async () => {
    vi.mocked(selectWritableMounts).mockImplementationOnce(() => {
      throw new Error('mount selection failed');
    });
    const store = buildStore();

    await expect(
      reattachLiveTurn({
        set: store.set,
        get: store.get,
        runId: RUN_ID,
        cursor: { seq: 4, index: 0, owner: OWNER },
      }),
    ).rejects.toThrow('mount selection failed');

    expect(isTurnSettling({ agentId: AGENT_ID, nowMs: Date.now() })).toBe(false);
    expect(h.attachTurn).not.toHaveBeenCalled();
  });
});
