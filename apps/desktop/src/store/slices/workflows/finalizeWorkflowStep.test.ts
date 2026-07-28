import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  Session,
  SessionId,
  StepId,
  WorkflowId,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';

const { invokeAgentListSpy, invokeAgentUpdateStatusSpy, summarizeStepOutputSpy } = vi.hoisted(
  () => ({
    invokeAgentListSpy: vi.fn(),
    invokeAgentUpdateStatusSpy: vi.fn(),
    summarizeStepOutputSpy: vi.fn(),
  }),
);

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

vi.mock('@goodboy/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/core')>();
  return { ...actual, summarizeStepOutput: summarizeStepOutputSpy };
});

vi.mock('@goodboy/db', () => ({ updateSessionWorkflowStep: vi.fn() }));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: { execute: vi.fn(), select: vi.fn() },
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: invokeAgentListSpy,
  invokeAgentUpdateStatus: invokeAgentUpdateStatusSpy,
}));

import { finalizeWorkflowStep, degradedNotifiedAgents } from './finalizeWorkflowStep';

const SESSION_ID = 'session-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const WORKSPACE_ID = 'workspace-1' as WorkspaceId;
const WORKFLOW_ID = 'workflow-1' as WorkflowId;
const WORKFLOW_RUN_ID = 'workflow-run-1' as WorkflowRunId;
const STEP_ID = 'step-1' as StepId;
const NOW = '2026-07-21T00:00:00.000Z' as IsoDateTime;

const agent: Agent = {
  id: AGENT_ID,
  sessionId: SESSION_ID,
  stepId: STEP_ID,
  workflowRunId: WORKFLOW_RUN_ID,
  ordinal: 0,
  name: 'Implement',
  status: 'running',
};

const session: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'implement the change',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [
    {
      id: WORKFLOW_RUN_ID,
      workflowId: WORKFLOW_ID,
      ordinal: 0,
      currentStep: 0,
      autoRun: true,
      triggerMode: 'immediate',
    },
  ],
  autoRun: true,
  titleUserEdited: false,
  createdAt: NOW,
  updatedAt: NOW,
};

type Params = {
  readonly sessions?: ReadonlyArray<Session>;
  readonly agents?: ReadonlyArray<Agent>;
};

const buildHarness = ({ sessions = [session], agents = [agent] }: Params = {}) => {
  const state = {
    sessionPhaseRuns: { [SESSION_ID]: agents },
    sessions,
    refreshUnreadWorkspaces: vi.fn(),
    emitNotification: vi.fn(),
    sendTurn: vi.fn(),
  };
  const set = vi.fn();
  const get = (() => state) as unknown as Parameters<typeof finalizeWorkflowStep>[1];
  return finalizeWorkflowStep(set as unknown as Parameters<typeof finalizeWorkflowStep>[0], get);
};

