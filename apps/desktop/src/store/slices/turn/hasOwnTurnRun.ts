import type { ProviderRunId, TelemetryRecord } from '@goodboy/types';

const PLACEHOLDER_RUN_IDS: ReadonlySet<string> = new Set(['orchestrator', 'pending', 'history']);

type Params = {
  readonly history: ReadonlyArray<ProviderRunId>;
  readonly telemetry: ReadonlyArray<TelemetryRecord>;
};

export const hasOwnTurnRun = ({ history, telemetry }: Params): boolean => {
  const orchestratorRuns = new Set<string>(
    telemetry.filter((record) => record.kind === 'orchestrator').map((record) => record.runId),
  );
  return history.some((runId) => !PLACEHOLDER_RUN_IDS.has(runId) && !orchestratorRuns.has(runId));
};
