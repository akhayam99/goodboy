import { isAgentStatusHalted } from '@goodboy/core';
import type { Agent, TurnState } from '@goodboy/types';

type AgentParams = {
  readonly agent: Agent;
};

type TurnParams = {
  readonly turnState: TurnState | null | undefined;
};

type FinishedParams = AgentParams & {
  readonly hasOpenQuestion: boolean;
  readonly isTurnLive: boolean;
  readonly hasActiveChild: boolean;
  readonly isResolverSettled?: boolean;
};

type ClosableParams = AgentParams & {
  readonly hasOpenQuestion: boolean;
  readonly isTurnLive: boolean;
};

export const isTurnStateLive = ({ turnState }: TurnParams): boolean =>
  turnState?.kind === 'starting' || turnState?.kind === 'running';

export const isAgentClosedByUser = ({ agent }: AgentParams): boolean =>
  agent.doneAt != null && agent.status !== 'completed' && agent.status !== 'skipped';

export const isAgentFinished = ({
  agent,
  hasOpenQuestion,
  isTurnLive,
  hasActiveChild,
  isResolverSettled = false,
}: FinishedParams): boolean => {
  if (agent.doneAt != null || isResolverSettled) {
    return true;
  }
  return agent.status === 'completed' && !hasOpenQuestion && !isTurnLive && !hasActiveChild;
};

export const isAgentClosable = ({
  agent,
  hasOpenQuestion,
  isTurnLive,
}: ClosableParams): boolean => {
  if (agent.workflowRunId != null || agent.doneAt != null) {
    return false;
  }
  if (isTurnLive || agent.status === 'running') {
    return false;
  }
  return isAgentStatusHalted({ status: agent.status }) || hasOpenQuestion;
};
