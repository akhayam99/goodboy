import type { SessionWorktree } from '@goodboy/db';
import type {
  Agent,
  OpenQuestion,
  PlanWithCount,
  SessionExternalTask,
  Workflow,
  WorkflowRun,
} from '@goodboy/types';
import { classifyAgent, type AgentKind } from '../agent-kind';
import { attachedQuestionsFor } from './attachedQuestions';
import { resolveAgentCreation, type AgentCreation } from './agentCreation';
import { runIdentity, type RunIdentity } from './runIdentity';

export type TimelineAgentEntry = {
  readonly kind: 'agent';
  readonly id: string;
  readonly at: string | null;
  readonly ordinal: number;
  readonly agent: Agent;
  readonly agentKind: AgentKind;
  readonly stepLabel: string | null;
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
  readonly terminalQuestions: ReadonlyArray<OpenQuestion>;
  readonly children: ReadonlyArray<TimelineAgentEntry>;
  readonly answers: ReadonlyArray<TimelineAnswerEntry>;
  readonly hasDuration: boolean;
};

export type TimelinePlanEntry = {
  readonly kind: 'plan';
  readonly id: string;
  readonly at: string;
  readonly plan: PlanWithCount;
};

export type TimelineIssueEntry = {
  readonly kind: 'issue';
  readonly id: string;
  readonly at: string;
  readonly task: SessionExternalTask;
};

export type TimelineBranchEntry = {
  readonly kind: 'branch';
  readonly id: string;
  readonly at: string;
  readonly worktree: SessionWorktree;
};

export type TimelineAnswerEntry = {
  readonly kind: 'answer';
  readonly id: string;
  readonly at: string;
  readonly question: OpenQuestion;
};

type TimelineRunChild = TimelineAgentEntry | TimelinePlanEntry;

export type TimelineRunEntry = {
  readonly kind: 'run';
  readonly id: string;
  readonly at: string;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly identity: RunIdentity;
  readonly children: ReadonlyArray<TimelineRunChild>;
  readonly producedPlan: PlanWithCount | null;
};

export type TimelineTopLevelEntry =
  | TimelineAgentEntry
  | TimelinePlanEntry
  | TimelineIssueEntry
  | TimelineBranchEntry
  | TimelineRunEntry;

export type TimelineModel = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
};

type AttachedWorkflow = {
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
};

type Params = {
  readonly agents: ReadonlyArray<Agent>;
  readonly workflows: ReadonlyArray<AttachedWorkflow>;
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly externalTasks: ReadonlyArray<SessionExternalTask>;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly worktrees: ReadonlyArray<SessionWorktree>;
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
};

type WorktreeParams = {
  readonly worktree: SessionWorktree;
};

type SortableEntry = {
  readonly at: string | null;
  readonly ordinal: number;
  readonly id: string;
};

const timestampForWorktree = ({ worktree }: WorktreeParams): string =>
  new Date(worktree.createdAt).toISOString();

type BuildAnswersParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly parentId: string;
};

const buildAnswers = ({
  questions,
  parentId,
}: BuildAnswersParams): ReadonlyArray<TimelineAnswerEntry> =>
  questions.flatMap((question) => {
    if (question.status !== 'answered' || question.answeredAt == null) {
      return [];
    }
    return [
      {
        kind: 'answer',
        id: `answer:${parentId}:${question.id}`,
        at: question.answeredAt,
        question,
      },
    ];
  });

const compareNewestFirst = (first: SortableEntry, second: SortableEntry): number => {
  if (first.at != null && second.at != null && first.at !== second.at) {
    return second.at.localeCompare(first.at);
  }
  if (first.at == null && second.at != null) {
    return -1;
  }
  if (first.at != null && second.at == null) {
    return 1;
  }
  return second.ordinal - first.ordinal || first.id.localeCompare(second.id);
};

