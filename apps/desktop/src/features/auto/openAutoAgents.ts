import type { SessionId } from '@goodboy/types';
import { agentPlace, useAppStore } from '../../store';
import { lensPlace } from '../../store/slices/navigation/canonicalLocation';
import { autoRootsOf } from './autoRootsOf';

type Params = {
  readonly sessionId: SessionId;
};

export const openAutoAgents = ({ sessionId }: Params): void => {
  const state = useAppStore.getState();
  const roots = autoRootsOf({
    agents: state.sessionPhaseRuns[sessionId] ?? [],
    kindOverride: state.agentKindOverride,
  });
  const only = roots.length === 1 ? roots[0] : undefined;
  if (only === undefined) {
    state.navigate({ to: lensPlace({ state, sessionId, lens: 'auto' }) });
    return;
  }
  state.navigate({ to: agentPlace({ sessionId, agentId: only.id }) });
  state.pickRailLevel({ level: 'auto' });
};
