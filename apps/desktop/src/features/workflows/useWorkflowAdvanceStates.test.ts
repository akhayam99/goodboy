import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { AttachedRun } from './activeWorkflowRuns';

const h = vi.hoisted(() => ({
  agentTurnState: {} as Record<string, { kind: string }>,
}));

vi.mock('../../store', () => ({
  useAppStore: <T>(
    selector: (state: {
      agentTurnState: typeof h.agentTurnState;
      summarizerStatus: Record<string, never>;
    }) => T,
  ) => selector({ agentTurnState: h.agentTurnState, summarizerStatus: {} }),
  useSessionOpenQuestions: () => [],
}));

const { useWorkflowAdvanceStates } = await import('./useWorkflowAdvanceStates');

const SESSION_ID = 'ses-1' as SessionId;
const NOW = '2026-07-25T00:00:00.000Z' as IsoDateTime;

const workflowFor = ({ id }: { readonly id: string }): Workflow => ({
  id: id as WorkflowId,
  workspaceId: 'ws-1' as WorkspaceId,
  name: `Workflow ${id}`,
  description: '',
  steps: [
    {
      id: `${id}-s1` as StepId,
      workflowId: id as WorkflowId,
      ordinal: 0,
      name: 'Scout',
      promptPrefix: '',
    },
    {
      id: `${id}-s2` as StepId,
      workflowId: id as WorkflowId,
      ordinal: 1,
      name: 'Plan',
      promptPrefix: '',
    },
  ],
  createdAt: NOW,
  updatedAt: NOW,
});

const runFor = ({
  id,
  workflowId,
}: {
  readonly id: string;
  readonly workflowId: string;
}): WorkflowRun => ({
  id: id as WorkflowRunId,
  workflowId: workflowId as WorkflowId,
  ordinal: 0,
  currentStep: 1,
  autoRun: false,
  triggerMode: 'manual',
  executionMode: 'static',
});

const attachedA: AttachedRun = {
  run: runFor({ id: 'run-a', workflowId: 'wf-a' }),
  workflow: workflowFor({ id: 'wf-a' }),
};
const attachedB: AttachedRun = {
  run: runFor({ id: 'run-b', workflowId: 'wf-b' }),
  workflow: workflowFor({ id: 'wf-b' }),
};

const agentFor = ({
  id,
  runId,
  stepId,
}: {
  readonly id: string;
  readonly runId: string;
  readonly stepId: string;
}): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  stepId: stepId as StepId,
  workflowRunId: runId as WorkflowRunId,
  ordinal: 0,
  name: id,
  status: 'completed',
});

const agents: ReadonlyArray<Agent> = [
  agentFor({ id: 'agent-a', runId: 'run-a', stepId: 'wf-a-s1' }),
  agentFor({ id: 'agent-b', runId: 'run-b', stepId: 'wf-b-s1' }),
];

describe('useWorkflowAdvanceStates', () => {
  beforeEach(() => {
    h.agentTurnState = {};
  });

  it('blocks only the run whose agent is turning', () => {
    h.agentTurnState = { 'agent-a': { kind: 'running' } };

    const { result } = renderHook(() =>
      useWorkflowAdvanceStates({
        sessionId: SESSION_ID,
        workflows: [attachedA, attachedB],
        agents,
      }),
    );

    expect(result.current.get('run-a')).toMatchObject({ kind: 'blocked', reason: 'turn-running' });
    expect(result.current.get('run-b')).toMatchObject({ kind: 'ready' });
  });

  it('treats a starting turn as turning for its own run', () => {
    h.agentTurnState = { 'agent-b': { kind: 'starting' } };

    const { result } = renderHook(() =>
      useWorkflowAdvanceStates({
        sessionId: SESSION_ID,
        workflows: [attachedA, attachedB],
        agents,
      }),
    );

    expect(result.current.get('run-a')).toMatchObject({ kind: 'ready' });
    expect(result.current.get('run-b')).toMatchObject({ kind: 'blocked', reason: 'turn-running' });
  });

  it('ignores turns of agents outside any run', () => {
    h.agentTurnState = { loose: { kind: 'running' } };
    const loose: Agent = {
      id: 'loose' as AgentId,
      sessionId: SESSION_ID,
      ordinal: 1,
      name: 'loose',
      status: 'pending',
    };

    const { result } = renderHook(() =>
      useWorkflowAdvanceStates({
        sessionId: SESSION_ID,
        workflows: [attachedA, attachedB],
        agents: [...agents, loose],
      }),
    );

    expect(result.current.get('run-a')).toMatchObject({ kind: 'ready' });
    expect(result.current.get('run-b')).toMatchObject({ kind: 'ready' });
  });
});
