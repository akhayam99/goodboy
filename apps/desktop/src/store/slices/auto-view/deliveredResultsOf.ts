import { isResultsPayload } from '@goodboy/core';
import { AUTO_OUTCOMES, type AutoOutboxRow } from '@goodboy/db';
import { brandId, type AgentId, type ProviderRunId } from '@goodboy/types';
import type { AutoDeliveredResult } from './state';

type Params = {
  readonly accepted: ReadonlyArray<AutoOutboxRow>;
};

type FieldParams = {
  readonly source: unknown;
  readonly key: string;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const textOf = ({ source, key }: FieldParams): string | null => {
  if (!isRecord(source)) {
    return null;
  }
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

const recordOf = ({ source, key }: FieldParams): unknown => (isRecord(source) ? source[key] : null);

type EntryParams = {
  readonly entry: unknown;
  readonly runId: ProviderRunId;
};

const deliveredOf = ({ entry, runId }: EntryParams): AutoDeliveredResult | null => {
  const delegationId = textOf({ source: entry, key: 'delegationId' });
  const childAgentId = textOf({ source: entry, key: 'childAgentId' });
  const role = textOf({ source: entry, key: 'role' });
  const storedOutcome = textOf({ source: entry, key: 'outcome' });
  const outcome = AUTO_OUTCOMES.find((candidate) => candidate === storedOutcome);
  if (delegationId === null || childAgentId === null || role === null || outcome === undefined) {
    return null;
  }
  const routing = recordOf({ source: entry, key: 'routing' });
  return {
    runId,
    delegationId,
    childAgentId: brandId<AgentId>({ value: childAgentId }),
    role,
    provider: textOf({ source: routing, key: 'provider' }),
    model: textOf({ source: routing, key: 'model' }),
    outcome,
    summary: textOf({ source: recordOf({ source: entry, key: 'declared' }), key: 'summary' }),
  };
};

export const deliveredResultsOf = ({ accepted }: Params): ReadonlyArray<AutoDeliveredResult> =>
  accepted.flatMap((row) => {
    const runId = row.acceptedRunId;
    if (
      row.kind !== 'results' ||
      row.state !== 'accepted' ||
      runId === null ||
      !isResultsPayload(row.payload)
    ) {
      return [];
    }
    const branded = brandId<ProviderRunId>({ value: runId });
    return row.payload.results.flatMap((entry: unknown) => {
      const delivered = deliveredOf({ entry, runId: branded });
      return delivered === null ? [] : [delivered];
    });
  });
