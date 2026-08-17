import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import { buildTimelineGroups } from './buildTimelineGroups';

type TypedStringParams = {
  readonly value: string;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value =>
  JSON.parse(JSON.stringify(value));

const SESSION_ID = typedString<SessionId>({ value: 'session-1' });
const WORKFLOW_RUN_ID = typedString<WorkflowRunId>({ value: 'run-1' });

type AgentParams = {
  readonly id: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly workflowRunId?: WorkflowRunId;
  readonly status?: Agent['status'];
};

const agent = ({
  id,
  startedAt,
  completedAt,
  workflowRunId,
  status = 'completed',
}: AgentParams): Agent => ({
  id: typedString<AgentId>({ value: id }),
  sessionId: SESSION_ID,
  stepId: workflowRunId != null ? typedString<StepId>({ value: `step-${id}` }) : undefined,
  workflowRunId,
  ordinal: 0,
  name: id,
  status,
  ...(startedAt != null ? { startedAt: typedString<IsoDateTime>({ value: startedAt }) } : {}),
  ...(completedAt != null ? { completedAt: typedString<IsoDateTime>({ value: completedAt }) } : {}),
});

const attachedWorkflow = (): { readonly run: WorkflowRun; readonly workflow: Workflow } => {
  const workflowId = typedString<WorkflowId>({ value: 'workflow-1' });
  return {
    run: {
      id: WORKFLOW_RUN_ID,
      workflowId,
      ordinal: 0,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'manual',
      executionMode: 'static',
      createdAt: typedString<IsoDateTime>({ value: '2026-08-17T08:00:00Z' }),
    },
    workflow: {
      id: workflowId,
      workspaceId: typedString<WorkspaceId>({ value: 'workspace-1' }),
      name: 'Release workflow',
      description: '',
      steps: [],
      createdAt: typedString<IsoDateTime>({ value: '2026-08-17T08:00:00Z' }),
      updatedAt: typedString<IsoDateTime>({ value: '2026-08-17T08:00:00Z' }),
    },
  };
};

type QuestionParams = {
  readonly id: string;
  readonly createdByAgentId?: string;
  readonly workflowRunId?: WorkflowRunId;
  readonly createdByStepOrdinal?: number;
};

const question = ({
  id,
  createdByAgentId,
  workflowRunId,
  createdByStepOrdinal,
}: QuestionParams): OpenQuestion => ({
  id: typedString<OpenQuestionId>({ value: id }),
  sessionId: SESSION_ID,
  ...(createdByAgentId != null
    ? { createdByAgentId: typedString<AgentId>({ value: createdByAgentId }) }
    : {}),
  ...(workflowRunId != null ? { workflowRunId } : {}),
  ...(createdByStepOrdinal != null ? { createdByStepOrdinal } : {}),
  text: id,
  suggestedAnswers: [],
  userAnswer: null,
  status: 'answered',
  createdAt: typedString<IsoDateTime>({ value: '2026-08-17T09:00:00Z' }),
});

type BuildParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly workflows?: ReadonlyArray<ReturnType<typeof attachedWorkflow>>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
};

const build = ({ agents, workflows = [], questions = [] }: BuildParams) =>
  buildTimelineGroups({
    agents,
    workflows,
    plans: [],
    externalTasks: [],
    questions,
    worktrees: [],
    agentKindOverride: {},
  });

describe('buildTimelineGroups', () => {
  it('places a completed agent with NULL started_at at completed_at', () => {
    const model = build({
      agents: [agent({ id: 'finished', completedAt: '2026-08-17T10:00:00Z' })],
    });
    const entry = model.entries[0];

    expect(entry?.kind).toBe('agent');
    expect(entry?.at).toBe('2026-08-17T10:00:00Z');
    expect(entry?.kind === 'agent' ? entry.hasDuration : true).toBe(false);
  });

  it('keeps timestampless pending agents in Now', () => {
    const model = build({ agents: [agent({ id: 'pending', status: 'pending' })] });

    expect(model.entries).toEqual([]);
    expect(model.now.map((item) => item.id)).toEqual(['agent:pending']);
  });

  it('groups workflow steps contiguously and anchors the run by latest activity', () => {
    const model = build({
      workflows: [attachedWorkflow()],
      agents: [
        agent({ id: 'first', startedAt: '2026-08-17T09:00:00Z', workflowRunId: WORKFLOW_RUN_ID }),
        agent({ id: 'second', startedAt: '2026-08-17T10:00:00Z', workflowRunId: WORKFLOW_RUN_ID }),
        agent({ id: 'standalone', startedAt: '2026-08-17T09:30:00Z' }),
      ],
    });
    const run = model.entries.find((entry) => entry.kind === 'run');

    expect(model.entries.map((entry) => entry.id)).toEqual(['run:run-1', 'agent:standalone']);
    expect(run?.kind === 'run' ? run.children.map((entry) => entry.id) : []).toEqual([
      'agent:first',
      'agent:second',
    ]);
  });

  it('keeps a run whose steps are all pending, with those steps on the run', () => {
    const model = build({
      workflows: [attachedWorkflow()],
      agents: [
        agent({ id: 'first', status: 'pending', workflowRunId: WORKFLOW_RUN_ID }),
        agent({ id: 'second', status: 'pending', workflowRunId: WORKFLOW_RUN_ID }),
      ],
    });
    const run = model.entries.find((entry) => entry.kind === 'run');

    expect(run?.kind === 'run' ? run.children : []).toEqual([]);
    expect(run?.kind === 'run' ? run.pendingAgents.map((item) => item.id) : []).toEqual([
      'first',
      'second',
    ]);
  });

  it('keeps terminal questions from both the agent link and the step ordinal', () => {
    const model = build({
      workflows: [attachedWorkflow()],
      agents: [
        agent({ id: 'first', startedAt: '2026-08-17T09:00:00Z', workflowRunId: WORKFLOW_RUN_ID }),
      ],
      questions: [
        question({ id: 'direct', createdByAgentId: 'first' }),
        question({ id: 'inferred', workflowRunId: WORKFLOW_RUN_ID, createdByStepOrdinal: 0 }),
      ],
    });
    const run = model.entries.find((entry) => entry.kind === 'run');
    const child = run?.kind === 'run' ? run.children[0] : null;

    expect(child?.kind === 'agent' ? child.terminalQuestions.map((item) => item.id) : []).toEqual([
      'direct',
      'inferred',
    ]);
  });
});
