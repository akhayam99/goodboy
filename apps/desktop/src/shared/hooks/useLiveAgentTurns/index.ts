import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Agent, TurnState } from '@goodboy/types';
import { useAppStore } from '../../../store';

type Params = {
  readonly agents: ReadonlyArray<Agent>;
};

const NO_TURNS: Readonly<Record<string, TurnState | undefined>> = {};

export const useLiveAgentTurns = ({ agents }: Params): ReadonlyMap<string, TurnState> => {
  const turns = useAppStore(
    useShallow((state) => {
      const live: Record<string, TurnState | undefined> = {};
      for (const agent of agents) {
        const turn = state.agentTurnState[agent.id];
        if (turn?.kind === 'running' || turn?.kind === 'blocked') {
          live[agent.id] = turn;
        }
      }
      return Object.keys(live).length === 0 ? NO_TURNS : live;
    }),
  );
  return useMemo(() => {
    const byAgentId = new Map<string, TurnState>();
    for (const [agentId, turn] of Object.entries(turns)) {
      if (turn !== undefined) {
        byAgentId.set(agentId, turn);
      }
    }
    return byAgentId;
  }, [turns]);
};
