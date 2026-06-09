import { insertTurnEventsBatch, type PendingTurnEventInsert } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { formatError } from '../../../shared/lib/errors';

let pendingTurnEventInserts: PendingTurnEventInsert[] = [];
let turnEventFlushScheduled = false;

function scheduleTurnEventFlush(): void {
  if (turnEventFlushScheduled) {
    return;
  }
  turnEventFlushScheduled = true;
  queueMicrotask(() => {
    turnEventFlushScheduled = false;
    if (pendingTurnEventInserts.length === 0) {
      return;
    }
    const batch = pendingTurnEventInserts;
    pendingTurnEventInserts = [];
    void insertTurnEventsBatch(tauriDatabase, batch).catch((err) => {
      if (import.meta.env.DEV) {
        const message = formatError(err);
        console.warn(`[turn-events] batch insert failed (${batch.length} rows): ${message}`);
      }
    });
  });
}

export const queueTurnEventInsert = (insert: PendingTurnEventInsert): void => {
  pendingTurnEventInserts.push(insert);
  scheduleTurnEventFlush();
};
