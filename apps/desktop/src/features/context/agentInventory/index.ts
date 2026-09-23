import {
  buildEvidenceInventory,
  inventoryRevisionOf,
  type EvidenceInventoryInput,
} from '@goodboy/core';
import type {
  Agent,
  AgentId,
  CapabilityObligation,
  ClusterCompletionHold,
  ClusterExecutionGraph,
  ContextSlot,
  EvidenceInventory,
  OpenQuestion,
  PlanWithCount,
} from '@goodboy/types';

const SOURCE_PREVIEW_CHARS = 2000;

export type AgentInventoryAssembly = Readonly<{
  inventory: EvidenceInventory;
  contents: ReadonlyMap<string, string>;
}>;

export type BuildAgentInventoryParams = {
  readonly agentId: AgentId;
  readonly agents: ReadonlyArray<Agent>;
  readonly slots: ReadonlyArray<ContextSlot>;
  readonly deliveredSlotKeys: ReadonlyArray<string>;
  readonly plans: ReadonlyArray<PlanWithCount>;
  readonly questions: ReadonlyArray<OpenQuestion>;
  readonly holds: ReadonlyArray<ClusterCompletionHold>;
  readonly obligations: ReadonlyArray<CapabilityObligation>;
  readonly graphs: ReadonlyArray<ClusterExecutionGraph>;
};

const obligationDetail = ({
  obligation,
}: {
  readonly obligation: CapabilityObligation;
}): string => {
  const owner = obligation.ownerAgentId === null ? 'unowned' : `owner ${obligation.ownerAgentId}`;
  const latest = obligation.requests[obligation.requests.length - 1];
  const scope =
    latest === undefined || latest.scope.length === 0 ? 'no scope' : latest.scope.join(', ');
  const expected =
    latest === undefined || latest.expectedOutput.length === 0
      ? 'no stated result'
      : latest.expectedOutput;
  return `${obligation.targetRole} for ${obligation.purpose}, ${obligation.state}, ${owner}, scope ${scope}, expects ${expected}`;
};

export const buildAgentInventory = ({
  agentId,
  agents,
  slots,
  deliveredSlotKeys,
  plans,
  questions,
  holds,
  obligations,
  graphs,
}: BuildAgentInventoryParams): AgentInventoryAssembly => {
  const inputs: EvidenceInventoryInput[] = [];
  const contents = new Map<string, string>();
  const agent = agents.find((candidate) => candidate.id === agentId) ?? null;

  if (agent !== null) {
    const taskId = `task:${agentId}`;
    inputs.push({
      sourceId: taskId,
      kind: 'task',
      label: agent.name,
      provenance: 'this assignment',
      revision: inventoryRevisionOf({ text: agent.name }),
      availability: 'delivered',
    });
    contents.set(taskId, agent.name);

    const node = graphs
      .flatMap((graph) => graph.graph.nodes.map((entry) => ({ graph, entry })))
      .find((pair) =>
        pair.graph.nodes.some(
          (binding) => binding.agentId === agentId && binding.nodeId === pair.entry.id,
        ),
      );
    const expectedOutput = node?.entry.expectedOutput ?? null;
    if (expectedOutput !== null && expectedOutput.length > 0) {
      const acceptanceId = `acceptance:${agentId}`;
      inputs.push({
        sourceId: acceptanceId,
        kind: 'acceptance',
        label: 'acceptance criteria for this cluster',
        provenance: 'consumed plan graph',
        revision: inventoryRevisionOf({ text: expectedOutput }),
        availability: 'delivered',
      });
      contents.set(acceptanceId, expectedOutput);
    }

    const parent =
      agent.parentAgentId === undefined
        ? null
        : (agents.find((candidate) => candidate.id === agent.parentAgentId) ?? null);
    if (parent !== null) {
      const parentId = `parent:${parent.id}`;
      const summary = parent.outputSummary ?? '';
      inputs.push({
        sourceId: parentId,
        kind: 'parent-instructions',
        label: `instructions from ${parent.name}`,
        provenance: 'parent agent',
        revision: inventoryRevisionOf({ text: summary }),
        availability: summary.length === 0 ? 'unavailable' : 'retrievable',
      });
      if (summary.length > 0) {
        contents.set(parentId, summary);
      }
    }
  }

  const delivered = new Set(deliveredSlotKeys);
  for (const slot of slots) {
    if (slot.enabled === false) {
      continue;
    }
    const slotId = `slot:${slot.key}`;
    inputs.push({
      sourceId: slotId,
      kind: 'context-slot',
      label: slot.key,
      provenance: 'shared context',
      revision: inventoryRevisionOf({ text: slot.value }),
      availability: delivered.has(slot.key) ? 'delivered' : 'retrievable',
    });
    contents.set(slotId, slot.value);
  }

  for (const plan of plans) {
    const planId = `artifact:${plan.id}`;
    const truncated = plan.bodyMd.length > SOURCE_PREVIEW_CHARS;
    inputs.push({
      sourceId: planId,
      kind: 'artifact',
      label: plan.title,
      provenance: `plan by ${plan.agentId}`,
      revision: plan.updatedAt,
      availability: truncated ? 'truncated' : 'retrievable',
    });
    contents.set(planId, plan.bodyMd);
  }

  for (const other of agents) {
    if (other.id === agentId) {
      continue;
    }
    const summary = other.outputSummary ?? '';
    if (summary.length === 0) {
      continue;
    }
    const outputId = `output:${other.id}`;
    inputs.push({
      sourceId: outputId,
      kind: 'prior-output',
      label: other.name,
      provenance: `agent ${other.id}, ${other.status}`,
      revision: inventoryRevisionOf({ text: summary }),
      availability: 'retrievable',
    });
    contents.set(outputId, summary);
  }

  for (const hold of holds) {
    const holdId = `finding:${hold.id}`;
    const body = hold.findings.map((finding) => `${finding.target}: ${finding.reason}`).join('\n');
    inputs.push({
      sourceId: holdId,
      kind: 'finding',
      label: `${hold.reason} on ${hold.sourceAgentId}`,
      provenance: 'cluster completion hold',
      revision: hold.updatedAt,
      availability: 'retrievable',
      detail: `state ${hold.state}`,
    });
    contents.set(holdId, body.length === 0 ? hold.reason : body);
  }

  for (const question of questions) {
    const questionId = `question:${question.id}`;
    inputs.push({
      sourceId: questionId,
      kind: 'question',
      label: question.text,
      provenance: 'open question',
      revision: question.answeredAt ?? question.createdAt,
      availability: 'retrievable',
      detail: `state ${question.status}`,
    });
    contents.set(questionId, question.userAnswer ?? question.text);
  }

  for (const obligation of obligations) {
    const obligationId = `obligation:${obligation.id}`;
    const latest = obligation.requests[obligation.requests.length - 1];
    inputs.push({
      sourceId: obligationId,
      kind: 'obligation',
      label: latest === undefined ? obligation.identity : latest.question,
      provenance: `requested by ${obligation.requesterAgentId}`,
      revision: obligation.updatedAt,
      availability: 'retrievable',
      detail: obligationDetail({ obligation }),
    });
    contents.set(obligationId, obligationDetail({ obligation }));
  }

  return {
    inventory: buildEvidenceInventory({ agentId, inputs }),
    contents,
  };
};
