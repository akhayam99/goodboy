import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';

const { invokeAgentUpdateStatusSpy, summarizeStepOutputSpy } = vi.hoisted(() => ({
  invokeAgentUpdateStatusSpy: vi.fn(),
  summarizeStepOutputSpy: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return { ...actual, summarizeStepOutput: summarizeStepOutputSpy };
});

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentUpdateStatus: invokeAgentUpdateStatusSpy,
}));

import { retryStepSummary } from './retryStepSummary';
import {
  stepSummaryDegraded,
  summarizeAgentOutput,
  summarizedStepOutputs,
} from '../../summarizeAgentOutput';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const NOW = '2026-07-23T00:00:00.000Z' as IsoDateTime;

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'Implement',
  status: 'completed',
};

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'implement the change',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

type State = {
  sessions: ReadonlyArray<Session>;
  workspaces: ReadonlyArray<{
    id: WorkspaceId;
    rootPath: string;
    kind: 'repo';
  }>;
  sessionMounts: Record<string, ReadonlyArray<never>>;
  sessionActiveMount: Record<string, WorkspaceId>;
  sessionWorktrees: Record<string, ReadonlyArray<string>>;
  sessionBranches: Record<string, string>;
  sessionPhaseRuns: Record<string, ReadonlyArray<Agent>>;
  transcripts: Record<string, ReadonlyArray<{ kind: string; delta?: string }>>;
  workspaceOverrides: Record<string, unknown>;
  emitNotification: ReturnType<typeof vi.fn>;
};

const buildHarness = (stateOverrides: Partial<State> = {}) => {
  const state: State = {
    sessions: [session],
    workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
    sessionMounts: {},
    sessionActiveMount: {},
    sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
    sessionBranches: { [SESSION_ID]: 'ak/workflow' },
    sessionPhaseRuns: { [SESSION_ID]: [agent] },
    transcripts: {
      [AGENT_ID]: [
        { kind: 'assistant_text', delta: 'implemented the feature' },
        { kind: 'assistant_text', delta: ' with tests' },
      ],
    },
    workspaceOverrides: {},
    emitNotification: vi.fn(async () => undefined),
    ...stateOverrides,
  };
  const set = vi.fn();
  const get = (() => state) as unknown as Parameters<ReturnType<typeof retryStepSummary>>[0];
  return retryStepSummary(
    set as unknown as Parameters<typeof retryStepSummary>[0],
    get as unknown as Parameters<typeof retryStepSummary>[1],
  );
};

describe('retryStepSummary', () => {
  beforeEach(() => {
    invokeAgentUpdateStatusSpy.mockResolvedValue({ ...agent });
    summarizedStepOutputs.clear();
    stepSummaryDegraded.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates outputSummary from LLM result', async () => {
    summarizeStepOutputSpy.mockResolvedValue('implemented the feature with tests');
    const retry = buildHarness();

    await retry({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({
        status: 'completed',
        outputSummary: 'implemented the feature with tests',
      }),
    );
  });

  it('updates store sessionPhaseRuns with new outputSummary', async () => {
    summarizeStepOutputSpy.mockResolvedValue('new summary');
    const set = vi.fn();
    const state: State = {
      sessions: [session],
      workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
      sessionMounts: {},
      sessionActiveMount: {},
      sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
      sessionBranches: { [SESSION_ID]: 'ak/workflow' },
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
      transcripts: { [AGENT_ID]: [{ kind: 'assistant_text', delta: 'output' }] },
      workspaceOverrides: {},
      emitNotification: vi.fn(async () => undefined),
    };
    const get = (() => state) as unknown as Parameters<typeof retryStepSummary>[1];
    const retry = retryStepSummary(set as unknown as Parameters<typeof retryStepSummary>[0], get);

    await retry({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(set).toHaveBeenCalledWith(expect.any(Function));
    const updater = set.mock.calls[0]?.[0] as ((s: typeof state) => typeof state) | undefined;
    const nextState = updater?.(state);
    expect(nextState?.sessionPhaseRuns[SESSION_ID]?.[0]?.outputSummary).toBe('new summary');
  });

  it('uses provided taskModelOverride instead of resolved model', async () => {
    summarizeStepOutputSpy.mockResolvedValue('override result');
    const retry = buildHarness();

    await retry({
      sessionId: SESSION_ID,
      agentId: AGENT_ID,
      taskModelOverride: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
    });

    expect(summarizeStepOutputSpy).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: 'anthropic', model: 'claude-haiku-4-5' }),
    );
  });

  it('re-summarizes the output the degraded attempt used, not the current transcript', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    summarizeStepOutputSpy.mockRejectedValueOnce(new Error('provider unavailable'));
    const degraded = await summarizeAgentOutput({
      agentId: AGENT_ID,
      output: 'the text the first attempt received',
      taskModel: { providerId: 'anthropic', model: 'claude-haiku-4-5' },
    });
    expect(degraded.degraded).toBe(true);

    summarizeStepOutputSpy.mockResolvedValueOnce('retried summary');
    const retry = buildHarness();
    await retry({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(summarizeStepOutputSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ output: 'the text the first attempt received' }),
    );
  });

  it('falls back to the transcript when no earlier attempt is on record', async () => {
    summarizeStepOutputSpy.mockResolvedValue('transcript summary');
    const retry = buildHarness();

    await retry({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(summarizeStepOutputSpy).toHaveBeenCalledWith(
      expect.objectContaining({ output: 'implemented the feature with tests' }),
    );
  });

  it('returns early when session is not found', async () => {
    const retry = buildHarness({ sessions: [] });

    await retry({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
  });

  it('returns early when agent is not found', async () => {
    const retry = buildHarness({ sessionPhaseRuns: { [SESSION_ID]: [] } });

    await retry({ sessionId: SESSION_ID, agentId: AGENT_ID });

    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
  });
});
