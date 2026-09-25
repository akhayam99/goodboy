import type {
  Agent,
  AgentId,
  EffortLevel,
  ImplementationCluster,
  PlanWithCount,
} from '@goodboy/types';
import { resolveAgentRowState } from '../../../workTreeModel/rowState';
import { ROW_NODE_LABEL, rowStateNode, type RowNode } from '../../../workTreeModel/rowStateCopy';

export type PlanPartRow = Readonly<{
  index: number;
  title: string;
  instructions: string;
  doneWhen: ReadonlyArray<string>;
  touches: ReadonlyArray<string>;
  node: RowNode;
  agentId: AgentId | null;
  model: string | null;
  effort: EffortLevel | null;
}>;

type Params = Readonly<{
  plan: PlanWithCount;
  agents: ReadonlyArray<Agent>;
  askingAgentIds: ReadonlySet<AgentId>;
}>;

const NOT_STARTED: RowNode = { state: 'queued', label: ROW_NODE_LABEL.queued };

const runnerOf = ({ plan, agents }: Omit<Params, 'askingAgentIds'>): Agent | null => {
  const consumer = plan.lastConsumer ?? null;
  if (consumer === null || plan.consumptionCount === 0) {
    return null;
  }
  return agents.find((agent) => agent.id === consumer.agentId) ?? null;
};

const agentsForParts = ({
  runner,
  agents,
  count,
}: {
  readonly runner: Agent | null;
  readonly agents: ReadonlyArray<Agent>;
  readonly count: number;
}): ReadonlyArray<Agent | null> => {
  if (runner === null) {
    return Array.from({ length: count }, () => null);
  }
  const children = agents
    .filter((agent) => agent.parentAgentId === runner.id && agent.deletedAt == null)
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal);
  if (count === 1 || children.length === 0) {
    return Array.from({ length: count }, (_, index) => (index === 0 ? runner : null));
  }
  return Array.from({ length: count }, (_, index) => children[index] ?? null);
};

const listOf = (values: ReadonlyArray<string> | undefined): ReadonlyArray<string> =>
  (values ?? []).map((value) => value.trim()).filter((value) => value.length > 0);

const routingOf = ({
  cluster,
  agent,
}: {
  readonly cluster: ImplementationCluster;
  readonly agent: Agent | null;
}): Pick<PlanPartRow, 'model' | 'effort'> => {
  if (agent !== null && agent.modelOverride !== undefined) {
    return { model: agent.modelOverride, effort: agent.effort ?? null };
  }
  const pick = cluster.routingProposal?.pick ?? null;
  return pick === null ? { model: null, effort: null } : { model: pick.model, effort: pick.effort };
};

export const planPartRows = ({
  plan,
  agents,
  askingAgentIds,
}: Params): ReadonlyArray<PlanPartRow> => {
  const clusters = plan.clusters ?? [];
  const runner = runnerOf({ plan, agents });
  const carriers = agentsForParts({ runner, agents, count: clusters.length });
  return clusters.map((cluster, index) => {
    const agent = carriers[index] ?? null;
    const node =
      agent === null
        ? NOT_STARTED
        : rowStateNode({
            state: resolveAgentRowState({
              agent,
              isAsking: askingAgentIds.has(agent.id),
              question: null,
              isReadyStep: false,
            }),
          });
    return {
      index,
      title: cluster.title,
      instructions: cluster.instructions,
      doneWhen: listOf(cluster.doneWhen),
      touches: listOf(cluster.touches),
      node,
      agentId: agent?.id ?? null,
      ...routingOf({ cluster, agent }),
    };
  });
};

export type PlanPartsProgress =
  | Readonly<{ kind: 'notRun'; total: number }>
  | Readonly<{ kind: 'failed'; part: number; total: number }>
  | Readonly<{ kind: 'question'; part: number; total: number }>
  | Readonly<{ kind: 'running'; part: number; total: number }>
  | Readonly<{ kind: 'waiting'; done: number; total: number }>
  | Readonly<{ kind: 'done'; total: number }>;

const firstPart = ({
  rows,
  state,
}: {
  readonly rows: ReadonlyArray<PlanPartRow>;
  readonly state: RowNode['state'];
}): number | null => {
  const found = rows.find((row) => row.node.state === state);
  return found === undefined ? null : found.index + 1;
};

export const planPartsProgress = ({
  rows,
  hasRun,
}: {
  readonly rows: ReadonlyArray<PlanPartRow>;
  readonly hasRun: boolean;
}): PlanPartsProgress => {
  const total = rows.length;
  if (!hasRun) {
    return { kind: 'notRun', total };
  }
  const failed = firstPart({ rows, state: 'failed' });
  if (failed !== null) {
    return { kind: 'failed', part: failed, total };
  }
  const question = firstPart({ rows, state: 'question' });
  if (question !== null) {
    return { kind: 'question', part: question, total };
  }
  const running = firstPart({ rows, state: 'running' });
  if (running !== null) {
    return { kind: 'running', part: running, total };
  }
  const done = rows.filter((row) => row.node.state === 'done').length;
  return done === total ? { kind: 'done', total } : { kind: 'waiting', done, total };
};

export const planPartsSentence = ({
  progress,
}: {
  readonly progress: PlanPartsProgress;
}): string => {
  switch (progress.kind) {
    case 'notRun':
      return progress.total === 1 ? '1 part' : `${progress.total} parts`;
    case 'failed':
      return `Part ${progress.part} failed`;
    case 'question':
      return `Part ${progress.part} needs your answer`;
    case 'running':
      return `Running part ${progress.part} of ${progress.total}`;
    case 'waiting':
      return `${progress.done} of ${progress.total} parts done`;
    case 'done':
      return `Ran · ${progress.total} of ${progress.total} parts done`;
    default: {
      const exhaustive: never = progress;
      return exhaustive;
    }
  }
};

export const planSplitSentence = ({
  count,
  plannerName,
}: {
  readonly count: number;
  readonly plannerName: string | null;
}): string => {
  if (count === 1) {
    return 'Runs as one part, in a single implementer.';
  }
  const who = plannerName ?? 'The planner';
  return `${who} split this plan into ${count} parts. They run in order, each as its own subagent.`;
};
