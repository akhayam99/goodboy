import {
  autoRemainingForGates,
  DEFAULT_AUTO_LEVEL,
  delegationDepthOf,
  substepLinkOf,
  type AdmissionChild,
  type AdmissionParentFacts,
  type AdmissionSnapshot,
} from '@goodboy/core';
import {
  getAutoArtifact,
  getAutoTree,
  getSetting,
  listAutoAttemptsOfDelegation,
  listAutoDelegations,
  listOpenAutoDelegations,
  readAutoArtifactLiveState,
  readAutoTreeSpend,
  type Database,
} from '@goodboy/db';
import { brandId, type ArtifactId, type AutoTreeId } from '@goodboy/types';
import { isAutoPlanApprovalRequired } from '../../../features/auto/isAutoPlanApprovalRequired';
import { SETTING_AUTO_PLAN_APPROVAL } from '../../../features/settings/settings';
import { readAutoLevel } from './level/readAutoLevel';

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

type ParentFactsParams = {
  readonly db: Database;
  readonly treeId: AutoTreeId;
  readonly children: ReadonlyArray<AdmissionChild>;
};

const parentFactsOf = async ({
  db,
  treeId,
  children,
}: ParentFactsParams): Promise<ReadonlyArray<AdmissionParentFacts>> => {
  const parentIds = [
    ...new Set(
      children.flatMap((child) =>
        child.substep === undefined || child.substep === null
          ? []
          : [child.substep.parentDelegationId],
      ),
    ),
  ];
  if (parentIds.length === 0) {
    return [];
  }
  const all = await listAutoDelegations({ db, treeId });
  const facts: AdmissionParentFacts[] = [];
  for (const parentId of parentIds) {
    const parent = all.find((delegation) => delegation.id === parentId);
    if (parent === undefined) {
      continue;
    }
    const attempts = await listAutoAttemptsOfDelegation({ db, delegationId: parent.id });
    const latest = attempts.at(-1);
    facts.push({
      delegationId: parent.id,
      state: parent.state,
      generation: parent.generation,
      pausedQuestionId: latest?.state === 'paused' ? latest.questionId : null,
      depth: delegationDepthOf({ request: parent.request }),
      substeps: all.filter(
        (delegation) => substepLinkOf({ request: delegation.request })?.delegationId === parent.id,
      ).length,
    });
  }
  return facts;
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
  const parents = await parentFactsOf({ db, treeId, children });
  const level =
    tree === null
      ? DEFAULT_AUTO_LEVEL
      : await readAutoLevel({ db, target: { sessionId: tree.sessionId } });
  const approval = await getSetting(db, SETTING_AUTO_PLAN_APPROVAL);
  return {
    tree,
    ownerId,
    nowMs,
    callerAgentId,
    expectedGeneration,
    expectedRunId,
    openCount: open.filter((delegation) => delegation.state !== 'paused').length,
    parents,
    openChildAgentIds: open.map((delegation) => delegation.childAgentId),
    remainingUsd: autoRemainingForGates({ spend }),
    artifacts,
    isPlanApprovalRequired:
      isPlanApprovalRequired &&
      isAutoPlanApprovalRequired({ settings: { [SETTING_AUTO_PLAN_APPROVAL]: approval ?? '' } }),
    level,
  };
};
