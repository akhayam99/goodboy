import type { AdmissionChild, AdmissionSnapshot } from '@goodboy/core';
import {
  getAutoArtifact,
  getAutoTree,
  listOpenAutoDelegations,
  readAutoArtifactLiveState,
  readAutoTreeSpend,
  type Database,
} from '@goodboy/db';
import { brandId, type ArtifactId, type AutoTreeId } from '@goodboy/types';

export type ReadAdmissionSnapshotParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly ownerId: string;
  readonly nowMs: number;
  readonly callerAgentId: string;
  readonly expectedGeneration: number;
  readonly expectedRunId: string;
  readonly children: ReadonlyArray<AdmissionChild>;
  readonly isPlanApprovalRequired: boolean;
};

type ReferencedArtifactIdsParams = {
  readonly children: ReadonlyArray<AdmissionChild>;
};

const referencedArtifactIds = ({
  children,
}: ReferencedArtifactIdsParams): ReadonlyArray<string> => {
  const ids = children.flatMap((child) => [
    ...(child.reviseOf === null ? [] : [child.reviseOf.artifactId]),
    ...child.inputArtifacts.map((ref) => ref.artifactId),
  ]);
  return [...new Set(ids)];
};

export const readAdmissionSnapshot = async ({
  db,
  treeId,
  ownerId,
  nowMs,
  callerAgentId,
  expectedGeneration,
  expectedRunId,
  children,
  isPlanApprovalRequired,
}: ReadAdmissionSnapshotParams): Promise<AdmissionSnapshot> => {
  const tree = await getAutoTree({ db, treeId });
  const open = await listOpenAutoDelegations({ db, treeId });
  const spend = await readAutoTreeSpend({ db, treeId });
  const artifacts = await Promise.all(
    referencedArtifactIds({ children }).map(async (id) => {
      const artifactId = brandId<ArtifactId>({ value: id });
      const registered = await getAutoArtifact({ db, artifactId });
      const live = await readAutoArtifactLiveState({ db, artifactId });
      return { artifactId: id, registered, live };
    }),
  );
  return {
    tree,
    ownerId,
    nowMs,
    callerAgentId,
    expectedGeneration,
    expectedRunId,
    openCount: open.length,
    openChildAgentIds: open.map((delegation) => delegation.childAgentId),
    remainingUsd: spend?.remainingUsd ?? 0,
    artifacts,
    isPlanApprovalRequired,
  };
};