export const buildTimelineGroups = ({
  agents,
  workflows,
  plans,
  externalTasks,
  questions,
  worktrees,
  agentKindOverride,
}: Params): TimelineModel => {
  const liveAgents = agents.filter((agent) => agent.deletedAt == null);
  const creations = resolveAgentCreation({ agents: liveAgents });
  const byOrdinal = [...liveAgents].sort((first, second) => first.ordinal - second.ordinal);

  const childrenByParentId = new Map<string, ReadonlyArray<Agent>>();
  for (const agent of byOrdinal) {
    if (agent.parentAgentId == null) {
      continue;
    }
    const siblings = childrenByParentId.get(agent.parentAgentId) ?? [];
    childrenByParentId.set(agent.parentAgentId, [...siblings, agent]);
  }

  const stepsByRunId = new Map<string, ReadonlyArray<Agent>>();
  for (const agent of byOrdinal) {
    if (agent.parentAgentId != null || agent.workflowRunId == null || agent.stepId == null) {
      continue;
    }
    const steps = stepsByRunId.get(agent.workflowRunId) ?? [];
    stepsByRunId.set(agent.workflowRunId, [...steps, agent]);
  }

  const creationOf = ({ agent }: { readonly agent: Agent }): AgentCreation =>
    creations.get(agent.id) ?? { at: null, ordinal: agent.ordinal, isRecorded: false };

  const buildAgentEntry = ({
    agent,
    stepLabel,
  }: {
    readonly agent: Agent;
    readonly stepLabel: string | null;
  }): TimelineAgentEntry => {
    const creation = creationOf({ agent });
    const attachedQuestions = attachedQuestionsFor({ questions, agent });
    const entryId = `agent:${agent.id}`;
    const childAgents = childrenByParentId.get(agent.id) ?? [];
    const children = childAgents
      .map((child, index) =>
        buildAgentEntry({
          agent: child,
          stepLabel: stepLabel == null ? null : `${stepLabel}.${index + 1}`,
        }),
      )
      .sort(compareNewestFirst);
    return {
      kind: 'agent',
      id: entryId,
      at: creation.at,
      ordinal: agent.ordinal,
      agent,
      agentKind: classifyAgent(agent, agentKindOverride[agent.id] ?? null),
      stepLabel,
      openQuestions: attachedQuestions.filter((question) => question.status === 'open'),
      terminalQuestions: attachedQuestions.filter((question) => question.status !== 'open'),
      children,
      answers: buildAnswers({ questions: attachedQuestions, parentId: entryId }),
      hasDuration: agent.startedAt != null && agent.completedAt != null,
    };
  };

  const runEntries: ReadonlyArray<TimelineRunEntry> = workflows.flatMap(({ run, workflow }) => {
    if (run.createdAt == null) {
      return [];
    }
    const steps = stepsByRunId.get(run.id) ?? [];
    const stepEntries = steps.map((agent, index) =>
      buildAgentEntry({ agent, stepLabel: `${index + 1}` }),
    );
    const runPlans: ReadonlyArray<TimelinePlanEntry> = plans
      .filter((plan) => plan.workflowRunId === run.id)
      .map((plan) => ({ kind: 'plan', id: `plan:${plan.id}`, at: plan.createdAt, plan }));
    const children: ReadonlyArray<TimelineRunChild> = [...stepEntries, ...runPlans].sort(
      (first, second) =>
        compareNewestFirst(
          { at: first.at, ordinal: first.kind === 'agent' ? first.ordinal : 0, id: first.id },
          { at: second.at, ordinal: second.kind === 'agent' ? second.ordinal : 0, id: second.id },
        ),
    );
    const producedPlan =
      [...plans]
        .filter((plan) => plan.workflowRunId === run.id)
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0] ?? null;
    return [
      {
        kind: 'run',
        id: `run:${run.id}`,
        at: run.createdAt,
        run,
        workflow,
        identity: runIdentity({ runId: run.id }),
        children,
        producedPlan,
      },
    ];
  });

  const runIds = new Set(runEntries.map((entry) => entry.run.id));
  const groupedPlanIds = new Set(
    runEntries
      .flatMap((entry) => entry.children)
      .flatMap((child) => (child.kind === 'plan' ? [child.plan.id] : [])),
  );
  const standaloneAgents = byOrdinal
    .filter(
      (agent) =>
        agent.parentAgentId == null &&
        !(agent.workflowRunId != null && agent.stepId != null && runIds.has(agent.workflowRunId)),
    )
    .map((agent) => buildAgentEntry({ agent, stepLabel: null }));
  const standalonePlans: ReadonlyArray<TimelinePlanEntry> = plans
    .filter((plan) => !groupedPlanIds.has(plan.id))
    .map((plan) => ({ kind: 'plan', id: `plan:${plan.id}`, at: plan.createdAt, plan }));
  const issues: ReadonlyArray<TimelineIssueEntry> = externalTasks.map((task) => ({
    kind: 'issue',
    id: `issue:${task.provider}:${task.externalId}`,
    at: task.createdAt,
    task,
  }));
  const branches: ReadonlyArray<TimelineBranchEntry> = worktrees.map((worktree) => ({
    kind: 'branch',
    id: `branch:${worktree.id}`,
    at: timestampForWorktree({ worktree }),
    worktree,
  }));

  const entries = [
    ...runEntries,
    ...standaloneAgents,
    ...standalonePlans,
    ...issues,
    ...branches,
  ].sort((first, second) =>
    compareNewestFirst(
      { at: first.at, ordinal: first.kind === 'agent' ? first.ordinal : 0, id: first.id },
      { at: second.at, ordinal: second.kind === 'agent' ? second.ordinal : 0, id: second.id },
    ),
  );

  return { entries };
};
