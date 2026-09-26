import type { Agent } from '@goodboy/types';
import type { CrumbState } from '@goodboy/ui';
import { isAgentFinished } from './agent-lifecycle';

export type AgentStateGroup = 'needs-you' | 'running' | 'done';

export type AgentStateWord = CrumbState & {
  readonly group: AgentStateGroup;
};

type Params = {
  readonly agent: Agent;
  readonly hasOpenQuestion: boolean;
  readonly isTurnLive: boolean;
  readonly hasActiveChild: boolean;
  readonly isResolverSettled?: boolean;
};

const finishedWord = ({ agent }: { readonly agent: Agent }): AgentStateWord => {
  if (agent.status === 'completed') {
    return { word: 'Done', tone: 'success', group: 'done' };
  }
  if (agent.status === 'failed') {
    return { word: 'Failed', tone: 'danger', group: 'done' };
  }
  if (agent.status === 'skipped') {
    return { word: 'Skipped', tone: 'neutral', group: 'done' };
  }
  return { word: 'Stopped', tone: 'neutral', group: 'done' };
};

export const agentStateWord = ({
  agent,
  hasOpenQuestion,
  isTurnLive,
  hasActiveChild,
  isResolverSettled = false,
}: Params): AgentStateWord => {
  const isFinished = isAgentFinished({
    agent,
    hasOpenQuestion,
    isTurnLive,
    hasActiveChild,
    isResolverSettled,
  });
  if (isFinished) {
    return finishedWord({ agent });
  }
  if (hasOpenQuestion || agent.status === 'blocked') {
    return { word: 'Needs you', tone: 'warning', group: 'needs-you' };
  }
  if (agent.status === 'failed') {
    return { word: 'Failed', tone: 'danger', group: 'needs-you' };
  }
  if (agent.status === 'stopped') {
    return { word: 'Stopped', tone: 'neutral', group: 'needs-you' };
  }
  if (agent.status === 'pending' && !isTurnLive) {
    return { word: 'Waiting', tone: 'neutral', group: 'running' };
  }
  if (agent.status === 'skipped') {
    return { word: 'Skipped', tone: 'neutral', group: 'needs-you' };
  }
  return { word: 'Running', tone: 'info', group: 'running' };
};
