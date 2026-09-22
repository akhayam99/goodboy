import {
  EVIDENCE_SOURCE_KINDS,
  type EvidenceAvailability,
  type EvidenceEntry,
  type EvidenceInventory,
  type EvidenceSourceKind,
} from '@goodboy/types';

export type EvidenceInventoryInput = Readonly<{
  sourceId: string;
  kind: EvidenceSourceKind;
  label: string;
  provenance: string;
  revision: string;
  availability: EvidenceAvailability;
  detail?: string | null;
}>;

type BuildParams = {
  readonly agentId: string;
  readonly inputs: ReadonlyArray<EvidenceInventoryInput>;
  readonly omittedCount?: number;
};

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

export const inventoryRevisionOf = ({ text }: { readonly text: string }): string => {
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), FNV_PRIME) >>> 0;
  }
  return `r${hash.toString(36)}`;
};

const orderOf = ({ kind }: { readonly kind: EvidenceSourceKind }): number =>
  EVIDENCE_SOURCE_KINDS.indexOf(kind);

export const buildEvidenceInventory = ({
  agentId,
  inputs,
  omittedCount = 0,
}: BuildParams): EvidenceInventory => {
  const seen = new Set<string>();
  const entries: EvidenceEntry[] = [];
  for (const input of inputs) {
    const sourceId = input.sourceId.trim();
    if (sourceId.length === 0 || seen.has(sourceId)) {
      continue;
    }
    seen.add(sourceId);
    entries.push({
      sourceId,
      kind: input.kind,
      label: input.label.trim(),
      provenance: input.provenance.trim(),
      revision: input.revision.trim(),
      availability: input.availability,
      detail: input.detail === undefined || input.detail === null ? null : input.detail.trim(),
    });
  }
  entries.sort((left, right) => {
    const byKind = orderOf({ kind: left.kind }) - orderOf({ kind: right.kind });
    if (byKind !== 0) {
      return byKind;
    }
    return left.sourceId.localeCompare(right.sourceId);
  });
  const serialized = entries
    .map(
      (entry) =>
        `${entry.sourceId}|${entry.kind}|${entry.revision}|${entry.availability}|${entry.detail ?? ''}`,
    )
    .join('\n');
  return {
    agentId,
    revision: inventoryRevisionOf({ text: `${agentId}\n${omittedCount}\n${serialized}` }),
    entries,
    omittedCount,
  };
};

type LookupParams = {
  readonly inventory: EvidenceInventory;
  readonly sourceId: string;
};

export const evidenceEntryFor = ({ inventory, sourceId }: LookupParams): EvidenceEntry | null =>
  inventory.entries.find((entry) => entry.sourceId === sourceId) ?? null;
