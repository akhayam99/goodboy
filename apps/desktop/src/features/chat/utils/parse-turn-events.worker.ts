/// <reference lib="webworker" />

// Worker for parsing turn-event payloads off the main thread. Phase-2
// transcript backfill returns up to a few hundred rows whose `payload`
// field is a JSON string — parsing them in serial was eating 800ms+ on
// the main thread, freezing scroll/clicks for a full second after the
// session-switch skeleton rendered.
//
// Protocol: { id, rows: [{ payload, ... }] } → { id, events: TurnEvent[] }
// Invalid payloads are silently dropped (matches packages/db rowToEvent).

import type { TurnEvent } from '@kay-am/types';

interface TurnEventRow {
  readonly id: string;
  readonly session_id: string;
  readonly agent_id: string;
  readonly payload: string;
  readonly created_at: number;
}

export interface ParseRequest {
  id: number;
  rows: ReadonlyArray<TurnEventRow>;
}

export interface ParseResponse {
  id: number;
  events: ReadonlyArray<TurnEvent>;
}

function rowToEvent(row: TurnEventRow): TurnEvent | null {
  try {
    return JSON.parse(row.payload) as TurnEvent;
  } catch {
    return null;
  }
}

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<ParseRequest>) => {
  const { id, rows } = e.data;
  const events: TurnEvent[] = [];
  for (const row of rows) {
    const evt = rowToEvent(row);
    if (evt !== null) events.push(evt);
  }
  self.postMessage({ id, events } satisfies ParseResponse);
};
