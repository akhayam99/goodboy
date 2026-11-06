import { notFinishedKindOf } from '@goodboy/core/workflows';
import type { Agent, TurnState } from '@goodboy/types';
import { effectiveAgentStatusOf } from '../../workTreeModel/agentStateOf';
import { glanceOf, type Glance } from './glanceOf';

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
  const isBlockedAtRest = agent.status === 'blocked' && turnState?.kind !== 'running';
  if (turnState?.kind === 'blocked' || isBlockedAtRest) {
    return glanceOf({ state: 'waiting', sentence: 'Waiting for your OK to go on' });
  }
  if (turnState?.kind === 'error') {
    return glanceOf({ state: 'stuck', sentence: turnState.message });
  }
  if (turnState?.kind === 'starting') {
    return glanceOf({ state: 'working', sentence: 'Starting' });
  }
  const status = effectiveAgentStatusOf({ agent, turn: turnState });
  if (status === 'running') {
    return glanceOf({ state: 'working', sentence: '' });
  }
  if (status === 'failed') {
    return glanceOf({ state: 'stuck', sentence: 'The agent failed' });
  }
  if (status === 'stopped') {
    return glanceOf({ state: 'stopped', sentence: 'You stopped it, nothing is running' });
  }
  if (status === 'completed') {
    return glanceOf({ state: 'idle', sentence: 'Finished, write to continue' });
  }
  if (status === 'skipped') {
    return glanceOf({ state: 'idle', sentence: skippedSentenceOf({ agent }) });
  }
  if (status === 'pending') {
    return glanceOf({ state: 'idle', sentence: 'Queued' });
  }
  return glanceOf({ state: 'idle', sentence: 'Write to continue' });
};
