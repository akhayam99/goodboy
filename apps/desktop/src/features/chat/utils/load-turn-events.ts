// Loads turn-event rows from SQLite and parses them in a Web Worker so the
// JSON.parse storm never blocks the main thread. Falls back to inline parse
// when Worker construction fails (test envs, exotic browsers).

import { invoke } from '@tauri-apps/api/core';
import type { AgentId, TurnEvent } from '@kay-am/types';
import type { ParseRequest, ParseResponse } from './parse-turn-events.worker';

interface TurnEventRow {
  id: string;
  session_id: string;
  agent_id: string;
  payload: string;
  created_at: number;
}

let worker: Worker | null = null;
let workerFailed = false;

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./parse-turn-events.worker.ts', import.meta.url), {
      type: 'module',
    });
    return worker;
  } catch {
    workerFailed = true;
    return null;
  }
}

let nextId = 0;

function parseInline(rows: ReadonlyArray<TurnEventRow>): ReadonlyArray<TurnEvent> {
  const out: TurnEvent[] = [];
  for (const row of rows) {
    try {
      out.push(JSON.parse(row.payload) as TurnEvent);
    } catch {
      // skip
    }
  }
  return out;
}

function parseInWorker(rows: ReadonlyArray<TurnEventRow>): Promise<ReadonlyArray<TurnEvent>> {
  const w = getWorker();
  if (!w) return Promise.resolve(parseInline(rows));
  return new Promise((resolve) => {
    const id = ++nextId;
    const handler = (e: MessageEvent<ParseResponse>) => {
      if (e.data.id !== id) return;
      w.removeEventListener('message', handler);
      resolve(e.data.events);
    };
    w.addEventListener('message', handler);
    w.postMessage({ id, rows } satisfies ParseRequest);
  });
}

export async function loadTurnEventsForAgent(
  agentId: AgentId,
  opts?: { readonly limit?: number },
): Promise<ReadonlyArray<TurnEvent>> {
  const sql =
    opts?.limit !== undefined
      ? 'SELECT * FROM turn_events WHERE agent_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?'
      : 'SELECT * FROM turn_events WHERE agent_id = ? ORDER BY created_at ASC, rowid ASC';
  const params = opts?.limit !== undefined ? [agentId, opts.limit] : [agentId];
  const rows = await invoke<ReadonlyArray<TurnEventRow>>('db_select', { sql, params });
  // Small slices (< 30 events) parse faster inline — worker overhead would
  // dominate. Above that, the worker keeps the main thread responsive: traces
  // showed ~52 events parsing in ~860ms on the main thread, easily a 1s
  // freeze for the user. Worker overhead is roughly 15-20ms regardless.
  if (rows.length < 30) {
    const events = parseInline(rows);
    if (opts?.limit !== undefined) {
      return events.slice().reverse();
    }
    return events;
  }
  const events = await parseInWorker(rows);
  if (opts?.limit !== undefined) {
    return events.slice().reverse();
  }
  return events;
}
