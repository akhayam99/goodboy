import { insertTurnEventsBatch, type PendingTurnEventInsert } from '@goodboy/db';
import type { AgentId, IsoDateTime, ProviderRunId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { tauriDatabase } from '../../../shared/lib/db';

const TEXT_HOLD_MS = 250;

let pendingTurnEventInserts: PendingTurnEventInsert[] = [];
let turnEventFlushScheduled = false;
const heldText = new Map<AgentId, PendingTurnEventInsert>();
let heldTextTimer: ReturnType<typeof setTimeout> | null = null;

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

type ReleaseParams = {
  readonly agentId: AgentId;
};

const releaseHeldText = ({ agentId }: ReleaseParams): void => {
  const held = heldText.get(agentId);
  if (held === undefined) {
    return;
  }
  heldText.delete(agentId);
  pendingTurnEventInserts.push(held);
};

const releaseAllHeldText = (): void => {
  heldTextTimer = null;
  for (const agentId of [...heldText.keys()]) {
    releaseHeldText({ agentId });
  }
  scheduleTurnEventFlush();
};

type HoldParams = {
  readonly insert: PendingTurnEventInsert;
  readonly runId: ProviderRunId;
  readonly delta: string;
  readonly at: IsoDateTime;
};

const holdText = ({ insert, runId, delta, at }: HoldParams): void => {
  const held = heldText.get(insert.agentId);
  if (held !== undefined && held.event.kind === 'assistant_text' && held.event.runId === runId) {
    heldText.set(insert.agentId, {
      ...held,
      event: { ...held.event, delta: `${held.event.delta}${delta}` },
    });
    return;
  }
  releaseHeldText({ agentId: insert.agentId });
  heldText.set(insert.agentId, { ...insert, event: { kind: 'assistant_text', runId, delta, at } });
  heldTextTimer ??= setTimeout(releaseAllHeldText, TEXT_HOLD_MS);
};

export const queueTurnEventInsert = (insert: PendingTurnEventInsert): void => {
  const { event } = insert;
  if (event.kind === 'assistant_text' && event.isPartial === true) {
    holdText({ insert, runId: event.runId, delta: event.delta, at: event.at });
    return;
  }
  releaseHeldText({ agentId: insert.agentId });
  pendingTurnEventInserts.push(insert);
  scheduleTurnEventFlush();
};
