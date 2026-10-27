import type { AgentId, ProviderRunId } from '@goodboy/types';
import type { LimitStop } from './state';

type Params = {
  readonly stops: Readonly<Record<ProviderRunId, LimitStop>>;
  readonly withoutAgentId?: AgentId;
  readonly withoutRunId?: ProviderRunId;
};

export const keepLimitStops = ({
  stops,
  withoutAgentId,
  withoutRunId,
}: Params): Readonly<Record<ProviderRunId, LimitStop>> => {
  const kept: Record<ProviderRunId, LimitStop> = {};
  for (const stop of Object.values(stops)) {
    if (stop.agentId !== withoutAgentId && stop.runId !== withoutRunId) {
      kept[stop.runId] = stop;
    }
  }
  return kept;
};
