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

export type TimelineAgentEntry = {
  readonly kind: 'agent';
  readonly id: string;
  readonly at: string;
  readonly agent: Agent;
  readonly agentKind: AgentKind;
  readonly depth: 0 | 1 | 2;
  readonly clusterIndex: number | null;
  readonly terminalQuestions: ReadonlyArray<OpenQuestion>;
  readonly answers: ReadonlyArray<TimelineAnswerEntry>;
  readonly hasDuration: boolean;
};

export type TimelinePlanEntry = {
  readonly kind: 'plan';
  readonly id: string;
  readonly at: string;
  readonly plan: PlanWithCount;
  readonly depth: 0 | 1;
};

export type TimelineIssueEntry = {
  readonly kind: 'issue';
  readonly id: string;
  readonly at: string;
  readonly task: SessionExternalTask;
  readonly depth: 0;
};

export type TimelineBranchEntry = {
  readonly kind: 'branch';
  readonly id: string;
  readonly at: string;
  readonly worktree: SessionWorktree;
  readonly depth: 0;
};

export type TimelineAnswerEntry = {
  readonly kind: 'answer';
  readonly id: string;
  readonly at: string;
  readonly question: OpenQuestion;
  readonly depth: 1 | 2;
};

export type TimelineChildEntry = TimelineAgentEntry | TimelinePlanEntry | TimelineAnswerEntry;

export type TimelineRunEntry = {
  readonly kind: 'run';
  readonly id: string;
  readonly at: string;
  readonly run: WorkflowRun;
  readonly workflow: Workflow;
  readonly children: ReadonlyArray<TimelineChildEntry>;
  readonly pendingAgents: ReadonlyArray<Agent>;
  readonly producedPlan: PlanWithCount | null;
  readonly depth: 0;
};

export type TimelineTopLevelEntry =
  | TimelineAgentEntry
  | TimelinePlanEntry
  | TimelineIssueEntry
  | TimelineBranchEntry
  | TimelineRunEntry;

export type TimelineNowAgent = {
  readonly kind: 'agent';
  readonly id: string;
  readonly agent: Agent;
};

export type TimelineNowQuestion = {
  readonly kind: 'question';
  readonly id: string;
  readonly question: OpenQuestion;
};

export type TimelineNowItem = TimelineNowAgent | TimelineNowQuestion;

export type TimelineModel = {
  readonly now: ReadonlyArray<TimelineNowItem>;
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

type AgentPlacement = {
  readonly at: string | null;
  readonly hasDuration: boolean;
};

type AgentParams = {
  readonly agent: Agent;
};

type WorktreeParams = {
  readonly worktree: SessionWorktree;
};

type CompareParams = {
  readonly first: TimelineChildEntry;
  readonly second: TimelineChildEntry;
};

const placementForAgent = ({ agent }: AgentParams): AgentPlacement => {
  if (agent.startedAt != null) {
    return { at: agent.startedAt, hasDuration: true };
  }
  if (agent.completedAt != null) {
    return { at: agent.completedAt, hasDuration: false };
  }
  return { at: null, hasDuration: false };
};

const timestampForWorktree = ({ worktree }: WorktreeParams): string =>
  new Date(worktree.createdAt).toISOString();

const compareAscending = ({ first, second }: CompareParams): number => {
  const byTime = first.at.localeCompare(second.at);
  if (byTime !== 0) {
    return byTime;
  }
  if (first.kind === 'agent' && second.kind === 'agent') {
    return first.agent.ordinal - second.agent.ordinal || first.id.localeCompare(second.id);
  }
  return first.id.localeCompare(second.id);
};

type QuestionAttachParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly agent: Agent;
};

const attachedQuestionsFor = ({
  questions,
  agent,
}: QuestionAttachParams): ReadonlyArray<OpenQuestion> => {
  const direct = questions.filter((question) => question.createdByAgentId === agent.id);
  const inferred =
    agent.workflowRunId == null
      ? []
      : questions.filter(
          (question) =>
            question.createdByAgentId == null &&
            question.workflowRunId === agent.workflowRunId &&
            question.createdByStepOrdinal === agent.ordinal,
        );
  return [...direct, ...inferred];
};

type BuildAnswersParams = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly parentId: string;
  readonly depth: 1 | 2;
};

const buildAnswers = ({
  questions,
  parentId,
  depth,
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
        depth,
      },
    ];
  });

