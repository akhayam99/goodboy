import { AUTO_GATES } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../store/types';
import { autoRootsOf } from './autoRootsOf';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const isAutoAgentsShown = ({ state, sessionId }: Params): boolean =>
  AUTO_GATES.isDelegationEnabled ||
  autoRootsOf({
    agents: state.sessionPhaseRuns[sessionId] ?? [],
    kindOverride: state.agentKindOverride,
  }).length > 0;
