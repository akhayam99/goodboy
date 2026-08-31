import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  ProjectId,
  SessionEvent,
  SessionEventId,
  SessionEventKind,
  SessionEventPayload,
  SessionExternalTask,
  SessionId,
  StepId,
  Workflow,
  WorkflowId,
  WorkflowRun,
  WorkflowRunId,
  WorkspaceId,
} from '@goodboy/types';
import type { SessionWorktree } from '@goodboy/db';
import { buildTimelineGroups, type TimelineAgentEntry } from './buildTimelineGroups';
import { runIdentity, runIdentitySeed } from './runIdentity';

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
  readonly sessionId?: SessionId;
  readonly agents: ReadonlyArray<Agent>;
  readonly workflows?: ReadonlyArray<ReturnType<typeof attachedWorkflow>>;
  readonly questions?: ReadonlyArray<OpenQuestion>;
  readonly externalTasks?: ReadonlyArray<SessionExternalTask>;
  readonly worktrees?: ReadonlyArray<SessionWorktree>;
  readonly events?: ReadonlyArray<SessionEvent>;
};

const build = ({
  sessionId = SESSION_ID,
  agents,
  workflows = [],
  questions = [],
  externalTasks = [],
  worktrees = [],
  events = [],
}: BuildParams) =>
  buildTimelineGroups({
    sessionId,
    agents,
    workflows,
    plans: [],
    externalTasks,
    questions,
    worktrees,
    events,
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

  it('keeps workflow membership and ordinals as run metadata', () => {
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

  it('assigns runs distinct slots in creation order', () => {
    const model = build({
      workflows: [
        attachedWorkflow({ createdAt: '2026-08-17T08:00:00Z' }),
        attachedWorkflow({ runId: OTHER_RUN_ID, createdAt: '2026-08-17T09:00:00Z' }),
      ],
      agents: [],
    });
    const identities = model.entries.flatMap((entry) =>
      entry.kind === 'run' ? [[entry.run.id, entry.identity.index] satisfies [string, number]] : [],
    );

    const seed = runIdentitySeed({ sessionId: SESSION_ID });

    expect(identities).toEqual([
      ['run-2', runIdentity({ laneIndex: 1, seed }).index],
      ['run-1', runIdentity({ laneIndex: 0, seed }).index],
    ]);
  });

  it('keeps existing run identities when a later run is appended', () => {
    const firstTwo = [
      attachedWorkflow({ createdAt: '2026-08-17T08:00:00Z' }),
      attachedWorkflow({ runId: OTHER_RUN_ID, createdAt: '2026-08-17T09:00:00Z' }),
    ];
    const before = build({ workflows: firstTwo, agents: [] });
    const after = build({
      workflows: [
        ...firstTwo,
        attachedWorkflow({
          runId: typedString<WorkflowRunId>({ value: 'run-3' }),
          createdAt: '2026-08-17T10:00:00Z',
        }),
      ],
      agents: [],
    });
    const indexesOf = ({ model }: { readonly model: ReturnType<typeof build> }) =>
      new Map(
        model.entries.flatMap((entry) =>
          entry.kind === 'run'
            ? [[entry.run.id, entry.identity.index] satisfies [string, number]]
            : [],
        ),
      );
    const beforeIndexes = indexesOf({ model: before });
    const afterIndexes = indexesOf({ model: after });
    const seed = runIdentitySeed({ sessionId: SESSION_ID });

    expect(beforeIndexes.get(WORKFLOW_RUN_ID)).toBe(runIdentity({ laneIndex: 0, seed }).index);
    expect(beforeIndexes.get(OTHER_RUN_ID)).toBe(runIdentity({ laneIndex: 1, seed }).index);
    expect(afterIndexes.get(WORKFLOW_RUN_ID)).toBe(runIdentity({ laneIndex: 0, seed }).index);
    expect(afterIndexes.get(OTHER_RUN_ID)).toBe(runIdentity({ laneIndex: 1, seed }).index);
  });

  it('assigns adjacent lanes different palette indices for every seed', () => {
    for (let seed = 0; seed < 5; seed += 1) {
      for (let laneIndex = 0; laneIndex < 5; laneIndex += 1) {
        const current = runIdentity({ laneIndex, seed });
        const adjacent = runIdentity({ laneIndex: laneIndex + 1, seed });

        expect(current.index).not.toBe(adjacent.index);
      }
    }
  });

  it('starts different sessions at different lane-zero indices', () => {
    const firstSessionId = typedString<SessionId>({ value: 'session-alpha' });
    const secondSessionId = typedString<SessionId>({ value: 'session-beta' });
    const firstSeed = runIdentitySeed({ sessionId: firstSessionId });
    const secondSeed = runIdentitySeed({ sessionId: secondSessionId });

    expect(firstSeed).not.toBe(secondSeed);

    const first = build({ sessionId: firstSessionId, workflows: [attachedWorkflow()], agents: [] });
    const second = build({
      sessionId: secondSessionId,
      workflows: [attachedWorkflow()],
      agents: [],
    });
    const firstRun = first.entries.find((entry) => entry.kind === 'run');
    const secondRun = second.entries.find((entry) => entry.kind === 'run');

    expect(firstRun?.kind === 'run' ? firstRun.identity.index : null).not.toBe(
      secondRun?.kind === 'run' ? secondRun.identity.index : null,
    );
  });

  it('returns identical identity indices for identical builds', () => {
    const workflows = [
      attachedWorkflow({ createdAt: '2026-08-17T08:00:00Z' }),
      attachedWorkflow({ runId: OTHER_RUN_ID, createdAt: '2026-08-17T09:00:00Z' }),
    ];
    const identityIndexesOf = ({ model }: { readonly model: ReturnType<typeof build> }) =>
      model.entries.flatMap((entry) => (entry.kind === 'run' ? [entry.identity.index] : []));

    expect(identityIndexesOf({ model: build({ workflows, agents: [] }) })).toEqual(
      identityIndexesOf({ model: build({ workflows, agents: [] }) }),
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

type EventParams = {
  readonly id: string;
  readonly kind: SessionEventKind;
  readonly at: string;
  readonly payload?: SessionEventPayload;
};

const sessionEvent = ({ id, kind, at, payload }: EventParams): SessionEvent => ({
  id: typedString<SessionEventId>({ value: id }),
  sessionId: SESSION_ID,
  kind,
  payload: payload ?? null,
  createdAt: typedString<IsoDateTime>({ value: at }),
});

const worktree = ({
  branch,
  projectId,
}: {
  readonly branch: string;
  readonly projectId?: string;
}): SessionWorktree => ({
  id: 'wt-1',
  sessionId: SESSION_ID,
  worktreePath: '/repo/.goodboy/worktrees/gb-trace',
  branch,
  parallelIndex: 0,
  ...(projectId != null ? { projectId: typedString<ProjectId>({ value: projectId }) } : {}),
  createdAt: Date.parse('2026-08-17T07:00:00Z'),
});

const externalTask = ({ url }: { readonly url: string }): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'lin-1',
  identifier: 'GB-1',
  url,
  title: 'Persist the trace',
  createdAt: typedString<IsoDateTime>({ value: '2026-08-17T07:30:00Z' }),
});

describe('buildTimelineGroups, session events', () => {
  it('turns every event into its own top level entry', () => {
    const model = build({
      agents: [],
      events: [
        sessionEvent({ id: 'ev-1', kind: 'pr_merged', at: '2026-08-17T12:00:00Z' }),
        sessionEvent({ id: 'ev-2', kind: 'branch_switched', at: '2026-08-17T11:00:00Z' }),
      ],
    });

    expect(model.entries.map((entry) => entry.id)).toEqual(['event:ev-1', 'event:ev-2']);
  });

  it('drops the derived branch row once a branch event exists', () => {
    const model = build({
      agents: [],
      worktrees: [worktree({ branch: 'ak/feat' })],
      events: [
        sessionEvent({
          id: 'ev-1',
          kind: 'branch_created',
          at: '2026-08-17T07:00:00Z',
          payload: { branch: 'ak/feat' },
        }),
      ],
    });

    expect(model.entries.map((entry) => entry.kind)).toEqual(['event']);
  });

  it('keeps the derived branch row for a session recorded before the event log', () => {
    const model = build({
      agents: [],
      worktrees: [worktree({ branch: 'ak/feat' })],
      events: [sessionEvent({ id: 'ev-1', kind: 'pr_merged', at: '2026-08-17T12:00:00Z' })],
    });

    expect(model.entries.some((entry) => entry.kind === 'branch')).toBe(true);
  });

  it('drops the session folder row once the work lives in a mounted repo', () => {
    const model = build({
      agents: [],
      worktrees: [worktree({ branch: 'ak/feat', projectId: 'project-1' })],
      events: [
        sessionEvent({
          id: 'ev-1',
          kind: 'worktree_created',
          at: '2026-08-17T07:00:00Z',
          payload: { worktreePath: '/home/dev/.goodboy/sessions/ws/gb-trace' },
        }),
      ],
    });

    expect(model.entries.some((entry) => entry.kind === 'event')).toBe(false);
  });

  it('keeps the session folder row when the container is where the work happens', () => {
    const model = build({
      agents: [],
      worktrees: [worktree({ branch: '' })],
      events: [
        sessionEvent({
          id: 'ev-1',
          kind: 'worktree_created',
          at: '2026-08-17T07:00:00Z',
          payload: { worktreePath: '/home/dev/.goodboy/sessions/ws/gb-trace' },
        }),
      ],
    });

    expect(model.entries.map((entry) => entry.id)).toEqual(['event:ev-1']);
  });

  it('leaves every other event alone on a session with a mounted repo', () => {
    const model = build({
      agents: [],
      worktrees: [worktree({ branch: 'ak/feat', projectId: 'project-1' })],
      events: [
        sessionEvent({ id: 'ev-1', kind: 'pr_merged', at: '2026-08-17T12:00:00Z' }),
        sessionEvent({ id: 'ev-2', kind: 'worktree_created', at: '2026-08-17T07:00:00Z' }),
      ],
    });

    expect(model.entries.flatMap((entry) => (entry.kind === 'event' ? [entry.id] : []))).toEqual([
      'event:ev-1',
    ]);
  });

  it('drops the derived issue row once the link event carries the same url', () => {
    const url = 'https://linear.app/goodboy/issue/GB-1';
    const model = build({
      agents: [],
      externalTasks: [externalTask({ url })],
      events: [
        sessionEvent({
          id: 'ev-1',
          kind: 'issue_linked',
          at: '2026-08-17T07:30:00Z',
          payload: { url, identifier: 'GB-1', title: 'Persist the trace' },
        }),
      ],
    });

    expect(model.entries.map((entry) => entry.kind)).toEqual(['event']);
  });

  it('keeps the derived issue row when the event points at another issue', () => {
    const model = build({
      agents: [],
      externalTasks: [externalTask({ url: 'https://linear.app/goodboy/issue/GB-1' })],
      events: [
        sessionEvent({
          id: 'ev-1',
          kind: 'issue_linked',
          at: '2026-08-17T07:30:00Z',
          payload: { url: 'https://linear.app/goodboy/issue/GB-2' },
        }),
      ],
    });

    expect(model.entries.filter((entry) => entry.kind === 'issue')).toHaveLength(1);
  });
});

describe('buildTimelineGroups, agent chains', () => {
  it('shares one creation-ordered identity sequence across runs and chains', () => {
    const model = build({
      workflows: [
        attachedWorkflow({ createdAt: '2026-08-17T08:00:00Z' }),
        attachedWorkflow({ runId: OTHER_RUN_ID, createdAt: '2026-08-17T10:00:00Z' }),
      ],
      agents: [
        agent({ id: 'planner', ordinal: 0, startedAt: '2026-08-17T09:00:00Z' }),
        agent({
          id: 'implementer',
          ordinal: 1,
          parentAgentId: 'planner',
          startedAt: '2026-08-17T09:30:00Z',
        }),
      ],
    });
    const firstRun = model.entries.find((entry) => entry.id === 'run:run-1');
    const chain = model.entries.find((entry) => entry.id === 'agent:planner');
    const secondRun = model.entries.find((entry) => entry.id === 'run:run-2');
    const seed = runIdentitySeed({ sessionId: SESSION_ID });

    expect(firstRun?.kind === 'run' ? firstRun.identity.index : null).toBe(
      runIdentity({ laneIndex: 0, seed }).index,
    );
    expect(chain?.kind === 'agent' ? chain.chain?.identity.index : null).toBe(
      runIdentity({ laneIndex: 1, seed }).index,
    );
    expect(secondRun?.kind === 'run' ? secondRun.identity.index : null).toBe(
      runIdentity({ laneIndex: 2, seed }).index,
    );
  });

  it('marks a standalone agent with descendants as a chain without renaming it', () => {
    const model = build({
      agents: [
        agent({ id: 'planner', ordinal: 0, startedAt: '2026-08-17T09:00:00Z' }),
        agent({
          id: 'implementer',
          ordinal: 1,
          parentAgentId: 'planner',
          startedAt: '2026-08-17T09:30:00Z',
        }),
      ],
    });
    const root = model.entries.find((entry) => entry.kind === 'agent');

    expect(root?.kind === 'agent' ? root.chain?.identity.index : null).toEqual(expect.any(Number));
    expect(root?.kind === 'agent' ? root.agent.name : null).toBe('planner');
  });

  it('leaves a childless agent without a chain', () => {
    const model = build({
      agents: [agent({ id: 'solo', startedAt: '2026-08-17T09:00:00Z' })],
    });
    const root = model.entries.find((entry) => entry.kind === 'agent');

    expect(root?.kind === 'agent' ? root.chain : 'missing').toBeNull();
  });

  it('leaves a workflow step without a chain so the run keeps its own grammar', () => {
    const model = build({
      workflows: [attachedWorkflow()],
      agents: [
        agent({ id: 'step', startedAt: '2026-08-17T09:00:00Z', workflowRunId: WORKFLOW_RUN_ID }),
        agent({
          id: 'child',
          ordinal: 1,
          parentAgentId: 'step',
          startedAt: '2026-08-17T09:10:00Z',
        }),
      ],
    });
    const run = model.entries.find((entry) => entry.kind === 'run');
    const step = run?.kind === 'run' ? run.children[0] : null;

    expect(step?.kind === 'agent' ? step.chain : 'missing').toBeNull();
  });

  it('carries the same chain down every descendant, however deep', () => {
    const model = build({
      agents: [
        agent({ id: 'one', ordinal: 0, startedAt: '2026-08-17T09:00:00Z' }),
        agent({ id: 'two', ordinal: 1, parentAgentId: 'one', startedAt: '2026-08-17T09:10:00Z' }),
        agent({ id: 'three', ordinal: 2, parentAgentId: 'two', startedAt: '2026-08-17T09:20:00Z' }),
        agent({
          id: 'four',
          ordinal: 3,
          parentAgentId: 'three',
          startedAt: '2026-08-17T09:30:00Z',
        }),
      ],
    });
    const root = model.entries.find((entry) => entry.kind === 'agent');
    const indexes: Array<number | null> = [];
    const walk = (entry: TimelineAgentEntry): void => {
      indexes.push(entry.chain?.identity.index ?? null);
      for (const child of entry.children) {
        walk(child);
      }
    };
    if (root?.kind === 'agent') {
      walk(root);
    }

    expect(indexes).toHaveLength(4);
    expect(new Set(indexes).size).toBe(1);
    expect(indexes[0]).toEqual(expect.any(Number));
  });

  it('leaves the descendants of a workflow step without a chain', () => {
    const model = build({
      workflows: [attachedWorkflow()],
      agents: [
        agent({ id: 'step', startedAt: '2026-08-17T09:00:00Z', workflowRunId: WORKFLOW_RUN_ID }),
        agent({
          id: 'child',
          ordinal: 1,
          parentAgentId: 'step',
          startedAt: '2026-08-17T09:10:00Z',
        }),
      ],
    });
    const run = model.entries.find((entry) => entry.kind === 'run');
    const step = run?.kind === 'run' ? run.children[0] : null;
    const child = step?.kind === 'agent' ? step.children[0] : null;

    expect(child == null ? 'missing' : child.chain).toBeNull();
  });
});
