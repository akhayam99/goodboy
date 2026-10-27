import type { AgentId, ProviderRunId } from '@goodboy/types';
import type { LimitStop, LimitStopsState } from './state';

export type { SliceDeps as LimitStopsDeps } from '../../slice-types';

export type RecordLimitStopParams = {
  readonly stop: LimitStop;
};

export type LimitStopRunParams = {
  readonly runId: ProviderRunId;
};

export type ClearAgentLimitStopsParams = {
  readonly agentId: AgentId;
};

export type LimitStopsSlice = LimitStopsState & {
  recordLimitStop(params: RecordLimitStopParams): void;
  continueAfterLimit(params: LimitStopRunParams): void;
  cancelLimitContinue(params: LimitStopRunParams): void;
  clearAgentLimitStops(params: ClearAgentLimitStopsParams): void;
};
