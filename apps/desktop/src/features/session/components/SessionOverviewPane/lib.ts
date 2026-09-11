import type { Agent, AgentId, OpenQuestion, SessionStageInfo } from '@goodboy/types';
import { agentHasUnread } from '../../../../store/slices/agents/agentHasUnread';
import type { LensKind } from '../../../../store';
import type { AgentHomeLens } from '../../agent-kind';

export type AttentionAgent = {
  readonly agentId: AgentId;
  readonly home: AgentHomeLens;
};

export type AttentionTarget =
  | { readonly kind: 'lens'; readonly lens: LensKind; readonly label: string }
  | {
      readonly kind: 'agent';
      readonly agentId: AgentId;
      readonly home: AgentHomeLens;
      readonly label: string;
    };

type PickParams = {
  readonly stage: SessionStageInfo;
  readonly agents: ReadonlyArray<Agent>;
};

export const attentionAgentId = ({ stage, agents }: PickParams): AgentId | null => {
  if (stage.attention === 'agent-error') {
    return agents.filter((agent) => agent.status === 'failed').at(-1)?.id ?? null;
  }
  if (stage.attention === 'unread-reply') {
    return agents.filter((agent) => agentHasUnread(agent, false)).at(-1)?.id ?? null;
  }
  return null;
};

type TargetParams = {
  readonly stage: SessionStageInfo;
  readonly agent: AttentionAgent | null;
};

export const resolveAttentionTarget = ({ stage, agent }: TargetParams): AttentionTarget | null => {
  const { attention } = stage;
  if (attention === null) {
    return null;
  }
  if (attention === 'open-question') {
    return { kind: 'lens', lens: 'questions', label: 'Answer it' };
  }
  if (
    attention === 'ci-failed' ||
    attention === 'changes-requested' ||
    attention === 'pr-approved'
  ) {
    return { kind: 'lens', lens: 'pr', label: 'Open the pull request' };
  }
  if (attention === 'agent-error') {
    return agent === null
      ? { kind: 'lens', lens: 'agents', label: 'Open the agents' }
      : { kind: 'agent', agentId: agent.agentId, home: agent.home, label: 'Open the failed turn' };
  }
  if (attention === 'unread-reply') {
    return agent === null
      ? { kind: 'lens', lens: 'agents', label: 'Open the agents' }
      : { kind: 'agent', agentId: agent.agentId, home: agent.home, label: 'Read the reply' };
  }
  const exhaustive: never = attention;
  return exhaustive;
};

export const selectOpenQuestions = (
  questions: ReadonlyArray<OpenQuestion>,
): ReadonlyArray<OpenQuestion> => questions.filter((q) => q.status === 'open');
