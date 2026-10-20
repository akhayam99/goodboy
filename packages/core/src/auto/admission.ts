import { AUTO_USD_EPSILON, type AutoArtifact, type AutoTree } from '@goodboy/db';
import {
  AUTO_BATCH_MAX_CHILDREN,
  AUTO_MAX_OPEN_CHILDREN,
  AUTO_TREE_LIMITS,
  attemptCeilingUsd,
} from './limits';
import type { AutoRefusalCode } from './refusals';
import type { AutoDelegationRole } from './roles';
import { isAutoWriterRole } from './roles';

export type AdmissionArtifactRef = Readonly<{
  artifactId: string;
  revision: number;
}>;

export type AdmissionChild = Readonly<{
  childAgentId: string;
  role: AutoDelegationRole;
  reviseOf: AdmissionArtifactRef | null;
  inputArtifacts: ReadonlyArray<AdmissionArtifactRef>;
}>;

export type AdmissionLiveArtifact = Readonly<{
  revision: number;
  status: string;
  sourceText: string;
}>;

export type AdmissionArtifactFacts = Readonly<{
  registered: AutoArtifact | null;
  live: AdmissionLiveArtifact | null;
}>;

export type AdmissionSnapshot = Readonly<{
  tree: AutoTree | null;
  ownerId: string;
  nowMs: number;
  callerAgentId: string;
  expectedGeneration: number;
  expectedRunId: string;
  openCount: number;
  openChildAgentIds: ReadonlyArray<string>;
  remainingUsd: number;
  artifacts: ReadonlyArray<AdmissionArtifactFacts & { readonly artifactId: string }>;
  isPlanApprovalRequired: boolean;
}>;

export type AdmissionChildRefusal = Readonly<{
  slot: number;
  code: AutoRefusalCode;
  latestRevision: number | null;
}>;

export type AdmissionVerdict =
  | Readonly<{ kind: 'ok'; ceilingsUsd: ReadonlyArray<number>; requestedUsd: number }>
  | Readonly<{
      kind: 'refused';
      code: AutoRefusalCode;
      perChild: ReadonlyArray<AdmissionChildRefusal>;
    }>;

type DiagnoseAdmissionParams = {
  readonly snapshot: AdmissionSnapshot;
  readonly children: ReadonlyArray<AdmissionChild>;
};

type TreeChecksParams = {
  readonly snapshot: AdmissionSnapshot;
  readonly tree: AutoTree;
  readonly count: number;
};

const treeRefusal = ({ snapshot, tree, count }: TreeChecksParams): AutoRefusalCode | null => {
  const isOwner =
    tree.schedulerOwner === snapshot.ownerId &&
    tree.ownerLeaseExpiresAt !== null &&
    tree.ownerLeaseExpiresAt > snapshot.nowMs;
  if (!isOwner) {
    return 'not_owner';
  }
  if (tree.rootAgentId !== snapshot.callerAgentId) {
    return 'depth_cap';
  }
  if (tree.stopState !== 'none' || tree.phase === 'stopping' || tree.phase === 'stopped') {
    return 'tree_stopped';
  }
  if (tree.generation !== snapshot.expectedGeneration) {
    return 'generation_changed';
  }
  if (tree.isYieldRequested) {
    return 'already_yielded';
  }
  if (tree.phase !== 'deciding' || tree.activeRunId !== snapshot.expectedRunId) {
    return 'not_deciding';
  }
  if (count === 0) {
    return 'empty_batch';
  }
  if (count > AUTO_BATCH_MAX_CHILDREN) {
    return 'breadth_cap';
  }
  if (tree.turnDelegateCalls >= AUTO_TREE_LIMITS.delegateCallsPerTurn) {
    return 'limit_calls';
  }
  if (tree.refusalsUsed >= AUTO_TREE_LIMITS.refusals) {
    return 'limit_refusals';
  }
  if (snapshot.nowMs >= tree.hardDeadlineAt) {
    return 'limit_wall_clock';
  }
  if (snapshot.openCount + count > AUTO_MAX_OPEN_CHILDREN) {
    return 'breadth_cap';
  }
  return null;
};

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
    registered.kind === 'plan' &&
    isAutoWriterRole({ role: child.role });
  const isApproved =
    registered.approvalState === 'approved' && registered.approvedRevision === ref.revision;
  if (isApprovalNeeded && !isApproved) {
    return { code: 'artifact_unapproved', latestRevision: live.revision };
  }
  return null;
};

type ChildRefusalsParams = {
  readonly snapshot: AdmissionSnapshot;
  readonly tree: AutoTree;
  readonly children: ReadonlyArray<AdmissionChild>;
};

const childRefusals = ({
  snapshot,
  tree,
  children,
}: ChildRefusalsParams): ReadonlyArray<AdmissionChildRefusal> => {
  const refusals: AdmissionChildRefusal[] = [];
  const seenChildAgentIds: string[] = [];
  const seenRevisedIds: string[] = [];
  for (const [slot, child] of children.entries()) {
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

export const diagnoseAdmission = ({
  snapshot,
  children,
}: DiagnoseAdmissionParams): AdmissionVerdict => {
  const tree = snapshot.tree;
  if (tree === null) {
    return { kind: 'refused', code: 'not_owner', perChild: [] };
  }
  const whole = treeRefusal({ snapshot, tree, count: children.length });
  if (whole !== null) {
    return { kind: 'refused', code: whole, perChild: [] };
  }
  const perChild = childRefusals({ snapshot, tree, children });
  const first = perChild[0];
  if (first !== undefined) {
    return { kind: 'refused', code: first.code, perChild };
  }
  let remaining = snapshot.remainingUsd;
  const ceilingsUsd: number[] = [];
  for (const child of children) {
    const ceiling = attemptCeilingUsd({ role: child.role, remainingUsd: remaining });
    ceilingsUsd.push(ceiling);
    remaining -= ceiling;
  }
  const lacking = ceilingsUsd.findIndex((ceiling) => ceiling <= AUTO_USD_EPSILON);
  if (lacking !== -1) {
    return {
      kind: 'refused',
      code: 'budget',
      perChild: [{ slot: lacking, code: 'budget', latestRevision: null }],
    };
  }
  return {
    kind: 'ok',
    ceilingsUsd,
    requestedUsd: ceilingsUsd.reduce((sum, ceiling) => sum + ceiling, 0),
  };
};
