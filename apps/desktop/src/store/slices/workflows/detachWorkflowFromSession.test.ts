import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  ProviderRunId,
  SessionId,
  WorkflowExecutionMode,
  WorkflowId,
  WorkflowRunId,
} from '@goodboy/types';
import { purgedAgentIds } from '../../session-mutators';

const { cancelTurnSpy, detachInDbSpy, invokeAgentListSpy, awaitRunStoppedSpy, emitSpy } =
  vi.hoisted(() => ({
    cancelTurnSpy: vi.fn(async () => undefined),
    detachInDbSpy: vi.fn(async () => undefined),
    invokeAgentListSpy: vi.fn(async (): Promise<ReadonlyArray<unknown>> => []),
    awaitRunStoppedSpy: vi.fn(async () => true),
    emitSpy: vi.fn(async () => undefined),
  }));

vi.mock('@goodboy/db', () => ({
  detachWorkflowFromSession: detachInDbSpy,
  updateSessionState: vi.fn(async () => undefined),
}));

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: {},
}));

vi.mock('../../../features/chat/turn', () => ({
  cancelTurn: cancelTurnSpy,
}));

vi.mock('../../../features/workflows/workflows', () => ({
  invokeAgentList: invokeAgentListSpy,
}));

vi.mock('../../awaitRunStopped', () => ({
  awaitRunStopped: awaitRunStoppedSpy,
}));

import { detachWorkflowFromSession } from './detachWorkflowFromSession';

const SESSION_ID = 'session-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;
const OTHER_RUN_ID = 'run-2' as WorkflowRunId;
const WORKFLOW_ID = 'wf-1' as WorkflowId;
const PROVIDER_RUN_ID = 'provider-run-1' as ProviderRunId;

type AgentSeed = {
  readonly id: string;
  readonly workflowRunId?: WorkflowRunId;
  readonly parentAgentId?: string;
};

const agent = ({ id, workflowRunId, parentAgentId }: AgentSeed): Agent =>
  ({
    id: id as AgentId,
    sessionId: SESSION_ID,
    ordinal: 0,
    name: id,
    status: 'completed',
    ...(workflowRunId !== undefined && { workflowRunId, stepId: `step-${id}` }),
    ...(parentAgentId !== undefined && { parentAgentId: parentAgentId as AgentId }),
  }) as unknown as Agent;

type KindCase = {
  readonly kind: string;
  readonly executionMode: WorkflowExecutionMode;
  readonly isPreset: boolean;
  readonly agents: ReadonlyArray<AgentSeed>;
  readonly deletedIds: ReadonlyArray<string>;
};

const SURVIVORS: ReadonlyArray<AgentSeed> = [
  { id: 'standalone' },
  { id: 'other-run-agent', workflowRunId: OTHER_RUN_ID },
];

const KIND_CASES: ReadonlyArray<KindCase> = [
  {
    kind: 'preset',
    executionMode: 'static',
    isPreset: true,
    agents: [
      { id: 'scout', workflowRunId: RUN_ID },
      { id: 'builder', workflowRunId: RUN_ID },
    ],
    deletedIds: ['scout', 'builder'],
  },
  {
    kind: 'custom',
    executionMode: 'static',
    isPreset: false,
    agents: [
      { id: 'reviewer', workflowRunId: RUN_ID },
      { id: 'fanout-child', parentAgentId: 'reviewer' },
    ],
    deletedIds: ['reviewer', 'fanout-child'],
  },
  {
    kind: 'orchestrated',
    executionMode: 'orchestrated',
    isPreset: true,
    agents: [
      { id: 'planned', workflowRunId: RUN_ID },
      { id: 'orchestrator-spawned', workflowRunId: RUN_ID },
      { id: 'spawned-child', parentAgentId: 'orchestrator-spawned' },
      { id: 'nested-child', parentAgentId: 'spawned-child' },
    ],
    deletedIds: ['planned', 'orchestrator-spawned', 'spawned-child', 'nested-child'],
  },
];

type HarnessParams = {
  readonly executionMode: WorkflowExecutionMode;
  readonly isPreset: boolean;
  readonly agents: ReadonlyArray<AgentSeed>;
  readonly runningId?: string;
};

