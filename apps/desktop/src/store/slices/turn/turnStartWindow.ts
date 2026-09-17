import type { AgentId } from '@goodboy/types';

type Params = Readonly<{
  agentId: AgentId;
}>;

export type TurnStartClaim = 'granted' | 'cancelled';

const windows = new Map<AgentId, boolean>();

export const openTurnStartWindow = ({ agentId }: Params): void => {
  windows.set(agentId, false);
};

export const cancelTurnStartWindow = ({ agentId }: Params): boolean => {
  if (windows.has(agentId) === false) {
    return false;
  }
  windows.set(agentId, true);
  return true;
};

export const isTurnStartCancelled = ({ agentId }: Params): boolean => windows.get(agentId) === true;

export const claimTurnStart = ({ agentId }: Params): TurnStartClaim => {
  if (windows.get(agentId) !== true) {
    return 'granted';
  }
  windows.delete(agentId);
  return 'cancelled';
};

export const closeTurnStartWindow = ({ agentId }: Params): void => {
  windows.delete(agentId);
};

export const resetTurnStartWindows = (): void => {
  windows.clear();
};
