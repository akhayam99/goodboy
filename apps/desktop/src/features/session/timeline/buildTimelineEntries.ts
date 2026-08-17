import type {
  Agent,
  OpenQuestion,
  PlanWithCount,
  SessionExternalTask,
  Workflow,
  WorkflowRun,
} from '@goodboy/types';
import { classifyAgent, type AgentKind } from '../agent-kind';

export type TimelineAgentEntry = {
  readonly kind: 'agent';
  readonly id: string;
  readonly at: string;
  readonly agent: Agent;
  readonly agentKind: AgentKind;
  readonly depth: 0 | 1;
  readonly workflowRunId: string | null;
  readonly workflowNumber: number | null;
  readonly workflowName: string | null;
  readonly clusterIndex: number | null;
  readonly openQuestions: ReadonlyArray<OpenQuestion>;
  readonly terminalQuestions: ReadonlyArray<OpenQuestion>;
  readonly joinsPrevious: boolean;
  readonly joinsNext: boolean;
};

export type TimelinePlanEntry = {
  readonly kind: 'plan';
  readonly id: string;
  readonly at: string;
  readonly plan: PlanWithCount;
  readonly workflowRunId: string | null;
  readonly joinsPrevious: boolean;
  readonly joinsNext: boolean;
};

export type TimelineIssueEntry = {
  readonly kind: 'issue';
  readonly id: string;
  readonly at: string;
  readonly task: SessionExternalTask;
  readonly workflowRunId: null;
  readonly joinsPrevious: false;
  readonly joinsNext: false;
};

export type TimelineQuestionEntry = {
  readonly kind: 'question';
  readonly id: string;
  readonly at: string;
  readonly question: OpenQuestion;
  readonly workflowRunId: string | null;
  readonly joinsPrevious: boolean;
  readonly joinsNext: boolean;
};

export type TimelineEntry =
  TimelineAgentEntry | TimelinePlanEntry | TimelineIssueEntry | TimelineQuestionEntry;

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
  readonly agentKindOverride: Readonly<Record<string, AgentKind>>;
};

const workflowOrder = ({ workflows }: Pick<Params, 'workflows'>): ReadonlyArray<AttachedWorkflow> =>
  [...workflows].sort((first, second) => {
    const firstAt = first.run.createdAt ?? null;
    const secondAt = second.run.createdAt ?? null;
    if (firstAt == null && secondAt == null) {
      return first.run.ordinal - second.run.ordinal;
    }
    if (firstAt == null) {
      return -1;
    }
    if (secondAt == null) {
      return 1;
    }
    return firstAt.localeCompare(secondAt);
  });

type JoinableEntry = TimelineEntry & {
  readonly workflowRunId: string | null;
};

const withJoins = ({ entries }: { readonly entries: ReadonlyArray<JoinableEntry> }) =>
  entries.map((entry, index) => {
    if (entry.kind === 'issue') {
      return entry;
    }
    const previous = entries[index - 1] ?? null;
    const next = entries[index + 1] ?? null;
    const joinsPrevious =
      entry.workflowRunId != null && previous?.workflowRunId === entry.workflowRunId;
    const joinsNext = entry.workflowRunId != null && next?.workflowRunId === entry.workflowRunId;
    return { ...entry, joinsPrevious, joinsNext };
  });

export const buildTimelineEntries = ({
  agents,
  workflows,
  plans,
  externalTasks,
  questions,
  agentKindOverride,
}: Params): ReadonlyArray<TimelineEntry> => {
  const orderedWorkflows = workflowOrder({ workflows });
  const workflowByRunId = new Map(
    orderedWorkflows.map((attached, index) => [
      attached.run.id,
      { number: index + 1, name: attached.workflow.name },
    ]),
  );
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const childrenByParentId = new Map<string, ReadonlyArray<Agent>>();
  for (const agent of agents) {
    if (agent.parentAgentId == null) {
      continue;
    }
    const children = childrenByParentId.get(agent.parentAgentId) ?? [];
    childrenByParentId.set(agent.parentAgentId, [...children, agent]);
  }
  for (const [parentId, children] of childrenByParentId) {
    childrenByParentId.set(
      parentId,
      [...children].sort((first, second) => first.ordinal - second.ordinal),
    );
  }

  const attachedQuestionIds = new Set<string>();
  const agentEntries = agents.flatMap((agent): ReadonlyArray<TimelineAgentEntry> => {
    if (agent.startedAt == null || agent.deletedAt != null) {
      return [];
    }
    const agentKind = classifyAgent(agent, agentKindOverride[agent.id] ?? null);
    const parent =
      agent.parentAgentId != null ? (agentsById.get(agent.parentAgentId) ?? null) : null;
    const isClusterBlock =
      parent != null &&
      classifyAgent(parent, agentKindOverride[parent.id] ?? null) === 'implementer';
    if (parent != null && !isClusterBlock) {
      return [];
    }
    const workflow =
      agent.workflowRunId != null ? (workflowByRunId.get(agent.workflowRunId) ?? null) : null;
    const siblingIndex =
      isClusterBlock && agent.parentAgentId != null
        ? (childrenByParentId.get(agent.parentAgentId) ?? []).findIndex(
            (sibling) => sibling.id === agent.id,
          ) + 1
        : null;
    const raisedQuestions = questions.filter((question) => {
      if (question.createdByAgentId === agent.id) {
        return true;
      }
      return (
        question.createdByAgentId == null &&
        question.workflowRunId === agent.workflowRunId &&
        question.createdByStepOrdinal === agent.ordinal
      );
    });
    for (const question of raisedQuestions) {
      attachedQuestionIds.add(question.id);
    }
    return [
      {
        kind: 'agent',
        id: `agent:${agent.id}`,
        at: agent.startedAt,
        agent,
        agentKind,
        depth: isClusterBlock ? 1 : 0,
        workflowRunId: agent.workflowRunId ?? null,
        workflowNumber: workflow?.number ?? null,
        workflowName: workflow?.name ?? null,
        clusterIndex: siblingIndex,
        openQuestions: raisedQuestions.filter((question) => question.status === 'open'),
        terminalQuestions: raisedQuestions.filter((question) => question.status !== 'open'),
        joinsPrevious: false,
        joinsNext: false,
      },
    ];
  });
  const planEntries: ReadonlyArray<TimelinePlanEntry> = plans.map((plan) => ({
    kind: 'plan',
    id: `plan:${plan.id}`,
    at: plan.createdAt,
    plan,
    workflowRunId: plan.workflowRunId ?? null,
    joinsPrevious: false,
    joinsNext: false,
  }));
  const issueEntries: ReadonlyArray<TimelineIssueEntry> = externalTasks.map((task) => ({
    kind: 'issue',
    id: `issue:${task.provider}:${task.externalId}`,
    at: task.createdAt,
    task,
    workflowRunId: null,
    joinsPrevious: false,
    joinsNext: false,
  }));
  const questionEntries: ReadonlyArray<TimelineQuestionEntry> = questions.flatMap((question) => {
    if (question.status !== 'open' || attachedQuestionIds.has(question.id)) {
      return [];
    }
    return [
      {
        kind: 'question',
        id: `question:${question.id}`,
        at: question.createdAt,
        question,
        workflowRunId: question.workflowRunId ?? null,
        joinsPrevious: false,
        joinsNext: false,
      },
    ];
  });
  const entries = [...agentEntries, ...planEntries, ...issueEntries, ...questionEntries].sort(
    (first, second) => first.at.localeCompare(second.at) || first.id.localeCompare(second.id),
  );
  return withJoins({ entries });
};
