import { isResultsPayload } from '@goodboy/core';
import { AUTO_OUTCOMES, type AutoOutboxRow } from '@goodboy/db';
import { brandId, type AgentId, type ProviderRunId } from '@goodboy/types';
import type { AutoDeliveredArtifact, AutoDeliveredResult } from './state';
import { isRecord } from '@goodboy/types/helpers';
import { delegationResultOf } from '../../../features/auto/chat/delegationResultOf';

type Params = {
  readonly accepted: ReadonlyArray<AutoOutboxRow>;
};

type FieldParams = {
  readonly source: unknown;
  readonly key: string;
};

const textOf = ({ source, key }: FieldParams): string | null => {
  if (!isRecord(source)) {
    return null;
  }
  const value = source[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

const recordOf = ({ source, key }: FieldParams): unknown => (isRecord(source) ? source[key] : null);

type ArtifactParams = {
  readonly value: unknown;
};

const deliveredArtifactOf = ({ value }: ArtifactParams): AutoDeliveredArtifact | null => {
  const artifactId = textOf({ source: value, key: 'id' });
  const title = textOf({ source: value, key: 'title' });
  if (artifactId === null || title === null) {
    return null;
  }
  const revision = isRecord(value) ? value['revision'] : null;
  return {
    artifactId,
    kind: textOf({ source: value, key: 'kind' }) ?? 'artifact',
    title,
    revision: typeof revision === 'number' ? revision : null,
  };
};

type ArtifactsParams = {
  readonly entry: unknown;
};

const artifactsOf = ({ entry }: ArtifactsParams): ReadonlyArray<AutoDeliveredArtifact> => {
  const list = isRecord(entry) ? entry['artifacts'] : null;
  if (!Array.isArray(list)) {
    return [];
  }
  return list.flatMap((value: unknown) => {
    const artifact = deliveredArtifactOf({ value });
    return artifact === null ? [] : [artifact];
  });
};

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
    outcomeLine: delegationResultOf({ result: entry })?.outcomeLine ?? null,
    artifacts: artifactsOf({ entry }),
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
