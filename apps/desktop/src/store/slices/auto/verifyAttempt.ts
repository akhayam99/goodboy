import {
  isAutoWriterRole,
  notCheckedOf,
  type ChecksVerdict,
  type ChildClosing,
} from '@goodboy/core';
import type { AutoDelegation, AutoTree } from '@goodboy/db';
import { delegationRoleOf } from './attemptEnvelope';
import { runAutoChecks } from './runAutoChecks';
import type { ChildTurnEnded } from './ports';
import type { AgentVerbContext } from './verbContext';

export type VerifyAttemptParams = Readonly<{
  ctx: AgentVerbContext;
  tree: AutoTree;
  delegation: AutoDelegation;
  ended: ChildTurnEnded;
  closing: ChildClosing;
  endHead: string | null;
}>;

export const verifyAttempt = async ({
  ctx,
  tree,
  delegation,
  ended,
  closing,
  endHead,
}: VerifyAttemptParams): Promise<ChecksVerdict | null> => {
  const isWriter = isAutoWriterRole({ role: delegationRoleOf({ delegation }) });
  if (!isWriter || ended.exit !== 'ok' || closing.completion !== 'done') {
    return null;
  }
  const mountId = delegation.target['mountId'];
  const worktreePath = delegation.target['worktreePath'];
  if (typeof mountId !== 'string' || typeof worktreePath !== 'string') {
    return null;
  }
  if (endHead === null) {
    return notCheckedOf({ reason: 'not_available', commit: null });
  }
  return runAutoChecks({
    ports: ctx.ports,
    sessionId: tree.sessionId,
    mountId,
    worktreePath,
    expectedHead: endHead,
  });
};