describe('finalizeWorkflowStep output summary', () => {
  beforeEach(() => {
    invokeAgentListSpy.mockResolvedValue([{ ...agent, status: 'completed' }]);
    invokeAgentUpdateStatusSpy.mockResolvedValue({ ...agent, status: 'completed' });
    degradedNotifiedAgents.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('stores the LLM summary before allowing auto-advance', async () => {
    summarizeStepOutputSpy.mockResolvedValue(
      'Implemented the workflow handoff.\n- `sendTurn.ts` updated',
    );
    const finalize = buildHarness();

    const result = await finalize(SESSION_ID, AGENT_ID, 'raw assistant output', false, {
      force: true,
    });

    expect(summarizeStepOutputSpy).toHaveBeenCalledWith({
      providerId: 'anthropic',
      model: 'haiku-4.5',
      invokeFn: expect.any(Function),
      output: 'raw assistant output',
    });
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({
        status: 'completed',
        outputSummary: 'Implemented the workflow handoff.\n- `sendTurn.ts` updated',
      }),
    );
    expect(result).toEqual({ shouldAutoAdvance: true });
  });

  it('stores deterministic head and tail fallback when summarization fails', async () => {
    const assistantText = `${'h'.repeat(1500)}${'m'.repeat(100)}${'t'.repeat(400)}`;
    const expectedSummary = `${'h'.repeat(1500)}\n...\n${'t'.repeat(400)}`;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    summarizeStepOutputSpy.mockRejectedValue(new Error('provider unavailable'));
    const state = {
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
      sessions: [session],
      refreshUnreadWorkspaces: vi.fn(),
      emitNotification: vi.fn(),
      sendTurn: vi.fn(),
    };
    const set = vi.fn();
    const get = (() => state) as unknown as Parameters<typeof finalizeWorkflowStep>[1];
    const finalize = finalizeWorkflowStep(
      set as unknown as Parameters<typeof finalizeWorkflowStep>[0],
      get,
    );

    await finalize(SESSION_ID, AGENT_ID, assistantText, false, { force: true });

    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ outputSummary: expectedSummary }),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[step-output] summarization failed, using deterministic fallback: provider unavailable',
    );
    expect(state.emitNotification).toHaveBeenCalledWith(
      'summarizer-degraded',
      'warning',
      expect.stringContaining('Implement'),
      expect.stringContaining('provider unavailable'),
      expect.objectContaining({ sessionId: SESSION_ID }),
    );
  });

  it('emits degraded notification only once per agent (dedup)', async () => {
    const assistantText = 'short output';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    summarizeStepOutputSpy.mockRejectedValue(new Error('timeout'));
    const state = {
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
      sessions: [session],
      refreshUnreadWorkspaces: vi.fn(),
      emitNotification: vi.fn(),
      sendTurn: vi.fn(),
    };
    const set = vi.fn();
    const get = (() => state) as unknown as Parameters<typeof finalizeWorkflowStep>[1];
    const finalize = finalizeWorkflowStep(
      set as unknown as Parameters<typeof finalizeWorkflowStep>[0],
      get,
    );

    await finalize(SESSION_ID, AGENT_ID, assistantText, false, { force: true });
    await finalize(SESSION_ID, AGENT_ID, assistantText, false, { force: true });

    expect(state.emitNotification).toHaveBeenCalledTimes(1);
  });

  it('uses the fallback when summarization exceeds 15 seconds', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    summarizeStepOutputSpy.mockImplementation(() => new Promise(() => undefined));
    const finalize = buildHarness();
    const completion = finalize(SESSION_ID, AGENT_ID, 'timeout output', false, { force: true });

    await vi.advanceTimersByTimeAsync(14_999);
    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await completion;
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ outputSummary: 'timeout output' }),
    );
  });

  it('ignores a step-done marker that names a different step', async () => {
    const sibling: Agent = { ...agent, id: 'agent-2' as AgentId, ordinal: 1, name: 'Review' };
    invokeAgentListSpy.mockResolvedValue([agent, sibling]);
    const finalize = buildHarness({ agents: [agent, sibling] });

    const result = await finalize(
      SESSION_ID,
      AGENT_ID,
      'done here <<step-done id="agent-2">>',
      false,
    );

    expect(result).toEqual({ shouldAutoAdvance: false });
  });

  it('accepts a step-done marker whose id matches no known agent', async () => {
    summarizeStepOutputSpy.mockResolvedValue('Did the thing.');
    const finalize = buildHarness();

    const result = await finalize(
      SESSION_ID,
      AGENT_ID,
      'all done <<step-done id="agent-1-truncated">>',
      false,
    );

    expect(result).toEqual({ shouldAutoAdvance: true });
  });

  it('does not fail the step when the agent stopped to ask an open question', async () => {
    const finalize = buildHarness();

    const result = await finalize(
      SESSION_ID,
      AGENT_ID,
      'I need input. <<ctx-question>>which flow types?<</ctx-question>>',
      false,
    );

    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ shouldAutoAdvance: false });
  });

  it('completes with deterministic fallback when the session row is missing', async () => {
    const assistantText = `${'h'.repeat(1500)}middle${'t'.repeat(400)}`;
    const finalize = buildHarness({ sessions: [] });

    const result = await finalize(SESSION_ID, AGENT_ID, assistantText, false, { force: true });

    expect(summarizeStepOutputSpy).not.toHaveBeenCalled();
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({
        status: 'completed',
        outputSummary: `${'h'.repeat(1500)}\n...\n${'t'.repeat(400)}`,
      }),
    );
    expect(result).toEqual({ shouldAutoAdvance: true });
  });
});
