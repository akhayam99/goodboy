import type { SessionId, AgentId, IsoDateTime, ProviderRunId } from '@goodboy/types';
import type { ExecutedAgentRouting } from './executedAgentRouting';

type WriterWait = Readonly<{
  sessionId: SessionId;
  blockedPath: string;
  blockedBy: string | null;
  since: IsoDateTime;
}>;

export type TurnSliceState = {
  readonly agentWriterWait: Readonly<Record<AgentId, WriterWait>>;
  readonly sessionLanguageAnchor: Readonly<Record<SessionId, string>>;
  readonly runRouting: Readonly<
    Record<AgentId, Readonly<Record<ProviderRunId, ExecutedAgentRouting>>>
  >;
};

export const turnInitialState: TurnSliceState = {
  agentWriterWait: {},
  sessionLanguageAnchor: {},
  runRouting: {},
};
