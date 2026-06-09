import { insertTurnEventsBatch, type PendingTurnEventInsert } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { formatError } from '../../../shared/lib/errors';

// Streaming providers can emit 50-200 turn_events per second. Persisting each
// one with its own `insertTurnEvent` used to grab the Rust `Mutex<Connection>`
// at the same cadence and block every concurrent reader, including a
// freshly-clicked workspace/session switch. The buffer below coalesces
// non-critical events between microtasks and flushes them through a single
// multi-row INSERT, collapsing the write storm to ~one IPC per frame.
let pendingTurnEventInserts: PendingTurnEventInsert[] = [];
let turnEventFlushScheduled = false;

function scheduleTurnEventFlush(): void {
  if (turnEventFlushScheduled) return;
  turnEventFlushScheduled = true;
  queueMicrotask(() => {
    turnEventFlushScheduled = false;
    if (pendingTurnEventInserts.length === 0) return;
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
