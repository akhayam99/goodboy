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
const OTHER_RUN_ID = typedString<WorkflowRunId>({ value: 'run-2' });

type AgentParams = {
  readonly id: string;
  readonly ordinal?: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly workflowRunId?: WorkflowRunId;
  readonly parentAgentId?: string;
  readonly status?: Agent['status'];
};

const agent = ({
  id,
  ordinal = 0,
  startedAt,
  completedAt,
  workflowRunId,
  parentAgentId,
  status = 'completed',
}: AgentParams): Agent => ({
  id: typedString<AgentId>({ value: id }),
  sessionId: SESSION_ID,
  stepId: workflowRunId != null ? typedString<StepId>({ value: `step-${id}` }) : undefined,
  workflowRunId,
  ...(parentAgentId != null
    ? { parentAgentId: typedString<AgentId>({ value: parentAgentId }) }
    : {}),
  ordinal,
  name: id,
  status,
  ...(startedAt != null ? { startedAt: typedString<IsoDateTime>({ value: startedAt }) } : {}),
  ...(completedAt != null ? { completedAt: typedString<IsoDateTime>({ value: completedAt }) } : {}),
});

type WorkflowParams = {
  readonly runId?: WorkflowRunId;
  readonly name?: string;
  readonly createdAt?: string;
};

const attachedWorkflow = ({
  runId = WORKFLOW_RUN_ID,
  name = 'Release workflow',
  createdAt = '2026-08-17T08:00:00Z',
}: WorkflowParams = {}): { readonly run: WorkflowRun; readonly workflow: Workflow } => {
  const workflowId = typedString<WorkflowId>({ value: `workflow-${runId}` });
  return {
    run: {
      id: runId,
      workflowId,
      ordinal: 0,
      currentStep: 0,
      autoRun: false,
      triggerMode: 'manual',
      executionMode: 'static',
      createdAt: typedString<IsoDateTime>({ value: createdAt }),
    },
    workflow: {
      id: workflowId,
      workspaceId: typedString<WorkspaceId>({ value: 'workspace-1' }),
      name,
      description: '',
      steps: [],
      createdAt: typedString<IsoDateTime>({ value: createdAt }),
      updatedAt: typedString<IsoDateTime>({ value: createdAt }),
    },
  };
};

type QuestionParams = {
  readonly id: string;
  readonly createdByAgentId?: string;
  readonly workflowRunId?: WorkflowRunId;
  readonly createdByStepOrdinal?: number;
  readonly answeredAt?: string;
};

