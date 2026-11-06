import type { Agent, TurnState } from '@goodboy/types';

type Params = {
  readonly agent: Agent;
  readonly turn: TurnState | undefined;
};

export const isCheckFixLive = ({ agent, turn }: Params): boolean =>
  turn?.kind === 'starting' ||
  turn?.kind === 'running' ||
  turn?.kind === 'blocked' ||
  ((turn === undefined || turn.kind === 'idle') &&
    (agent.status === 'running' || agent.status === 'pending'));
