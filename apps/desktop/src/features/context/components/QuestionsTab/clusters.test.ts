import { describe, expect, it } from 'vitest';
import type {
  Agent,
  AgentId,
  IsoDateTime,
  OpenQuestion,
  OpenQuestionId,
  SessionId,
  Step,
  StepId,
  Workflow,
  WorkflowId,
  WorkspaceId,
} from '@goodboy/types';
import { buildQuestionClusters } from './clusters';

const NOW = '2026-05-26T00:00:00.000Z' as IsoDateTime;
const SESSION = 'sess_1' as SessionId;
const WS = 'ws_1' as WorkspaceId;
const WF_A = 'wf_a' as WorkflowId;
const WF_B = 'wf_b' as WorkflowId;

function step(workflowId: WorkflowId, ordinal: number): Step {
  return {
    id: `${workflowId}_s${ordinal}` as StepId,
    workflowId,
    ordinal,
    name: `step ${ordinal}`,
    promptPrefix: '',
  };
}

function workflow(id: WorkflowId, stepCount: number): Workflow {
  return {
    id,
    workspaceId: WS,
    name: id,
    description: '',
    steps: Array.from({ length: stepCount }, (_, i) => step(id, i)),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function agent(id: string, stepId: StepId | undefined, name: string): Agent {
  return {
    id: id as AgentId,
    sessionId: SESSION,
    stepId,
    ordinal: 0,
    name,
    status: 'completed',
  };
}

function question(
  id: string,
  opts: Partial<OpenQuestion> & { ownedByStepOrdinal?: number; workflowId?: WorkflowId } = {},
): OpenQuestion {
  return {
    id: id as OpenQuestionId,
    sessionId: SESSION,
    text: `q ${id}`,
    suggestedAnswers: [],
    userAnswer: null,
    status: 'open',
    createdAt: NOW,
    ...opts,
  };
}

describe('buildQuestionClusters', () => {
  it('groups questions by current-owner agent', () => {
    const wfA = workflow(WF_A, 2);
    const planner = agent('agent_planner', wfA.steps[0]!.id, 'planner');
    const implementer = agent('agent_impl', wfA.steps[1]!.id, 'implementer');

    const qs: OpenQuestion[] = [
      question('q1', { workflowId: WF_A, ownedByStepOrdinal: 0 }),
      question('q2', { workflowId: WF_A, ownedByStepOrdinal: 0 }),
      question('q3', { workflowId: WF_A, ownedByStepOrdinal: 1 }),
    ];

    const clusters = buildQuestionClusters({
      questions: qs,
      agents: [planner, implementer],
      workflows: [wfA],
    });

    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.ownerAgentName).toBe('planner');
    expect(clusters[0]?.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(clusters[1]?.ownerAgentName).toBe('implementer');
    expect(clusters[1]?.questions.map((q) => q.id)).toEqual(['q3']);
  });

  it('places questions without workflow/ordinal in the orphan cluster', () => {
    const wfA = workflow(WF_A, 1);
    const planner = agent('agent_planner', wfA.steps[0]!.id, 'planner');

    const qs: OpenQuestion[] = [
      question('q1', { workflowId: WF_A, ownedByStepOrdinal: 0 }),
      question('q2'), // legacy / orphan
      question('q3', { workflowId: WF_A, ownedByStepOrdinal: 5 }), // ordinal not in template
    ];

    const clusters = buildQuestionClusters({
      questions: qs,
      agents: [planner],
      workflows: [wfA],
    });

    expect(clusters.map((c) => c.ownerAgentId)).toEqual([planner.id, null]);
    const orphan = clusters.find((c) => c.ownerAgentId === null)!;
    expect(orphan.questions.map((q) => q.id)).toEqual(['q2', 'q3']);
  });

  it('clusters ad-hoc questions by creator agent when there is no workflow owner', () => {
    const scout = agent('agent_scout', undefined, 'scout');
    const fixer = agent('agent_fixer', undefined, 'fixer');

    const qs: OpenQuestion[] = [
      question('q1', { createdByAgentId: scout.id }),
      question('q2', { createdByAgentId: fixer.id }),
      question('q3', { createdByAgentId: scout.id }),
    ];

    const clusters = buildQuestionClusters({
      questions: qs,
      agents: [scout, fixer],
      workflows: [],
    });

    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.ownerAgentId).toBe(scout.id);
    expect(clusters[0]?.ownerAgentName).toBe('scout');
    expect(clusters[0]?.questions.map((q) => q.id)).toEqual(['q1', 'q3']);
    expect(clusters[1]?.ownerAgentId).toBe(fixer.id);
    expect(clusters[1]?.questions.map((q) => q.id)).toEqual(['q2']);
  });

  it('skips dismissed and answered questions', () => {
    const wfA = workflow(WF_A, 1);
    const planner = agent('agent_planner', wfA.steps[0]!.id, 'planner');

    const qs: OpenQuestion[] = [
      question('q1', { workflowId: WF_A, ownedByStepOrdinal: 0, status: 'dismissed' }),
      question('q2', { workflowId: WF_A, ownedByStepOrdinal: 0, status: 'answered' }),
      question('q3', { workflowId: WF_A, ownedByStepOrdinal: 0 }),
    ];

    const clusters = buildQuestionClusters({
      questions: qs,
      agents: [planner],
      workflows: [wfA],
    });
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.questions.map((q) => q.id)).toEqual(['q3']);
  });

  it('shows creator name when ownership was transferred (same workflow, different agent)', () => {
    const wfA = workflow(WF_A, 2);
    const scout = agent('agent_scout', wfA.steps[0]!.id, 'scout');
    const planner = agent('agent_planner', wfA.steps[1]!.id, 'planner');

    const qs: OpenQuestion[] = [
      question('q1', {
        workflowId: WF_A,
        ownedByStepOrdinal: 1, // now owned by planner
        createdByAgentId: scout.id,
        createdByStepOrdinal: 0,
      }),
    ];

    const clusters = buildQuestionClusters({
      questions: qs,
      agents: [scout, planner],
      workflows: [wfA],
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.ownerAgentName).toBe('planner');
    expect(clusters[0]?.creatorAgentName).toBe('scout');
  });

  it('does not show creator name when owner == creator (no transfer)', () => {
    const wfA = workflow(WF_A, 1);
    const planner = agent('agent_planner', wfA.steps[0]!.id, 'planner');

    const qs: OpenQuestion[] = [
      question('q1', {
        workflowId: WF_A,
        ownedByStepOrdinal: 0,
        createdByAgentId: planner.id,
        createdByStepOrdinal: 0,
      }),
    ];

    const clusters = buildQuestionClusters({
      questions: qs,
      agents: [planner],
      workflows: [wfA],
    });
    expect(clusters[0]?.creatorAgentName).toBeNull();
  });

  it('separates clusters across workflows', () => {
    const wfA = workflow(WF_A, 1);
    const wfB = workflow(WF_B, 1);
    const agentA = agent('agent_a', wfA.steps[0]!.id, 'agent A');
    const agentB = agent('agent_b', wfB.steps[0]!.id, 'agent B');

    const qs: OpenQuestion[] = [
      question('q1', { workflowId: WF_A, ownedByStepOrdinal: 0 }),
      question('q2', { workflowId: WF_B, ownedByStepOrdinal: 0 }),
    ];
    const clusters = buildQuestionClusters({
      questions: qs,
      agents: [agentA, agentB],
      workflows: [wfA, wfB],
    });
    expect(clusters.map((c) => c.ownerAgentName)).toEqual(['agent A', 'agent B']);
  });
});
