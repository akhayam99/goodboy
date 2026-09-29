import type { SessionId, AgentId, ProviderRunId } from '@goodboy/types';
import type { ExecutedAgentRouting } from './executedAgentRouting';

export type TurnSliceState = {
  readonly sessionLanguageAnchor: Readonly<Record<SessionId, string>>;
  readonly runRouting: Readonly<
    Record<AgentId, Readonly<Record<ProviderRunId, ExecutedAgentRouting>>>
  >;
};

export const turnInitialState: TurnSliceState = {
  sessionLanguageAnchor: {},
  runRouting: {},
};
