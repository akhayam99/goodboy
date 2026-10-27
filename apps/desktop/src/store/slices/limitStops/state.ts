import type { AgentId, ProviderId, ProviderRunId, SessionId } from '@goodboy/types';
import type { SendTurnInput } from '../turn/types';

export type LimitStop = Readonly<{
  runId: ProviderRunId;
  agentId: AgentId;
  sessionId: SessionId;
  provider: ProviderId;
  resetAtMs: number;
  isScheduled: boolean;
  input: SendTurnInput;
}>;

export type LimitStopsState = {
  readonly limitStops: Readonly<Record<ProviderRunId, LimitStop>>;
};

export const limitStopsInitialState: LimitStopsState = {
  limitStops: {},
};
