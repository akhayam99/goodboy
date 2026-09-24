import type { ProviderId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import type { AppState } from '../../../store/types';

type SelectParams = {
  readonly state: AppState;
  readonly providerId: ProviderId;
};

const isProviderTurnRunning = ({ state, providerId }: SelectParams): boolean => {
  const liveRunIds = new Set<string>();
  for (const turn of Object.values(state.agentTurnState)) {
    if (turn.kind === 'running' || turn.kind === 'blocked') {
      liveRunIds.add(turn.runId);
    }
  }
  if (liveRunIds.size === 0) {
    return false;
  }
  return Object.values(state.runRouting).some((runs) =>
    Object.entries(runs).some(
      ([runId, routing]) => liveRunIds.has(runId) && routing.provider === providerId,
    ),
  );
};

type Params = {
  readonly providerId: ProviderId;
};

export const useIsProviderTurnRunning = ({ providerId }: Params): boolean =>
  useAppStore((state) => isProviderTurnRunning({ state, providerId }));
