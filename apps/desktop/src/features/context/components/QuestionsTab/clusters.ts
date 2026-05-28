import type { Agent, AgentId, OpenQuestion, Step, Workflow } from '@goodboy/types';

export interface QuestionCluster {
  // The agent the cluster's batched answer will be sent to. `null` for the
  // orphan bucket: questions without provenance (legacy rows, ad-hoc
  // creator agents, or owners that no longer have a spawned step), those
  // fall back to the currently-selected chat on submit.
  readonly ownerAgentId: AgentId | null;
  readonly ownerAgentName: string | null;
  // Optional creator display when the question has been transferred to a
  // later step in the same workflow: lets the UI annotate "originally
  // raised by <creator>". Only set on clusters where every question in
  // the cluster shares the same creator and that creator differs from the
  // owner, keeps the header honest without averaging across mixed
  // origins.
  readonly creatorAgentName: string | null;
  readonly questions: ReadonlyArray<OpenQuestion>;
}

interface BuildClustersInput {
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly agents: ReadonlyArray<Agent>;
  readonly workflows: ReadonlyArray<Workflow>;
}

// Maps a question to the currently-owning agent (via workflow_id +
// owned_by_step_ordinal → step → spawned agent for that step). Returns
// null when ownership can't be resolved: orphan question (no workflow),
// owning step not in template (rare, template edited after question
// emitted), or no spawned agent for that step yet (e.g. user transferred
// ownership to a step whose agent slot is still unsoawned).
function resolveOwnerAgent(
  q: OpenQuestion,
  stepsByWorkflowOrdinal: ReadonlyMap<string, Step>,
  agentByStepId: ReadonlyMap<string, Agent>,
): Agent | null {
  if (!q.workflowId || q.ownedByStepOrdinal == null) return null;
  const stepKey = `${q.workflowId}::${q.ownedByStepOrdinal}`;
  const step = stepsByWorkflowOrdinal.get(stepKey);
  if (!step) return null;
  return agentByStepId.get(step.id) ?? null;
}

// Groups open questions by their current owner agent so the QuestionsTab
// can render one card stack per owner with its own "send" button. The
// returned order is: real owners (insertion order, first time we see
// each owner agent in the questions list), then orphans.
export function buildQuestionClusters({
  questions,
  agents,
  workflows,
}: BuildClustersInput): ReadonlyArray<QuestionCluster> {
  const stepsByWorkflowOrdinal = new Map<string, Step>();
  for (const wf of workflows) {
    for (const step of wf.steps) {
      stepsByWorkflowOrdinal.set(`${wf.id}::${step.ordinal}`, step);
    }
  }
  const agentById = new Map<AgentId, Agent>();
  const agentByStepId = new Map<string, Agent>();
  for (const a of agents) {
    agentById.set(a.id, a);
    if (a.stepId) agentByStepId.set(a.stepId, a);
  }

  // ownerKey → { ownerAgentId, ownerAgentName, questions[], creatorIds }
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
    const owner = resolveOwnerAgent(q, stepsByWorkflowOrdinal, agentByStepId);
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

  // Sort: real-owner clusters first in insertion order, orphan last.
  const sortedKeys = [...order].sort((a, b) => {
    if (a === '__orphan__') return 1;
    if (b === '__orphan__') return -1;
    return order.indexOf(a) - order.indexOf(b);
  });

  return sortedKeys.map((key): QuestionCluster => {
    const bucket = buckets.get(key)!;
    // Show creator label only if the cluster has a single creator AND it
    // differs from the owner, that's the "transferred ownership" case
    // worth surfacing in the header.
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
}
