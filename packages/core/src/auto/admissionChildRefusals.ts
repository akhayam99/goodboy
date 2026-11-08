import type { AutoTree } from '@goodboy/db';
import type {
  AdmissionArtifactFacts,
  AdmissionArtifactRef,
  AdmissionChild,
  AdmissionChildRefusal,
  AdmissionSnapshot,
} from './admission';
import type { AutoRefusalCode } from './refusals';
import { isAutoWriterRole } from './roles';
import { substepRefusal } from './substepAdmission';

type FactsOfParams = {
  readonly snapshot: AdmissionSnapshot;
  readonly artifactId: string;
};

const factsOf = ({ snapshot, artifactId }: FactsOfParams): AdmissionArtifactFacts | null =>
  snapshot.artifacts.find((facts) => facts.artifactId === artifactId) ?? null;

type ArtifactCheckParams = {
  readonly snapshot: AdmissionSnapshot;
  readonly ref: AdmissionArtifactRef;
  readonly tree: AutoTree;
};

type ArtifactCheck = Readonly<{
  code: AutoRefusalCode;
  latestRevision: number | null;
}>;

const artifactExists = ({ snapshot, ref, tree }: ArtifactCheckParams): ArtifactCheck | null => {
  const facts = factsOf({ snapshot, artifactId: ref.artifactId });
  if (
    facts === null ||
    facts.registered === null ||
    facts.live === null ||
    facts.registered.treeId !== tree.id
  ) {
    return { code: 'artifact_unknown', latestRevision: null };
  }
  if (facts.live.revision !== ref.revision) {
    return { code: 'stale_revision', latestRevision: facts.live.revision };
  }
  return null;
};

type ReviseCheckParams = ArtifactCheckParams & {
  readonly child: AdmissionChild;
  readonly seenChildAgentIds: ReadonlyArray<string>;
  readonly seenRevisedIds: ReadonlyArray<string>;
};

const reviseRefusal = ({
  snapshot,
  ref,
  tree,
  child,
  seenChildAgentIds,
  seenRevisedIds,
}: ReviseCheckParams): ArtifactCheck | null => {
  const missing = artifactExists({ snapshot, ref, tree });
  if (missing !== null) {
    return missing;
  }
  const facts = factsOf({ snapshot, artifactId: ref.artifactId });
  const registered = facts?.registered;
  const live = facts?.live;
  if (registered === null || registered === undefined || live === null || live === undefined) {
    return { code: 'artifact_unknown', latestRevision: null };
  }
  if (registered.ownerRole !== child.role || registered.ownerAgentId !== child.childAgentId) {
    return { code: 'role_mismatch', latestRevision: live.revision };
  }
  if (live.status === 'consumed') {
    return { code: 'artifact_consumed', latestRevision: live.revision };
  }
  if (live.status !== 'active') {
    return { code: 'artifact_discarded', latestRevision: live.revision };
  }
  const isBusy =
    registered.openReviseDelegationId !== null ||
    snapshot.openChildAgentIds.includes(child.childAgentId) ||
    seenChildAgentIds.includes(child.childAgentId) ||
    seenRevisedIds.includes(ref.artifactId);
  if (isBusy) {
    return { code: 'artifact_busy', latestRevision: live.revision };
  }
  return null;
};

type InputCheckParams = ArtifactCheckParams & {
  readonly child: AdmissionChild;
};

const inputRefusal = ({ snapshot, ref, tree, child }: InputCheckParams): ArtifactCheck | null => {
  const missing = artifactExists({ snapshot, ref, tree });
  if (missing !== null) {
    return missing;
  }
  const facts = factsOf({ snapshot, artifactId: ref.artifactId });
  const registered = facts?.registered;
  const live = facts?.live;
  if (registered === null || registered === undefined || live === null || live === undefined) {
    return { code: 'artifact_unknown', latestRevision: null };
  }
  if (registered.openReviseDelegationId !== null) {
    return { code: 'artifact_revising', latestRevision: live.revision };
  }
  if (live.status === 'discarded' || live.status === 'superseded') {
    return { code: 'artifact_discarded', latestRevision: live.revision };
  }
  const isApprovalNeeded =
    snapshot.isPlanApprovalRequired &&
    snapshot.level !== 'run' &&
    registered.kind === 'plan' &&
    isAutoWriterRole({ role: child.role });
  const isApproved =
    registered.approvalState === 'approved' && registered.approvedRevision === ref.revision;
  if (isApprovalNeeded && !isApproved) {
    return { code: 'artifact_unapproved', latestRevision: live.revision };
  }
  return null;
};

export type AdmissionChildRefusalsParams = Readonly<{
  snapshot: AdmissionSnapshot;
  tree: AutoTree;
  children: ReadonlyArray<AdmissionChild>;
}>;

export const admissionChildRefusals = ({
  snapshot,
  tree,
  children,
}: AdmissionChildRefusalsParams): ReadonlyArray<AdmissionChildRefusal> => {
  const refusals: AdmissionChildRefusal[] = [];
  const seenChildAgentIds: string[] = [];
  const seenRevisedIds: string[] = [];
  const substepsSeen = new Map<string, number>();
  for (const [slot, child] of children.entries()) {
    const substep = child.substep ?? null;
    if (substep !== null) {
      const seenInBatch = substepsSeen.get(substep.parentDelegationId) ?? 0;
      substepsSeen.set(substep.parentDelegationId, seenInBatch + 1);
      const code = substepRefusal({
        tree,
        role: child.role,
        substep,
        parents: snapshot.parents ?? [],
        seenInBatch,
      });
      if (code !== null) {
        refusals.push({ slot, code, latestRevision: null });
        continue;
      }
    }
    const found =
      child.reviseOf === null
        ? null
        : reviseRefusal({
            snapshot,
            ref: child.reviseOf,
            tree,
            child,
            seenChildAgentIds,
            seenRevisedIds,
          });
    if (child.reviseOf !== null) {
      seenChildAgentIds.push(child.childAgentId);
      seenRevisedIds.push(child.reviseOf.artifactId);
    }
    const inputFound = child.inputArtifacts
      .map((ref) => inputRefusal({ snapshot, ref, tree, child }))
      .find((check) => check !== null);
    const check = found ?? inputFound ?? null;
    if (check !== null) {
      refusals.push({ slot, code: check.code, latestRevision: check.latestRevision });
    }
  }
  return refusals;
};
