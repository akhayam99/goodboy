import { AUTO_USD_EPSILON } from '@goodboy/db';
import type { AdmissionSnapshot } from './admission';
import { attemptCeilingUsd } from './limits';
import type { AutoRefusalCode } from './refusals';
import type { AutoDelegationRole } from './roles';

export type DiagnoseResumeParams = Readonly<{
  snapshot: AdmissionSnapshot;
  role: AutoDelegationRole;
}>;

export type ResumeVerdict =
  | Readonly<{ kind: 'ok'; ceilingUsd: number }>
  | Readonly<{ kind: 'refused'; code: AutoRefusalCode }>;

export const diagnoseResume = ({ snapshot, role }: DiagnoseResumeParams): ResumeVerdict => {
  const tree = snapshot.tree;
  if (tree === null) {
    return { kind: 'refused', code: 'not_owner' };
  }
  const isOwner =
    tree.schedulerOwner === snapshot.ownerId &&
    tree.ownerLeaseExpiresAt !== null &&
    tree.ownerLeaseExpiresAt > snapshot.nowMs;
  if (!isOwner) {
    return { kind: 'refused', code: 'not_owner' };
  }
  if (tree.rootAgentId !== snapshot.callerAgentId) {
    return { kind: 'refused', code: 'depth_cap' };
  }
  if (tree.stopState !== 'none' || tree.phase === 'stopping' || tree.phase === 'stopped') {
    return { kind: 'refused', code: 'tree_stopped' };
  }
  if (tree.generation !== snapshot.expectedGeneration) {
    return { kind: 'refused', code: 'generation_changed' };
  }
  const isTurnOpen = tree.phase === 'deciding' || tree.phase === 'delegating';
  if (!isTurnOpen || tree.activeRunId !== snapshot.expectedRunId) {
    return { kind: 'refused', code: 'not_deciding' };
  }
  if (snapshot.nowMs >= tree.hardDeadlineAt) {
    return { kind: 'refused', code: 'limit_wall_clock' };
  }
  const ceilingUsd = attemptCeilingUsd({ role, remainingUsd: snapshot.remainingUsd });
  if (ceilingUsd <= AUTO_USD_EPSILON) {
    return { kind: 'refused', code: 'budget' };
  }
  return { kind: 'ok', ceilingUsd };
};
