import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  SessionId,
  Step,
  StepId,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { deriveHandoffSender } from './deriveHandoffSender';

const agent = (overrides: Partial<Agent> = {}): Agent => ({
  id: 'agent-2' as AgentId,
  sessionId: 'session' as SessionId,
  ordinal: 2,
  name: 'Implementer',
  status: 'pending',
  ...overrides,
});

const step = (id: string, ordinal: number): Step => ({
  id: id as StepId,
  workflowId: 'wf' as WorkflowId,
  ordinal,
  name: id,
  promptPrefix: '',
});

const run = (executionMode: WorkflowRun['executionMode']): WorkflowRun => ({
  id: 'run-1' as WorkflowRunId,
  workflowId: 'wf' as WorkflowId,
  ordinal: 0,
  currentStep: 0,
  autoRun: false,
  triggerMode: 'immediate',
  executionMode,
});

const base = {
  agent: agent(),
  agentKind: 'implementer' as const,
  parent: null,
  parentKind: null,
  workflowRun: null,
  step: null,
  steps: [],
  prNumber: null,
};

describe('deriveHandoffSender', () => {
  it('names you when nothing else sent the agent', () => {
    expect(deriveHandoffSender(base)).toEqual({ kind: 'you' });
  });

  it('counts a fixed workflow step by its position', () => {
    const steps = [step('scout', 0), step('plan', 4), step('implement', 9)];
    expect(
      deriveHandoffSender({ ...base, workflowRun: run('static'), step: steps[1]!, steps }),
    ).toEqual({ kind: 'workflowStep', workflowRunId: 'run-1', stepOrdinal: 2, stepCount: 3 });
  });

  it('names the orchestrator on a dynamic run', () => {
    const steps = [step('scout', 0), step('plan', 1)];
    expect(
      deriveHandoffSender({ ...base, workflowRun: run('dynamic'), step: steps[1]!, steps }),
    ).toEqual({ kind: 'orchestrator', workflowRunId: 'run-1', stepOrdinal: 2 });
  });

  it('names Resolve with the threads of a resolver', () => {
    expect(
      deriveHandoffSender({
        ...base,
        agent: agent({ sourceThreadIds: ['t1', 't2'] }),
        agentKind: 'resolver',
        prNumber: 412,
      }),
    ).toEqual({ kind: 'resolve', threadIds: ['t1', 't2'], prNumber: 412 });
  });

  it('names the question a delegate answers', () => {
    expect(
      deriveHandoffSender({
        ...base,
        agent: agent({ sourceKind: 'open_question', sourceThreadId: 'q1' }),
        parent: agent({ id: 'agent-1' as AgentId }),
        parentKind: 'scout',
      }),
    ).toEqual({ kind: 'question', questionId: 'q1' });
  });

  it('tells a follow-up from a child the parent split off', () => {
    const parent = agent({ id: 'agent-1' as AgentId, name: 'Scout' });
    expect(deriveHandoffSender({ ...base, parent, parentKind: 'scout' })).toEqual({
      kind: 'followUp',
      sourceAgentId: 'agent-1',
    });
    expect(deriveHandoffSender({ ...base, parent, parentKind: 'implementer' })).toEqual({
      kind: 'parent',
      parentAgentId: 'agent-1',
      label: '',
    });
  });
});
