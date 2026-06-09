import type { Agent, AgentId, OpenQuestion, Step, Workflow } from '@goodboy/types';

export type QuestionCluster = {
  readonly ownerAgentId: AgentId | null;
  readonly ownerAgentName: string | null;
  readonly creatorAgentName: string | null;
  readonly questions: ReadonlyArray<OpenQuestion>;
};

type BuildClustersInput = {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly agents: ReadonlyArray<Agent>;
  readonly workflows: ReadonlyArray<Workflow>;
};

function resolveOwnerAgent(
  q: OpenQuestion,
  stepsByWorkflowOrdinal: ReadonlyMap<string, Step>,
  agentByStepId: ReadonlyMap<string, Agent>,
  agentByRunStep: ReadonlyMap<string, Agent>,
): Agent | null {
  if (!q.workflowId || q.ownedByStepOrdinal == null) return null;
  const stepKey = `${q.workflowId}::${q.ownedByStepOrdinal}`;
  const step = stepsByWorkflowOrdinal.get(stepKey);
  if (!step) return null;
  if (q.workflowRunId) return agentByRunStep.get(`${q.workflowRunId}::${step.id}`) ?? null;
  return agentByStepId.get(step.id) ?? null;
}

export const buildQuestionClusters = ({
  questions,
  agents,
  workflows,
}: BuildClustersInput): ReadonlyArray<QuestionCluster> => {
  const stepsByWorkflowOrdinal = new Map<string, Step>();
  for (const wf of workflows) {
    for (const step of wf.steps) {
      stepsByWorkflowOrdinal.set(`${wf.id}::${step.ordinal}`, step);
    }
  }
  const agentById = new Map<AgentId, Agent>();
  const agentByStepId = new Map<string, Agent>();
  const agentByRunStep = new Map<string, Agent>();
  for (const a of agents) {
    agentById.set(a.id, a);
    if (a.stepId) agentByStepId.set(a.stepId, a);
    if (a.stepId && a.workflowRunId) agentByRunStep.set(`${a.workflowRunId}::${a.stepId}`, a);
  }

  type Bucket = {
    ownerAgentId: AgentId | null;
    ownerAgentName: string | null;
    questions: OpenQuestion[];
    creatorAgentIds: Set<AgentId | null>;
  };
  const buckets = new Map<string, Bucket>();
  const order: string[] = [];

  for (const q of questions) {
    if (q.status !== 'open') continue;
    const owner = resolveOwnerAgent(q, stepsByWorkflowOrdinal, agentByStepId, agentByRunStep);
    const key = owner ? owner.id : '__orphan__';
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        ownerAgentId: owner ? owner.id : null,
        ownerAgentName: owner ? owner.name : null,
        questions: [],
        creatorAgentIds: new Set(),
      };
      buckets.set(key, bucket);
      order.push(key);
    }
    bucket.questions.push(q);
    bucket.creatorAgentIds.add(q.createdByAgentId ?? null);
  }

  const sortedKeys = [...order].sort((a, b) => {
    if (a === '__orphan__') return 1;
    if (b === '__orphan__') return -1;
    return order.indexOf(a) - order.indexOf(b);
  });

  return sortedKeys.map((key): QuestionCluster => {
    const bucket = buckets.get(key)!;
    const creatorIds = [...bucket.creatorAgentIds].filter((id): id is AgentId => id !== null);
    let creatorAgentName: string | null = null;
    if (creatorIds.length === 1) {
      const cid = creatorIds[0]!;
      if (cid !== bucket.ownerAgentId) {
        creatorAgentName = agentById.get(cid)?.name ?? null;
      }
    }
    return {
      ownerAgentId: bucket.ownerAgentId,
      ownerAgentName: bucket.ownerAgentName,
      creatorAgentName,
      questions: bucket.questions,
    };
  });
};
