import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  MountId,
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

import { finalizeWorkflowStep } from './finalizeWorkflowStep';
import { SUMMARY_TIMEOUT_MS } from '../../summarizeAgentOutput';
import { clearMountContinuations, queueMountContinuation } from '../turn/mountContinuations';

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
      executionMode: 'static',
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
    workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
    projects: [
      {
        id: 'project-1',
        workspaceId: WORKSPACE_ID,
        rootPath: '/tmp/repo',
        kind: 'repo',
      },
    ],
    sessionProjectMounts: {
      [SESSION_ID]: [
        {
          projectId: 'project-1',
          mountName: 'repo',
          repoRoot: '/tmp/repo',
          worktreePath: '/tmp/worktree',
          branch: 'ak/workflow',
        },
      ],
    },
    sessionActiveProject: { [SESSION_ID]: 'project-1' },
    sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
    sessionBranches: { [SESSION_ID]: 'ak/workflow' },
    providers: [],
    providerCooldowns: {},
    refreshUnreadWorkspaces: vi.fn(),
    emitNotification: vi.fn(),
    sendTurn: vi.fn(),
    agentTurnState: {},
    workflowContinueAttempts: {},
    stepSummaryDegraded: {},
    degradedStepOutputs: {},
  };
  const set = vi.fn((update: unknown) => {
    const patch = typeof update === 'function' ? update(state) : update;
    Object.assign(state, patch);
  });
  const get = (() => state) as unknown as Parameters<typeof finalizeWorkflowStep>[1];
  const finalize = finalizeWorkflowStep(
    set as unknown as Parameters<typeof finalizeWorkflowStep>[0],
    get,
  );
  return Object.assign(finalize, { state });
};