const question = ({
  id,
  createdByAgentId,
  workflowRunId,
  createdByStepOrdinal,
  answeredAt,
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
  ...(answeredAt != null ? { answeredAt: typedString<IsoDateTime>({ value: answeredAt }) } : {}),
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

  it('anchors a run at its own creation instant, not at its latest step', () => {
    const model = build({
      workflows: [
        attachedWorkflow({ createdAt: '2026-08-17T08:00:00Z' }),
        attachedWorkflow({
          runId: OTHER_RUN_ID,
          name: 'Refactor workflow',
          createdAt: '2026-08-17T09:00:00Z',
        }),
      ],
      agents: [
        agent({
          id: 'late-step',
          ordinal: 5,
          startedAt: '2026-08-17T11:00:00Z',
          workflowRunId: WORKFLOW_RUN_ID,
        }),
      ],
    });

    expect(model.entries.map((entry) => entry.id)).toEqual(['run:run-2', 'run:run-1']);
  });

  it('does not move a workflow when it gains a late child', () => {
    const withoutLateStep = build({
      workflows: [attachedWorkflow()],
      agents: [
        agent({ id: 'standalone', ordinal: 1, startedAt: '2026-08-17T08:30:00Z' }),
        agent({
          id: 'first-step',
          ordinal: 2,
          startedAt: '2026-08-17T08:10:00Z',
          workflowRunId: WORKFLOW_RUN_ID,
        }),
      ],
    });
    const withLateStep = build({
      workflows: [attachedWorkflow()],
      agents: [
        agent({ id: 'standalone', ordinal: 1, startedAt: '2026-08-17T08:30:00Z' }),
        agent({
          id: 'first-step',
          ordinal: 2,
          startedAt: '2026-08-17T08:10:00Z',
          workflowRunId: WORKFLOW_RUN_ID,
        }),
        agent({
          id: 'late-step',
          ordinal: 3,
          startedAt: '2026-08-17T12:00:00Z',
          workflowRunId: WORKFLOW_RUN_ID,
        }),
      ],
    });

    expect(withLateStep.entries.map((entry) => entry.id)).toEqual(
      withoutLateStep.entries.map((entry) => entry.id),
    );
  });

  it('keeps a run and its steps as one contiguous block with workflow ordinals', () => {
    const model = build({
      workflows: [attachedWorkflow()],
      agents: [
        agent({
          id: 'first',
          ordinal: 1,
          startedAt: '2026-08-17T09:00:00Z',
          workflowRunId: WORKFLOW_RUN_ID,
        }),
        agent({
          id: 'second',
          ordinal: 2,
          startedAt: '2026-08-17T10:00:00Z',
          workflowRunId: WORKFLOW_RUN_ID,
        }),
        agent({ id: 'standalone', ordinal: 3, startedAt: '2026-08-17T09:30:00Z' }),
      ],
    });
    const run = model.entries.find((entry) => entry.kind === 'run');

    expect(model.entries.map((entry) => entry.id)).toEqual(['agent:standalone', 'run:run-1']);
    expect(run?.kind === 'run' ? run.children.map((entry) => entry.id) : []).toEqual([
      'agent:second',
      'agent:first',
    ]);
    expect(
      run?.kind === 'run'
        ? run.children.map((entry) => (entry.kind === 'agent' ? entry.stepLabel : null))
        : [],
    ).toEqual(['2', '1']);
  });

  it('gives a run a stable identity colour derived from its id', () => {
    const first = build({ workflows: [attachedWorkflow()], agents: [] });
    const second = build({ workflows: [attachedWorkflow()], agents: [] });
    const firstRun = first.entries[0];
    const secondRun = second.entries[0];

    expect(firstRun?.kind === 'run' ? firstRun.identity.stroke : null).toBe(
      secondRun?.kind === 'run' ? secondRun.identity.stroke : undefined,
    );
  });

  it('nests a sub-agent under its parent with the parent ordinal as its prefix', () => {
    const model = build({
      workflows: [attachedWorkflow()],
      agents: [
        agent({
          id: 'implement',
          ordinal: 3,
          startedAt: '2026-08-17T09:00:00Z',
          workflowRunId: WORKFLOW_RUN_ID,
        }),
        agent({
          id: 'sub-a',
          ordinal: 4,
          parentAgentId: 'implement',
          startedAt: '2026-08-17T09:10:00Z',
        }),
        agent({
          id: 'sub-b',
          ordinal: 5,
          parentAgentId: 'implement',
          startedAt: '2026-08-17T09:20:00Z',
        }),
      ],
    });
    const run = model.entries.find((entry) => entry.kind === 'run');
    const step = run?.kind === 'run' ? run.children[0] : null;

    expect(step?.kind === 'agent' ? step.stepLabel : null).toBe('1');
    expect(
      step?.kind === 'agent'
        ? step.children.map((child) => `${child.stepLabel ?? ''}:${child.agent.id}`)
        : [],
    ).toEqual(['1.2:sub-b', '1.1:sub-a']);
  });

  it('never lists the same entry twice across the model', () => {
    const model = build({
      workflows: [attachedWorkflow()],
      agents: [
        agent({
          id: 'step',
          ordinal: 1,
          startedAt: '2026-08-17T09:00:00Z',
          workflowRunId: WORKFLOW_RUN_ID,
        }),
        agent({
          id: 'child',
          ordinal: 2,
          parentAgentId: 'step',
          startedAt: '2026-08-17T09:05:00Z',
        }),
        agent({ id: 'standalone', ordinal: 3, status: 'running' }),
      ],
    });
    const ids: string[] = [];
    const walk = (entry: { readonly id: string; readonly children?: ReadonlyArray<unknown> }) => {
      ids.push(entry.id);
      for (const child of entry.children ?? []) {
        walk(child as { readonly id: string; readonly children?: ReadonlyArray<unknown> });
      }
    };
    for (const entry of model.entries) {
      walk(entry);
    }

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps a never-started agent at the newest end, where its ordinal puts it', () => {
    const model = build({
      agents: [
        agent({ id: 'done', ordinal: 1, completedAt: '2026-08-17T09:00:00Z' }),
        agent({ id: 'pending', ordinal: 2, status: 'pending' }),
      ],
    });

    expect(model.entries.map((entry) => entry.id)).toEqual(['agent:pending', 'agent:done']);
    expect(model.entries[0]?.at).toBeNull();
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

  it('promotes an answered question into a child row under its parent agent', () => {
    const model = build({
      agents: [agent({ id: 'first', startedAt: '2026-08-17T09:00:00Z' })],
      questions: [
        question({
          id: 'direct',
          createdByAgentId: 'first',
          answeredAt: '2026-08-17T09:10:00Z',
        }),
      ],
    });
    const agentEntry = model.entries.find((entry) => entry.kind === 'agent');

    expect(agentEntry?.kind === 'agent' ? agentEntry.answers.map((item) => item.id) : []).toEqual([
      'answer:agent:first:direct',
    ]);
  });
});
