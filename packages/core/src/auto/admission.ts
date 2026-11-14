import { AUTO_USD_EPSILON, type AutoArtifact, type AutoTree } from '@goodboy/db';
import { admissionChildRefusals } from './admissionChildRefusals';
import { AUTO_BATCH_MAX_CHILDREN, AUTO_MAX_OPEN_CHILDREN, AUTO_TREE_LIMITS } from './limits';
import type { AutoRefusalCode } from './refusals';
import type { AutoDelegationRole } from './roles';
import type { LeadPermissionRows } from './permissions';
import type { AdmissionParentFacts, AdmissionSubstep } from './substepAdmission';

export type AdmissionPermissions = Pick<
  LeadPermissionRows,
  'approvePlan' | 'startReaders' | 'startWriters' | 'addProject'
>;

export type AdmissionArtifactRef = Readonly<{
  artifactId: string;
  revision: number;
}>;

export type AdmissionChild = Readonly<{
  childAgentId: string;
  role: AutoDelegationRole;
  reviseOf: AdmissionArtifactRef | null;
  inputArtifacts: ReadonlyArray<AdmissionArtifactRef>;
  substep?: AdmissionSubstep | null;
}>;

export type AdmissionLiveArtifact = Readonly<{
  revision: number;
  status: string;
  sourceText: string;
}>;

export type AdmissionArtifactFacts = Readonly<{
  registered: AutoArtifact | null;
  live: AdmissionLiveArtifact | null;
  openWriterRoles?: ReadonlyArray<string>;
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
  permissions: AdmissionPermissions;
  parents?: ReadonlyArray<AdmissionParentFacts>;
}>;

export type AdmissionChildRefusal = Readonly<{
  slot: number;
  code: AutoRefusalCode;
  latestRevision: number | null;
}>;

export type AdmissionVerdict =
  | Readonly<{ kind: 'ok' }>
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
  const perChild = admissionChildRefusals({ snapshot, tree, children });
  const first = perChild[0];
  if (first !== undefined) {
    return { kind: 'refused', code: first.code, perChild };
  }
  if (snapshot.remainingUsd <= AUTO_USD_EPSILON) {
    return { kind: 'refused', code: 'budget', perChild: [] };
  }
  return { kind: 'ok' };
};
