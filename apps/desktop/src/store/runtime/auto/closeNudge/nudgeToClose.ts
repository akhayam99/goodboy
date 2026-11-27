import { isCloseNudgeDue, type ChildClosing, type DelegationResultV1 } from '@goodboy/core/auto';
import {
  listAgentQueuedMessages,
  listAutoAttemptsOfDelegation,
  type AutoAttempt,
  type AutoDelegation,
} from '@goodboy/db';
import { brandId, type AutoAttemptId } from '@goodboy/types';
import { closeNudgeOf } from '../attemptBaseline';
import type { ChildTurnEnded } from '../ports';
import type { AgentVerbContext } from '../verbContext';
import { startCloseNudge } from './startCloseNudge';

export type NudgeToCloseParams = Readonly<{
  ctx: AgentVerbContext;
  ended: ChildTurnEnded;
  delegation: AutoDelegation;
  attempt: AutoAttempt;
  closing: ChildClosing;
  envelope: DelegationResultV1;
  reason: string | null;
}>;

export const nudgeToClose = async ({
  ctx,
  ended,
  delegation,
  attempt,
  closing,
  envelope,
  reason,
}: NudgeToCloseParams): Promise<boolean> => {
  if (!isCloseNudgeDue({ exit: ended.exit, reason })) {
    return false;
  }
  const attempts = await listAutoAttemptsOfDelegation({ db: ctx.db, delegationId: delegation.id });
  if (attempts.some((earlier) => closeNudgeOf({ baseline: earlier.baseline }) !== null)) {
    return false;
  }
  const waiting = await listAgentQueuedMessages(ctx.db, [delegation.childAgentId]);
  if (waiting.length > 0) {
    return false;
  }
  return startCloseNudge({
    db: ctx.db,
    ownerId: ctx.scheduler.ownerId,
    nowMs: ctx.now(),
    attempt,
    generation: ended.generation,
    nextAttemptId: brandId<AutoAttemptId>({ value: ctx.ports.newId() }),
    tail: closing.summary,
    costUsd: ended.costUsd,
    resultSnapshot: { envelope },
  });
};