const buildHarness = ({ executionMode, isPreset, agents, runningId }: HarnessParams) => {
  const all = [...agents, ...SURVIVORS].map(agent);
  const perAgent = (value: unknown) => Object.fromEntries(all.map((a) => [a.id, value]));
  const state = {
    sessions: [
      {
        id: SESSION_ID,
        workspaceId: 'ws-1',
        workflowRuns: [
          { id: RUN_ID, workflowId: WORKFLOW_ID, executionMode },
          { id: OTHER_RUN_ID, workflowId: 'wf-2' as WorkflowId, executionMode: 'static' },
        ],
      },
    ],
    sessionWorkflows: {
      [SESSION_ID]: [
        { id: WORKFLOW_ID, name: 'Fix a bug', isPreset },
        { id: 'wf-2', name: 'Refactor', isPreset: false },
      ],
    },
    sessionPhaseRuns: { [SESSION_ID]: all },
    selectedAgentId: { [SESSION_ID]: agents[0]?.id },
    agentTurnState: {
      ...perAgent({ kind: 'idle', lastActivityAt: '2026-01-01T00:00:00Z' }),
      ...(runningId === undefined
        ? {}
        : {
            [runningId]: {
              kind: 'running',
              runId: PROVIDER_RUN_ID,
              startedAt: '2026-01-01T00:00:00Z',
            },
          }),
    },
    transcripts: perAgent([]),
    agentDraft: perAgent('draft'),
    agentAttachments: perAgent([]),
    agentQueue: perAgent([]),
    agentRunHistory: perAgent([]),
    runRouting: perAgent({}),
    agentModelOverride: perAgent('model'),
    agentProviderOverride: perAgent('claude'),
    agentEffortOverride: perAgent('high'),
    agentKindOverride: perAgent('builder'),
    agentTurnDestination: perAgent('dest'),
    workflowContinueAttempts: perAgent(1),
    clusterStepStartAttempts: perAgent(1),
    decisionRestartMarks: { [RUN_ID]: 1, [OTHER_RUN_ID]: 1 },
    emitNotification: emitSpy,
  };
  invokeAgentListSpy.mockResolvedValueOnce(SURVIVORS.map(agent));
  const set = vi.fn((updater: (s: typeof state) => Partial<typeof state>) => {
    Object.assign(state, updater(state));
  });
  const detach = detachWorkflowFromSession(
    set as unknown as Parameters<typeof detachWorkflowFromSession>[0],
    (() => state) as unknown as Parameters<typeof detachWorkflowFromSession>[1],
  );
  return { detach, state };
};

describe('detachWorkflowFromSession', () => {
  afterEach(() => {
    purgedAgentIds.clear();
    vi.clearAllMocks();
  });

  it.each(KIND_CASES)(
    'deletes the agents of a $kind workflow run with it',
    async ({ executionMode, isPreset, agents, deletedIds }) => {
      const { detach, state } = buildHarness({ executionMode, isPreset, agents });

      await detach(SESSION_ID, RUN_ID);

      expect(detachInDbSpy).toHaveBeenCalledWith({}, SESSION_ID, RUN_ID, expect.any(String));
      expect(state.sessionPhaseRuns[SESSION_ID]!.map((a) => a.id)).toEqual([
        'standalone',
        'other-run-agent',
      ]);
      expect(state.sessions[0]!.workflowRuns.map((r) => r.id)).toEqual([OTHER_RUN_ID]);
      expect(state.sessionWorkflows[SESSION_ID]!.map((w) => w.id)).toEqual(['wf-2']);
      expect(state.selectedAgentId[SESSION_ID]).toBeUndefined();
      for (const map of [
        state.agentTurnState,
        state.transcripts,
        state.agentDraft,
        state.agentModelOverride,
        state.agentKindOverride,
        state.workflowContinueAttempts,
      ]) {
        expect(Object.keys(map).sort()).toEqual(['other-run-agent', 'standalone']);
      }
      expect(state.decisionRestartMarks).toEqual({ [OTHER_RUN_ID]: 1 });
      expect([...purgedAgentIds].sort()).toEqual([...deletedIds].sort());
    },
  );

  it('stops a running agent of the run before deleting it', async () => {
    const { detach } = buildHarness({
      executionMode: 'orchestrated',
      isPreset: true,
      agents: KIND_CASES[2]!.agents,
      runningId: 'spawned-child',
    });

    await detach(SESSION_ID, RUN_ID);

    expect(cancelTurnSpy).toHaveBeenCalledWith(PROVIDER_RUN_ID);
    expect(awaitRunStoppedSpy).toHaveBeenCalledWith({ runId: PROVIDER_RUN_ID });
    expect(cancelTurnSpy.mock.invocationCallOrder[0]!).toBeLessThan(
      detachInDbSpy.mock.invocationCallOrder[0]!,
    );
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('warns when a deleted agent keeps running', async () => {
    awaitRunStoppedSpy.mockResolvedValueOnce(false);
    const { detach } = buildHarness({
      executionMode: 'static',
      isPreset: true,
      agents: KIND_CASES[0]!.agents,
      runningId: 'scout',
    });

    await detach(SESSION_ID, RUN_ID);

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Deleted workflow agent is still running' }),
    );
  });

  it('keeps the agents when the database delete fails', async () => {
    detachInDbSpy.mockRejectedValueOnce(new Error('locked'));
    const { detach, state } = buildHarness({
      executionMode: 'static',
      isPreset: false,
      agents: KIND_CASES[1]!.agents,
    });

    await expect(detach(SESSION_ID, RUN_ID)).rejects.toThrow('locked');

    expect(purgedAgentIds.size).toBe(0);
    expect(state.sessionPhaseRuns[SESSION_ID]).toHaveLength(4);
  });
});