export const buildTimelineGroups = ({
  agents,
  workflows,
  plans,
  externalTasks,
  questions,
  worktrees,
  agentKindOverride,
}: Params): TimelineModel => {
  const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
  const childrenByParentId = new Map<string, ReadonlyArray<Agent>>();
  for (const agent of agents) {
    if (agent.parentAgentId == null) {
      continue;
    }
    const children = childrenByParentId.get(agent.parentAgentId) ?? [];
    childrenByParentId.set(agent.parentAgentId, [...children, agent]);
  }

  const agentEntries: ReadonlyArray<TimelineAgentEntry> = agents.flatMap((agent) => {
    if (agent.deletedAt != null) {
      return [];
    }
    const placement = placementForAgent({ agent });
    if (placement.at == null) {
      return [];
    }
    const parent =
      agent.parentAgentId != null ? (agentsById.get(agent.parentAgentId) ?? null) : null;
    const isClusterBlock =
      parent != null &&
      classifyAgent(parent, agentKindOverride[parent.id] ?? null) === 'implementer';
    if (parent != null && !isClusterBlock) {
      return [];
    }
    const siblings = parent != null ? (childrenByParentId.get(parent.id) ?? []) : [];
    const clusterIndex = isClusterBlock
      ? [...siblings]
          .sort((first, second) => first.ordinal - second.ordinal)
          .findIndex((sibling) => sibling.id === agent.id) + 1
      : null;
    const attachedQuestions = attachedQuestionsFor({ questions, agent });
    const terminalQuestions = attachedQuestions.filter((question) => question.status !== 'open');
    const depth: 0 | 1 | 2 = isClusterBlock ? 2 : agent.workflowRunId != null ? 1 : 0;
    const answerDepth: 1 | 2 = depth === 2 ? 2 : depth === 1 ? 2 : 1;
    const entryId = `agent:${agent.id}`;
    const answers = buildAnswers({
      questions: attachedQuestions,
      parentId: entryId,
      depth: answerDepth,
    });
    return [
      {
        kind: 'agent',
        id: entryId,
        at: placement.at,
        agent,
        agentKind: classifyAgent(agent, agentKindOverride[agent.id] ?? null),
        depth,
        clusterIndex,
        terminalQuestions,
        answers,
        hasDuration: placement.hasDuration,
      },
    ];
  });

  const runEntries: ReadonlyArray<TimelineRunEntry> = workflows.flatMap(({ run, workflow }) => {
    const runAgents = agentEntries.filter((entry) => entry.agent.workflowRunId === run.id);
    const runPlans: ReadonlyArray<TimelinePlanEntry> = plans
      .filter((plan) => plan.workflowRunId === run.id)
      .map((plan) => ({ kind: 'plan', id: `plan:${plan.id}`, at: plan.createdAt, plan, depth: 1 }));
    const runAnswers: ReadonlyArray<TimelineAnswerEntry> = runAgents.flatMap(
      (entry) => entry.answers,
    );
    const children = [...runAgents, ...runPlans, ...runAnswers].sort((first, second) =>
      compareAscending({ first, second }),
    );
    const pendingAgents = agents
      .filter(
        (candidate) =>
          candidate.deletedAt == null &&
          candidate.workflowRunId === run.id &&
          candidate.parentAgentId == null &&
          placementForAgent({ agent: candidate }).at == null,
      )
      .sort((first, second) => first.ordinal - second.ordinal);
    if (children.length === 0 && pendingAgents.length === 0 && run.createdAt == null) {
      return [];
    }
    const latestChildAt = children.reduce<string | null>(
      (latest, child) => (latest == null || child.at > latest ? child.at : latest),
      null,
    );
    const latestCompletion = runAgents.reduce<string | null>((latest, entry) => {
      const completedAt = entry.agent.completedAt ?? null;
      return completedAt != null && (latest == null || completedAt > latest) ? completedAt : latest;
    }, null);
    const runAt = latestCompletion ?? latestChildAt ?? run.createdAt;
    if (runAt == null) {
      return [];
    }
    const producedPlan =
      [...plans]
        .filter((plan) => plan.workflowRunId === run.id)
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))[0] ?? null;
    return [
      {
        kind: 'run',
        id: `run:${run.id}`,
        at: runAt,
        run,
        workflow,
        children,
        pendingAgents,
        producedPlan,
        depth: 0,
      },
    ];
  });

  const groupedAgentIds = new Set(
    runEntries
      .flatMap((entry) => entry.children)
      .flatMap((entry) => (entry.kind === 'agent' ? [entry.agent.id] : [])),
  );
  const groupedPlanIds = new Set(
    runEntries
      .flatMap((entry) => entry.children)
      .flatMap((entry) => (entry.kind === 'plan' ? [entry.plan.id] : [])),
  );
  const standaloneAgents = agentEntries.filter((entry) => !groupedAgentIds.has(entry.agent.id));
  const standalonePlans: ReadonlyArray<TimelinePlanEntry> = plans
    .filter((plan) => !groupedPlanIds.has(plan.id))
    .map((plan) => ({ kind: 'plan', id: `plan:${plan.id}`, at: plan.createdAt, plan, depth: 0 }));
  const issues: ReadonlyArray<TimelineIssueEntry> = externalTasks.map((task) => ({
    kind: 'issue',
    id: `issue:${task.provider}:${task.externalId}`,
    at: task.createdAt,
    task,
    depth: 0,
  }));
  const branches: ReadonlyArray<TimelineBranchEntry> = worktrees.map((worktree) => ({
    kind: 'branch',
    id: `branch:${worktree.id}`,
    at: timestampForWorktree({ worktree }),
    worktree,
    depth: 0,
  }));
  const entries = [
    ...runEntries,
    ...standaloneAgents,
    ...standalonePlans,
    ...issues,
    ...branches,
  ].sort((first, second) => second.at.localeCompare(first.at) || first.id.localeCompare(second.id));
  const timestampedAgentIds = new Set(agentEntries.map((entry) => entry.agent.id));
  const nowAgents: ReadonlyArray<TimelineNowAgent> = agents.flatMap((agent) => {
    if (
      agent.deletedAt != null ||
      timestampedAgentIds.has(agent.id) ||
      agent.workflowRunId != null
    ) {
      return [];
    }
    return [{ kind: 'agent', id: `agent:${agent.id}`, agent }];
  });
  const nowQuestions: ReadonlyArray<TimelineNowQuestion> = questions
    .filter((question) => question.status === 'open')
    .map((question) => ({ kind: 'question', id: `question:${question.id}`, question }));
  return { now: [...nowQuestions, ...nowAgents], entries };
};
