import { artifactOutline, effectiveApproval, sha256Hex, type AutoLedgerEntry } from '@goodboy/core';
import {
  listAutoArtifactLedger,
  listAutoDelegations,
  type AutoDelegation,
  type Database,
} from '@goodboy/db';
import type { AutoTreeId } from '@goodboy/types';

export type TreeArtifactsParams = Readonly<{
  db: Database;
  treeId: AutoTreeId;
}>;

type ConsumersOfParams = {
  readonly delegations: ReadonlyArray<AutoDelegation>;
  readonly artifactId: string;
};

const consumersOf = ({ delegations, artifactId }: ConsumersOfParams): ReadonlyArray<string> =>
  delegations
    .filter((delegation) => {
      const inputs = delegation.request['inputArtifacts'];
      return (
        Array.isArray(inputs) &&
        inputs.some(
          (input: unknown) =>
            typeof input === 'object' &&
            input !== null &&
            'artifactId' in input &&
            input.artifactId === artifactId,
        )
      );
    })
    .map((delegation) => delegation.id);

export const treeArtifacts = async ({
  db,
  treeId,
}: TreeArtifactsParams): Promise<ReadonlyArray<AutoLedgerEntry>> => {
  const rows = await listAutoArtifactLedger({ db, treeId });
  const delegations = await listAutoDelegations({ db, treeId });
  return rows.map((row) => ({
    artifactId: row.artifact.artifactId,
    kind: row.artifact.kind,
    title: row.title,
    revision: row.revision,
    status: row.status,
    producerAgentId: row.artifact.ownerAgentId,
    producerDelegationId: row.artifact.ownerDelegationId,
    producerRole: row.artifact.ownerRole,
    lastAuthor: row.lastAuthor,
    lastAsk: row.lastAsk,
    approval: effectiveApproval({
      approvalState: row.artifact.approvalState,
      approvedRevision: row.artifact.approvedRevision,
      revision: row.revision,
      openReviseDelegationId: row.artifact.openReviseDelegationId,
    }),
    openReviseDelegationId: row.artifact.openReviseDelegationId,
    consumerDelegationIds: consumersOf({ delegations, artifactId: row.artifact.artifactId }),
    contentHash: sha256Hex(row.sourceText),
    updatedAt: row.updatedAt,
    outline: artifactOutline({ sourceText: row.sourceText }),
  }));
};
