import { AUTO_DELEGATION_DEADLINE_MINUTES, NO_CLOSING_REASON } from '@goodboy/core/auto';
import {
  autoCountRunSlotAttemptStatement,
  autoKeepRunSlotStatement,
  endAutoAttemptStatement,
  insertAutoAttemptStatement,
  insertAutoReservationStatement,
  reconcileAutoReservationStatement,
  type AutoAttempt,
  type Database,
} from '@goodboy/db';
import { brandId, type AutoAttemptId, type AutoReservationId } from '@goodboy/types';
import { isRecord } from '@goodboy/types/helpers';
import { closeNudgeBaselineOf } from '../attemptBaseline';

export type StartCloseNudgeParams = Readonly<{
  db: Database;
  ownerId: string;
  nowMs: number;
  attempt: AutoAttempt;
  generation: number;
  nextAttemptId: AutoAttemptId;
  tail: string;
  costUsd: number | null;
  resultSnapshot: unknown;
}>;

const ABORT_ATTEMPT = 'nudge_attempt';
const ABORT_RESERVATION = 'nudge_reservation';
const ABORT_DELEGATION = 'nudge_delegation';
const ABORT_TREE = 'nudge_tree';

export const startCloseNudge = async ({
  db,
  ownerId,
  nowMs,
  attempt,
  generation,
  nextAttemptId,
  tail,
  costUsd,
  resultSnapshot,
}: StartCloseNudgeParams): Promise<boolean> => {
  const outcome = await db.transaction({
    statements: [
      endAutoAttemptStatement({
        attemptId: attempt.id,
        generation,
        outcome: 'failed',
        endReason: NO_CLOSING_REASON,
        resultSnapshot,
        nowMs,
        abortCode: ABORT_ATTEMPT,
      }),
      reconcileAutoReservationStatement({
        treeId: attempt.treeId,
        ownerKind: 'attempt',
        ownerId: attempt.id,
        costUsd,
        nowMs,
        abortCode: ABORT_RESERVATION,
      }),
      autoKeepRunSlotStatement({
        delegationId: attempt.delegationId,
        generation,
        deadlineAt: nowMs + AUTO_DELEGATION_DEADLINE_MINUTES * 60_000,
        abortCode: ABORT_DELEGATION,
      }),
      autoCountRunSlotAttemptStatement({
        treeId: attempt.treeId,
        ownerId,
        generation,
        nowMs,
        abortCode: ABORT_TREE,
      }),
      insertAutoAttemptStatement({
        id: nextAttemptId,
        delegationId: attempt.delegationId,
        treeId: attempt.treeId,
        generation,
        baseline: closeNudgeBaselineOf({ baseline: attempt.baseline, tail }),
        writeSet: isRecord(attempt.writeSet) ? attempt.writeSet : null,
        launchSnapshot: isRecord(attempt.launchSnapshot) ? attempt.launchSnapshot : null,
        nowMs,
      }),
      insertAutoReservationStatement({
        id: brandId<AutoReservationId>({ value: `reservation-${nextAttemptId}` }),
        treeId: attempt.treeId,
        ownerKind: 'attempt',
        ownerId: nextAttemptId,
        reservedUsd: 0,
        nowMs,
      }),
    ],
  });
  return outcome.status === 'committed';
};
