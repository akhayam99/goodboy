import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { selectKindRouting } from '../../store/slices/agents/selectKindRouting';
import type { AgentKindRouting } from '../session/agent-kind';
import { retryBatchOf, routingOfLaunch } from './launchChoice';

type RoutingParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly threadId?: string;
};

export const draftRoutingOf = ({ state, sessionId, threadId }: RoutingParams): AgentKindRouting => {
  const launched =
    threadId === undefined
      ? null
      : retryBatchOf({ attempts: state.sessionResolveAttempts[sessionId] ?? [], threadId });
  return (
    (launched === null ? null : routingOfLaunch({ launchChoice: launched.launchChoice })) ??
    state.resolveQueueView[sessionId]?.lastRouting ??
    selectKindRouting({ state, sessionId, kind: 'resolver' })
  );
};
