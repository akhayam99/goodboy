import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  PlanId,
  PlanWithCount,
  SessionExternalTask,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
} from '@goodboy/types';
import { buildTimelineEntries, type TimelineEntry } from './buildTimelineEntries';

type TypedStringParams = {
  readonly value: unknown;
};

const typedString = <Value extends string>({ value }: TypedStringParams): Value => {
  if (typeof value !== 'string') {
    throw new Error('Expected a string fixture value');
  }
  return JSON.parse(JSON.stringify(value));
};

const SESSION_ID = typedString<SessionId>({ value: 'session-1' });

type AgentParams = {
  readonly id: string;
  readonly at?: string;
  readonly ordinal?: number;
  readonly kind?: string;
  readonly workflowRunId?: WorkflowRunId;
  readonly parentAgentId?: AgentId;
  readonly status?: Agent['status'];
};

const agent = ({
  id,
  at,
  ordinal = 0,
  kind = 'generic',
  workflowRunId,
  parentAgentId,
  status = 'completed',
}: AgentParams): Agent => ({
  id: typedString<AgentId>({ value: id }),
  sessionId: SESSION_ID,
  stepId: workflowRunId != null ? typedString<StepId>({ value: `step-${id}` }) : undefined,
  workflowRunId,
  parentAgentId,
  ordinal,
  name: id,
  status,
  kind,
  startedAt: at != null ? typedString<IsoDateTime>({ value: at }) : undefined,
});

type AttachedWorkflowParams = {
  readonly id: string;
  readonly createdAt: string;
  readonly ordinal?: number;
};

const attachedWorkflow = ({
  id,
  createdAt,
  ordinal = 0,
}: AttachedWorkflowParams): { readonly run: WorkflowRun; readonly workflow: Workflow } => {
  const workflowId = typedString<WorkflowId>({ value: `workflow-${id}` });
  return {
    run: {
      id: typedString<WorkflowRunId>({ value: id }),
      workflowId,
      ordinal,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'manual',
      executionMode: 'static',
      createdAt: typedString<IsoDateTime>({ value: createdAt }),
    },
    workflow: {
      id: workflowId,
      workspaceId: typedString({ value: 'workspace-1' }),
      name: `workflow ${id}`,
      description: '',
      steps: [],
      createdAt: typedString<IsoDateTime>({ value: createdAt }),
      updatedAt: typedString<IsoDateTime>({ value: createdAt }),
    },
  };
};

type PlanParams = {
  readonly id: string;
  readonly at: string;
  readonly workflowRunId?: WorkflowRunId;
};

const plan = ({ id, at, workflowRunId }: PlanParams): PlanWithCount => ({
  id: typedString<PlanId>({ value: id }),
  sessionId: SESSION_ID,
  agentId: typedString<AgentId>({ value: `agent-${id}` }),
  workflowRunId,
  title: id,
  bodyMd: '',
  status: 'active',
  createdAt: typedString<IsoDateTime>({ value: at }),
  updatedAt: typedString<IsoDateTime>({ value: at }),
  consumptionCount: 0,
});

type IssueParams = {
  readonly id: string;
  readonly at: string;
};

const issue = ({ id, at }: IssueParams): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: id,
  identifier: id,
  url: `https://linear.example/${id}`,
  title: id,
  createdAt: typedString<IsoDateTime>({ value: at }),
});

type QuestionParams = {
  readonly id: string;
  readonly at: string;
  readonly status: OpenQuestion['status'];
};

const question = ({ id, at, status }: QuestionParams): OpenQuestion => ({
  id: typedString<OpenQuestionId>({ value: id }),
  sessionId: SESSION_ID,
  text: id,
  suggestedAnswers: [],
  userAnswer: status === 'answered' ? 'yes' : null,
  status,
  createdAt: typedString<IsoDateTime>({ value: at }),
});

type BuildParams = {
  readonly agents?: ReadonlyArray<Agent>;
  readonly workflows?: ReadonlyArray<ReturnType<typeof attachedWorkflow>>;
  readonly plans?: ReadonlyArray<PlanWithCount>;
  readonly externalTasks?: ReadonlyArray<SessionExternalTask>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
};

const build = ({
  agents = [],
  workflows = [],
  plans = [],
  externalTasks = [],
  questions = [],
}: BuildParams): ReadonlyArray<TimelineEntry> =>
  buildTimelineEntries({
    agents,
    workflows,
    plans,
    externalTasks,
    questions,
    agentKindOverride: {},
  });

const ids = ({ entries }: { readonly entries: ReadonlyArray<TimelineEntry> }) =>
  entries.map((entry) => entry.id);

