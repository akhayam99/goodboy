import { getAutoAttempt, type AutoAttempt, type AutoDelegation, type Database } from '@goodboy/db';
import type { AutoAttemptId } from '@goodboy/types';
import { runSlotStatements } from './runSlotStatements';

export type StartQueuedAttemptParams = Readonly<{
  db: Database;
  ownerId: string;
  nowMs: number;
  delegation: AutoDelegation;
  attemptId: AutoAttemptId;
  generation: number;
}>;

const ABORT_TREE = 'queued_tree';
const ABORT_SLOT = 'queued_slot';
const ABORT_ATTEMPT = 'queued_attempt';

export const startQueuedAttempt = async ({
  db,
  ownerId,
  nowMs,
  delegation,
  attemptId,
  generation,
}: StartQueuedAttemptParams): Promise<AutoAttempt | null> => {
  const outcome = await db.transaction({
    statements: [
      ...runSlotStatements({
        delegation,
        ownerId,
        generation,
        nowMs,
        treeAbortCode: ABORT_TREE,
        slotAbortCode: ABORT_SLOT,
      }),
      {
        sql: `UPDATE auto_attempts SET started_at = ?
          WHERE id = ? AND delegation_id = ? AND generation = ? AND state = 'starting'
            AND run_id IS NULL`,
        params: [nowMs, attemptId, delegation.id, generation],
        abortWhen: 'noChanges',
        abortCode: ABORT_ATTEMPT,
      },
    ],
  });
  if (outcome.status === 'aborted') {
    return null;
  }
  return getAutoAttempt({ db, attemptId });
};
