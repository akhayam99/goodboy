import { AUTO_USD_EPSILON } from '@goodboy/db';
import type { AdmissionSnapshot } from './admission';
import { AUTO_MAX_OPEN_CHILDREN } from './limits';
import type { AutoRefusalCode } from './refusals';

export type DiagnoseResumeParams = Readonly<{
  snapshot: AdmissionSnapshot;
}>;

export type ResumeVerdict =
  Readonly<{ kind: 'ok' }> | Readonly<{ kind: 'refused'; code: AutoRefusalCode }>;

export const diagnoseResume = ({ snapshot }: DiagnoseResumeParams): ResumeVerdict => {
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
  if (snapshot.openCount + 1 > AUTO_MAX_OPEN_CHILDREN) {
    return { kind: 'refused', code: 'breadth_cap' };
  }
  if (snapshot.remainingUsd <= AUTO_USD_EPSILON) {
    return { kind: 'refused', code: 'budget' };
  }
  return { kind: 'ok' };
};
