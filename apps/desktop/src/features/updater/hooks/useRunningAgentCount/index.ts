import type { TurnState } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const isRunning = ({ state }: { state: TurnState }): boolean =>
  state.kind === 'starting' || state.kind === 'running' || state.kind === 'blocked';

export const countRunningAgents = ({
  turnStates,
}: {
  turnStates: Readonly<Record<string, TurnState>>;
}): number => Object.values(turnStates).filter((state) => isRunning({ state })).length;

export const useRunningAgentCount = (): number =>
  useAppStore((state) => countRunningAgents({ turnStates: state.agentTurnState }));
