import type { Agent, TurnState } from '@goodboy/types';
import { effectiveAgentStatusOf } from '../../workTreeModel/agentStateOf';
import { glanceOf, type Glance } from './glanceOf';

type Params = {
  readonly agent: Agent;
  readonly turnState: TurnState | null;
};

export const agentGlanceOf = ({ agent, turnState }: Params): Glance => {
  if (turnState?.kind === 'blocked' || agent.status === 'blocked') {
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
    return glanceOf({ state: 'working', sentence: 'Working on it' });
  }
  if (status === 'failed') {
    return glanceOf({ state: 'stuck', sentence: 'The agent failed' });
  }
  if (status === 'stopped') {
    return glanceOf({ state: 'stopped', sentence: 'You stopped it, nothing is running' });
  }
  if (status === 'completed' || status === 'skipped') {
    return glanceOf({ state: 'done', sentence: 'Finished, write to continue' });
  }
  if (status === 'pending') {
    return glanceOf({ state: 'idle', sentence: 'Queued' });
  }
  return glanceOf({ state: 'idle', sentence: 'Write to continue' });
};
