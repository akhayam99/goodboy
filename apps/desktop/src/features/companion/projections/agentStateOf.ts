import type { Agent, TurnState } from '@goodboy/types';
import { agentStateFrom } from '../actions/targets';
import type { AgentState } from '../contract/projections';

type Params = {
  readonly agent: Agent;
  readonly turn: TurnState | undefined;
};

export const agentStateOf = ({ agent, turn }: Params): AgentState =>
  agentStateFrom({ agent, turn });
