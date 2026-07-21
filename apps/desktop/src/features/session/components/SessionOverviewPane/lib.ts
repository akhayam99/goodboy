import type { Agent, OpenQuestion, SessionStageInfo } from '@goodboy/types';
import { classifyAgent, type AgentKind } from '../../agent-kind';

export type AttentionSummary = {
  readonly active: boolean;
  readonly reason: string;
};

export const isStandaloneAgent = (agent: Agent): boolean =>
  agent.parentAgentId == null && !(agent.workflowRunId != null && agent.stepId != null);

export const selectStandaloneAgents = (agents: ReadonlyArray<Agent>): ReadonlyArray<Agent> =>
  agents.filter(isStandaloneAgent);

export const selectNonResolverStandaloneAgents = (
  agents: ReadonlyArray<Agent>,
  agentKindOverride: Readonly<Record<string, AgentKind>>,
): ReadonlyArray<Agent> =>
  agents.filter(
    (a) => isStandaloneAgent(a) && classifyAgent(a, agentKindOverride[a.id] ?? null) !== 'resolver',
  );

export const selectAttention = (stage: SessionStageInfo): AttentionSummary => ({
  active: stage.stage === 'attention',
  reason: stage.reason,
});

export type AttentionLens = 'agents' | 'workflows' | 'questions' | 'pr' | 'resolve';

export const resolveAttentionLens = (
  stage: SessionStageInfo,
  ctx: {
    readonly hasNonResolverStandalone: boolean;
    readonly hasWorkflow: boolean;
    readonly hasResolver: boolean;
    readonly unreadLens: 'agents' | 'resolve' | 'workflows' | null;
  },
): AttentionLens | null => {
  if (stage.stage !== 'attention') {
    return null;
  }
  if (stage.reason.startsWith('PR')) {
    return 'pr';
  }
  if (stage.reason.includes('question')) {
    return 'questions';
  }
  if (stage.reason === 'unread agent reply' && ctx.unreadLens != null) {
    return ctx.unreadLens;
  }
  if (ctx.hasNonResolverStandalone) {
    return 'agents';
  }
  if (ctx.hasResolver) {
    return 'resolve';
  }
  if (ctx.hasWorkflow) {
    return 'workflows';
  }
  return null;
};

export const selectOpenQuestions = (
  questions: ReadonlyArray<OpenQuestion>,
): ReadonlyArray<OpenQuestion> => questions.filter((q) => q.status === 'open');
