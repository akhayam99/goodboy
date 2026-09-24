import type { ContextReadOutcome, EvidenceInventory } from '@goodboy/types';
import { evidenceEntryFor } from './buildEvidenceInventory';
import type { ExtractedContextRead, ExtractedContextReadSource } from '../context/marker-parsing';

export type ContextReadResolution = Readonly<{
  sourceId: string;
  range: string | null;
  outcome: ContextReadOutcome;
  reason: string;
}>;

export type ContextReadPlan =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'stale-revision'; reason: string; revision: string }>
  | Readonly<{ kind: 'empty'; reason: string }>
  | Readonly<{ kind: 'resolved'; resolutions: ReadonlyArray<ContextReadResolution> }>;

type PlanParams = {
  readonly inventory: EvidenceInventory;
  readonly request: ExtractedContextRead | null;
  readonly authorizedSourceIds: ReadonlySet<string>;
};

const resolveSource = ({
  inventory,
  source,
  authorizedSourceIds,
}: {
  readonly inventory: EvidenceInventory;
  readonly source: ExtractedContextReadSource;
  readonly authorizedSourceIds: ReadonlySet<string>;
}): ContextReadResolution => {
  const entry = evidenceEntryFor({ inventory, sourceId: source.id });
  if (entry === null) {
    return {
      sourceId: source.id,
      range: source.range,
      outcome: 'unknown-source',
      reason: 'no source with that id is in your inventory',
    };
  }
  if (!authorizedSourceIds.has(source.id)) {
    return {
      sourceId: source.id,
      range: source.range,
      outcome: 'unauthorized',
      reason: 'that source is not authorized for you',
    };
  }
  if (entry.availability === 'unavailable') {
    return {
      sourceId: source.id,
      range: source.range,
      outcome: 'unavailable',
      reason: 'that source is recorded but its content cannot be retrieved',
    };
  }
  return {
    sourceId: source.id,
    range: source.range,
    outcome: 'delivered',
    reason: '',
  };
};

export const planContextRead = ({
  inventory,
  request,
  authorizedSourceIds,
}: PlanParams): ContextReadPlan => {
  if (request === null) {
    return { kind: 'none' };
  }
  if (request.inventoryRevision !== inventory.revision) {
    return {
      kind: 'stale-revision',
      revision: inventory.revision,
      reason: `the request names inventory revision ${request.inventoryRevision}, the current one is ${inventory.revision}`,
    };
  }
  if (request.sources.length === 0) {
    return { kind: 'empty', reason: 'the request names no source' };
  }
  return {
    kind: 'resolved',
    resolutions: request.sources.map((source) =>
      resolveSource({ inventory, source, authorizedSourceIds }),
    ),
  };
};
