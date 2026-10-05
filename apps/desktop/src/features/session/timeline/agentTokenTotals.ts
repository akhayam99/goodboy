import type { ProviderRunId, TelemetryRecord } from '@goodboy/types';

export type TokenTotals = {
  readonly input: number;
  readonly output: number;
  readonly cached: number;
};

type Params = {
  readonly records: ReadonlyArray<TelemetryRecord>;
  readonly runIds: ReadonlyArray<ProviderRunId>;
};

export const agentTokenTotals = ({ records, runIds }: Params): TokenTotals | null => {
  const owned = new Set<ProviderRunId>(runIds);
  let input = 0;
  let output = 0;
  let cached = 0;
  let count = 0;
  for (const record of records) {
    if (record.kind === 'summarizer' || !owned.has(record.runId)) {
      continue;
    }
    input += record.inputTokens;
    output += record.outputTokens;
    cached += record.cachedInputTokens ?? 0;
    count += 1;
  }
  return count === 0 ? null : { input, output, cached };
};