describe('finalizeWorkflowStep output summary', () => {
  beforeEach(() => {
    invokeAgentListSpy.mockResolvedValue([{ ...agent, status: 'completed' }]);
    invokeAgentUpdateStatusSpy.mockResolvedValue({ ...agent, status: 'completed' });
    clearMountContinuations();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.useRealTimers();
    clearMountContinuations();
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
      workingDir: '/tmp/worktree',
      runId: expect.any(String),
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

  it('leaves the workflow step open while a requested mount continuation is pending', async () => {
    queueMountContinuation({
      continuation: {
        operationId: 'materialize:run-1:project-2:0',
        sessionId: SESSION_ID,
        mountId: 'mount-2' as MountId,
        mountName: 'web',
        branch: 'ak/web',
        worktreePath: '/tmp/web',
        origin: 'materialize',
      },
    });
    const finalize = buildHarness();

    const result = await finalize(
      SESSION_ID,
      AGENT_ID,
      `done <<step-done id="${AGENT_ID}">>`,
      false,
    );

    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
    expect(summarizeStepOutputSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ shouldAutoAdvance: false });
  });

  it('stores a marked bounded excerpt when summarization fails', async () => {
    const assistantText = [
      'Head passage: touched `src/auth.ts`.',
      ...Array.from(
        { length: 40 },
        (_value, index) => `Middle passage ${index}. ${'m'.repeat(200)}`,
      ),
      'Tail passage: the migration lock is still held.',
    ].join('\n\n');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    summarizeStepOutputSpy.mockRejectedValue(new Error('provider unavailable'));
    const state = {
      workflowContinueAttempts: {},
      stepSummaryDegraded: {},
      degradedStepOutputs: {},
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
      sessions: [session],
      workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
      sessionProjectMounts: {},
      sessionActiveProject: {},
      sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
      sessionBranches: { [SESSION_ID]: 'ak/workflow' },
      providers: [],
      providerCooldowns: {},
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

    const stored = (
      invokeAgentUpdateStatusSpy.mock.calls[0]?.[1] as { readonly outputSummary: string }
    ).outputSummary;

    expect(stored.split('\n')[0]).toBe('[unsummarized step output, excerpt]');
    expect(stored.length).toBeLessThanOrEqual(4000);
    expect(stored).toContain('Head passage: touched `src/auth.ts`.');
    expect(stored).toContain('Tail passage: the migration lock is still held.');
    expect(stored).toContain('[middle dropped, the full text is in the step transcript]');
    expect(warnSpy).toHaveBeenCalledWith(
      '[step-output] summarization failed, using deterministic fallback: provider unavailable',
    );
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'summarizer-degraded',
        severity: 'warning',
        title: expect.stringContaining('Implement'),
        body: expect.stringContaining('provider unavailable'),
        sessionId: SESSION_ID,
      }),
    );
  });

  it('appends degraded notifications with the same coalesce key', async () => {
    const assistantText = 'short output';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    summarizeStepOutputSpy.mockRejectedValue(new Error('timeout'));
    const state = {
      workflowContinueAttempts: {},
      stepSummaryDegraded: {},
      degradedStepOutputs: {},
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
      sessions: [session],
      workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
      sessionProjectMounts: {},
      sessionActiveProject: {},
      sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
      sessionBranches: { [SESSION_ID]: 'ak/workflow' },
      providers: [],
      providerCooldowns: {},
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

    expect(state.emitNotification).toHaveBeenCalledTimes(2);
    expect(state.emitNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'summarizer-degraded',
        severity: 'warning',
        title: expect.any(String),
        body: expect.any(String),
        coalesceKey: `step-summary-degraded:${agent.workflowRunId}:${agent.stepId}`,
      }),
    );
  });

  it('uses the fallback when summarization exceeds the timeout budget', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    summarizeStepOutputSpy.mockImplementation(() => new Promise(() => undefined));
    const finalize = buildHarness();
    const completion = finalize(SESSION_ID, AGENT_ID, 'timeout output', false, { force: true });

    await vi.advanceTimersByTimeAsync(SUMMARY_TIMEOUT_MS - 1);
    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await completion;
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({
        outputSummary: '[unsummarized step output, carried whole]\ntimeout output',
      }),
    );
  });

  it('summarizes once when two finalize calls race for the same agent', async () => {
    let release: (summary: string) => void = () => undefined;
    summarizeStepOutputSpy.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );
    const finalize = buildHarness();

    const first = finalize(SESSION_ID, AGENT_ID, 'raw output', false, { force: true });
    const second = finalize(SESSION_ID, AGENT_ID, 'raw output', false, { force: true });
    release('the only summary');
    await Promise.all([first, second]);

    expect(summarizeStepOutputSpy).toHaveBeenCalledTimes(1);
    const written = invokeAgentUpdateStatusSpy.mock.calls.map(
      (call) => (call[1] as { readonly outputSummary?: string }).outputSummary,
    );
    expect(new Set(written)).toEqual(new Set(['the only summary']));
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
    expect(finalize.state.sendTurn).toHaveBeenCalledTimes(1);
    expect(finalize.state.sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: SESSION_ID,
        agentId: AGENT_ID,
        origin: 'workflow',
        content: expect.stringContaining('<<step-done id="agent-1">>'),
      }),
    );
    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
  });

  it('pauses the step with a notification once the single continue is spent', async () => {
    const finalize = buildHarness();

    await finalize(SESSION_ID, AGENT_ID, 'stopped early', false);
    const result = await finalize(SESSION_ID, AGENT_ID, 'stopped again', false);

    expect(result).toEqual({ shouldAutoAdvance: false });
    expect(finalize.state.sendTurn).toHaveBeenCalledTimes(1);
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ status: 'failed' }),
    );
    expect(finalize.state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: 'Step paused on Implement',
        body: expect.stringContaining('step-done marker'),
        sessionId: SESSION_ID,
      }),
    );
    expect(finalize.state.workflowContinueAttempts).toEqual({});
  });

  it('gives the continue back after the agent asks a question', async () => {
    const finalize = buildHarness();

    await finalize(SESSION_ID, AGENT_ID, 'stopped early', false);
    await finalize(
      SESSION_ID,
      AGENT_ID,
      '<<ctx-question>>which flow types?<</ctx-question>>',
      false,
    );
    await finalize(SESSION_ID, AGENT_ID, 'stopped again', false);

    expect(finalize.state.sendTurn).toHaveBeenCalledTimes(2);
    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
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
    const assistantText = 'the step wrote three files';
    const finalize = buildHarness({ sessions: [] });

    const result = await finalize(SESSION_ID, AGENT_ID, assistantText, false, { force: true });

    expect(summarizeStepOutputSpy).not.toHaveBeenCalled();
    expect(invokeAgentUpdateStatusSpy).toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({
        status: 'completed',
        outputSummary: `[unsummarized step output, carried whole]\n${assistantText}`,
      }),
    );
    expect(result).toEqual({ shouldAutoAdvance: true });
  });

  it('leaves the step open and resumes the cluster when a child never ran', async () => {
    const child: Agent = {
      id: 'child-1' as AgentId,
      sessionId: SESSION_ID,
      workflowRunId: WORKFLOW_RUN_ID,
      parentAgentId: AGENT_ID,
      ordinal: 1,
      name: 'cluster 1',
      status: 'pending',
    };
    const plan = {
      id: 'plan-1',
      sessionId: SESSION_ID,
      workflowRunId: WORKFLOW_RUN_ID,
      title: 'Migrate modals',
      bodyMd: '',
      status: 'consumed',
      clusters: [
        { title: 'c0', instructions: 'do 0' },
        { title: 'c1', instructions: 'do 1' },
      ],
    };
    const state = {
      workflowContinueAttempts: {},
      stepSummaryDegraded: {},
      degradedStepOutputs: {},
      clusterStartAttempts: {},
      sessionPhaseRuns: { [SESSION_ID]: [agent, child] },
      sessions: [session],
      sessionPlans: { [SESSION_ID]: [plan] },
      planConsumptions: { 'plan-1': [{ agentId: AGENT_ID }] },
      workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
      sessionProjectMounts: {},
      sessionActiveProject: {},
      sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
      sessionBranches: { [SESSION_ID]: 'ak/workflow' },
      providers: [],
      providerCooldowns: {},
      refreshUnreadWorkspaces: vi.fn(),
      emitNotification: vi.fn(),
      sendTurn: vi.fn(async () => undefined),
      loadSessionPlans: vi.fn(async () => undefined),
    };
    const set = vi.fn();
    const get = (() => state) as unknown as Parameters<typeof finalizeWorkflowStep>[1];
    const finalize = finalizeWorkflowStep(
      set as unknown as Parameters<typeof finalizeWorkflowStep>[0],
      get,
    );

    const result = await finalize(
      SESSION_ID,
      AGENT_ID,
      `done <<step-done id="${AGENT_ID}">>`,
      false,
    );

    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalledWith(
      AGENT_ID,
      expect.objectContaining({ status: 'completed' }),
    );
    expect(state.sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: 'child-1' as AgentId }),
    );
    expect(result).toEqual({ shouldAutoAdvance: false });
  });

  it('leaves the step open and warns when an unsettled child cannot be resumed', async () => {
    const child: Agent = {
      id: 'child-1' as AgentId,
      sessionId: SESSION_ID,
      workflowRunId: WORKFLOW_RUN_ID,
      parentAgentId: AGENT_ID,
      ordinal: 1,
      name: 'cluster 1',
      status: 'failed',
    };
    const state = {
      workflowContinueAttempts: {},
      stepSummaryDegraded: {},
      degradedStepOutputs: {},
      sessionPhaseRuns: { [SESSION_ID]: [agent, child] },
      sessions: [session],
      sessionPlans: {},
      planConsumptions: {},
      workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
      sessionProjectMounts: {},
      sessionActiveProject: {},
      sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
      sessionBranches: { [SESSION_ID]: 'ak/workflow' },
      providers: [],
      providerCooldowns: {},
      refreshUnreadWorkspaces: vi.fn(),
      emitNotification: vi.fn(),
      sendTurn: vi.fn(async () => undefined),
      loadSessionPlans: vi.fn(async () => undefined),
    };
    const set = vi.fn();
    const get = (() => state) as unknown as Parameters<typeof finalizeWorkflowStep>[1];
    const finalize = finalizeWorkflowStep(
      set as unknown as Parameters<typeof finalizeWorkflowStep>[0],
      get,
    );

    const result = await finalize(
      SESSION_ID,
      AGENT_ID,
      `done <<step-done id="${AGENT_ID}">>`,
      false,
    );

    expect(invokeAgentUpdateStatusSpy).not.toHaveBeenCalled();
    expect(state.sendTurn).not.toHaveBeenCalled();
    expect(state.emitNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        severity: 'warning',
        title: `${agent.name} is waiting on clusters`,
        body: expect.stringContaining('1 cluster agent has not finished'),
        sessionId: SESSION_ID,
      }),
    );
    expect(result).toEqual({ shouldAutoAdvance: false });
  });

  it('does not notify the inbox for the session-missing guard fallback (excluded from I6)', async () => {
    const state = {
      workflowContinueAttempts: {},
      stepSummaryDegraded: {},
      degradedStepOutputs: {},
      sessionPhaseRuns: { [SESSION_ID]: [agent] },
      sessions: [],
      workspaces: [{ id: WORKSPACE_ID, rootPath: '/tmp/repo', kind: 'repo' }],
      sessionProjectMounts: {},
      sessionActiveProject: {},
      sessionWorktrees: { [SESSION_ID]: ['/tmp/worktree'] },
      sessionBranches: { [SESSION_ID]: 'ak/workflow' },
      providers: [],
      providerCooldowns: {},
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

    await finalize(SESSION_ID, AGENT_ID, 'short output', false, { force: true });

    expect(state.emitNotification).not.toHaveBeenCalled();
  });
});
