import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { selectKindRouting } from '../../store/slices/agents/selectKindRouting';
import type { AgentKindRouting } from '../session/agent-kind';

type RoutingParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

export type DraftRoutingSource = 'role-default' | 'session-pick';

export const pickedRoutingOf = ({ state, sessionId }: RoutingParams): AgentKindRouting | null =>
  state.resolveQueueView[sessionId]?.lastRouting ?? null;

export const draftRoutingOf = ({ state, sessionId }: RoutingParams): AgentKindRouting =>
  pickedRoutingOf({ state, sessionId }) ??
  selectKindRouting({ state, sessionId, kind: 'resolver' });
