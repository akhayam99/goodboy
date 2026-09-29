import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { sessionResolveStyle } from '../../store/sessionReplySettings';
import { selectResolvedSettings } from '../../store/slices/overrides/selectResolvedSettings';
import { kindRouting, type AgentKindRouting } from '../session/agent-kind';
import { launchChoiceOf } from './launchChoice';
import { startBatch } from './startBatch';

type RoutingParams = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

export const draftRoutingOf = ({ state, sessionId }: RoutingParams): AgentKindRouting =>
  state.resolveQueueView[sessionId]?.lastRouting ??
  kindRouting({
    kind: 'resolver',
    roleModels: selectResolvedSettings({ state, sessionId })?.roleModels ?? null,
  });

type Params = {
  readonly getState: () => AppStore;
  readonly sessionId: SessionId;
  readonly threadIds: ReadonlyArray<string>;
  readonly note?: string;
};

export const draftFixes = async ({
  getState,
  sessionId,
  threadIds,
  note = '',
}: Params): Promise<ReadonlyArray<AgentId>> => {
  const state = getState();
  const started = await startBatch({
    getState,
    sessionId,
    threadIds,
    launchChoice: launchChoiceOf({
      routing: draftRoutingOf({ state, sessionId }),
      commitStyle: sessionResolveStyle({ state, sessionId }).commitStyle,
      hint: note,
    }),
  });
  return started.agentIds;
};