describe('buildTimelineEntries', () => {
  it('orders mixed agents, workflow steps, plans, issues and resolves chronologically', () => {
    const workflow = attachedWorkflow({ id: 'run-1', createdAt: '2026-08-17T08:00:00Z' });
    const entries = build({
      agents: [
        agent({ id: 'standalone', at: '2026-08-17T08:02:00Z' }),
        agent({
          id: 'step',
          at: '2026-08-17T08:04:00Z',
          workflowRunId: workflow.run.id,
        }),
        agent({ id: 'resolve', at: '2026-08-17T08:05:00Z', kind: 'resolver' }),
      ],
      workflows: [workflow],
      plans: [plan({ id: 'plan-1', at: '2026-08-17T08:03:00Z' })],
      externalTasks: [issue({ id: 'PLA-1', at: '2026-08-17T08:01:00Z' })],
    });

    expect(ids({ entries })).toEqual([
      'issue:linear:PLA-1',
      'agent:standalone',
      'plan:plan-1',
      'agent:step',
      'agent:resolve',
    ]);
  });

  it('keeps workflow numbers stable while interleaved runs only join adjacent matching rows', () => {
    const first = attachedWorkflow({ id: 'run-1', createdAt: '2026-08-17T08:00:00Z' });
    const second = attachedWorkflow({ id: 'run-2', createdAt: '2026-08-17T08:01:00Z' });
    const entries = build({
      agents: [
        agent({ id: 'one-a', at: '2026-08-17T09:00:00Z', workflowRunId: first.run.id }),
        agent({ id: 'two', at: '2026-08-17T09:01:00Z', workflowRunId: second.run.id }),
        agent({ id: 'one-b', at: '2026-08-17T09:02:00Z', workflowRunId: first.run.id }),
      ],
      workflows: [second, first],
    });
    const agentEntries = entries.filter((entry) => entry.kind === 'agent');

    expect(agentEntries.map((entry) => entry.workflowNumber)).toEqual([1, 2, 1]);
    expect(agentEntries.map((entry) => [entry.joinsPrevious, entry.joinsNext])).toEqual([
      [false, false],
      [false, false],
      [false, false],
    ]);
  });

  it('breaks and resumes a workflow chain around a standalone agent', () => {
    const workflow = attachedWorkflow({ id: 'run-1', createdAt: '2026-08-17T08:00:00Z' });
    const entries = build({
      agents: [
        agent({ id: 'step-a', at: '2026-08-17T09:00:00Z', workflowRunId: workflow.run.id }),
        agent({ id: 'interrupt', at: '2026-08-17T09:01:00Z' }),
        agent({ id: 'step-b', at: '2026-08-17T09:02:00Z', workflowRunId: workflow.run.id }),
        agent({ id: 'step-c', at: '2026-08-17T09:03:00Z', workflowRunId: workflow.run.id }),
      ],
      workflows: [workflow],
    });

    expect(entries.map((entry) => [entry.id, entry.joinsPrevious, entry.joinsNext])).toEqual([
      ['agent:step-a', false, false],
      ['agent:interrupt', false, false],
      ['agent:step-b', false, true],
      ['agent:step-c', true, false],
    ]);
  });

  it('promotes cluster blocks around a top-level interrupt and preserves sibling indexes', () => {
    const workflow = attachedWorkflow({ id: 'run-1', createdAt: '2026-08-17T08:00:00Z' });
    const parent = agent({
      id: 'container',
      at: '2026-08-17T09:00:00Z',
      kind: 'implementer',
      workflowRunId: workflow.run.id,
    });
    const entries = build({
      agents: [
        parent,
        agent({
          id: 'block-1',
          at: '2026-08-17T09:01:00Z',
          ordinal: 1,
          kind: 'implementer',
          workflowRunId: workflow.run.id,
          parentAgentId: parent.id,
        }),
        agent({ id: 'interrupt', at: '2026-08-17T09:02:00Z', kind: 'debugger' }),
        agent({
          id: 'block-2',
          at: '2026-08-17T09:03:00Z',
          ordinal: 2,
          kind: 'implementer',
          workflowRunId: workflow.run.id,
          parentAgentId: parent.id,
        }),
      ],
      workflows: [workflow],
    });
    const agentEntries = entries.filter((entry) => entry.kind === 'agent');

    expect(agentEntries.map((entry) => [entry.agent.id, entry.depth, entry.clusterIndex])).toEqual([
      [parent.id, 0, null],
      [typedString<AgentId>({ value: 'block-1' }), 1, 1],
      [typedString<AgentId>({ value: 'interrupt' }), 0, null],
      [typedString<AgentId>({ value: 'block-2' }), 1, 2],
    ]);
    expect(agentEntries.map((entry) => [entry.joinsPrevious, entry.joinsNext])).toEqual([
      [false, true],
      [true, false],
      [false, false],
      [false, false],
    ]);
  });

  it('excludes an agent that has never started', () => {
    const entries = build({
      agents: [agent({ id: 'spawned' }), agent({ id: 'started', at: '2026-08-17T09:00:00Z' })],
    });

    expect(ids({ entries })).toEqual(['agent:started']);
  });

  it.each(['answered', 'dismissed'] satisfies ReadonlyArray<OpenQuestion['status']>)(
    'removes an %s question from the stream',
    (status) => {
      const entries = build({
        questions: [question({ id: `question-${status}`, at: '2026-08-17T09:00:00Z', status })],
      });

      expect(entries).toEqual([]);
    },
  );
});
