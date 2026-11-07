import { notFinishedKindOf } from '@goodboy/core/workflows';
import type { Agent, TurnState } from '@goodboy/types';
import { effectiveAgentStatusOf } from '../../workTreeModel/agentStateOf';
import { glanceOf, type Glance } from './glanceOf';
import { stoppedSentenceOf } from './stoppedSentenceOf';

type Params = {
  readonly agent: Agent;
  readonly turnState: TurnState | null;
};

type SkippedParams = Pick<Params, 'agent'>;

const skippedSentenceOf = ({ agent }: SkippedParams): string => {
  const notFinished = notFinishedKindOf({ agent });
  const hasRun = agent.runId !== undefined || agent.startedAt !== undefined;
  if (notFinished === 'stuck' || (notFinished === null && hasRun)) {
    return 'Skipped while it ran, what it wrote is kept';
  }
  return 'Nothing ran for this step';
};

export const agentGlanceOf = ({ agent, turnState }: Params): Glance => {
  if (turnState?.kind === 'blocked') {
    return glanceOf({ state: 'waiting', sentence: 'Needs permission' });
  }
  const isBlockedAtRest = agent.status === 'blocked' && turnState?.kind !== 'running';
  if (isBlockedAtRest) {
    return glanceOf({ state: 'waiting', sentence: 'Tell it what to do next' });
  }
  if (turnState?.kind === 'error') {
    return glanceOf({ state: 'failed', sentence: turnState.message });
  }
  if (turnState?.kind === 'starting') {
    return glanceOf({ state: 'running', sentence: 'Starting' });
  }
  const status = effectiveAgentStatusOf({ agent, turn: turnState });
  if (status === 'running') {
    return glanceOf({ state: 'running', sentence: '' });
  }
  if (status === 'failed') {
    return glanceOf({ state: 'failed', sentence: 'The agent ended on an error' });
  }
  if (status === 'stopped') {
    return glanceOf({ state: 'stopped', sentence: stoppedSentenceOf({ agent }) });
  }
  if (status === 'completed') {
    return glanceOf({ state: 'idle', sentence: '' });
  }
  if (status === 'skipped') {
    return glanceOf({ state: 'skipped', sentence: skippedSentenceOf({ agent }) });
  }
  if (status === 'pending') {
    return glanceOf({ state: 'queued', sentence: 'Starts on its own' });
  }
  return glanceOf({ state: 'idle', sentence: '' });
};
