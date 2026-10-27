import type { AgentId, Agent, SessionId, TurnEvent } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { SetFn } from './types';

const COALESCE_WINDOW_MS = 16;
const SLOWEST_COALESCE_WINDOW_MS = 100;
const FULL_SPEED_ROWS = 1000;
const SLOWEST_ROWS = 5000;
const COALESCED_KINDS: ReadonlySet<TurnEvent['kind']> = new Set(['assistant_text']);

type PendingTranscript = {
  readonly sessionId: SessionId;
  readonly events: TurnEvent[];
};

const pending = new Map<AgentId, PendingTranscript>();
const rowCounts = new Map<AgentId, number>();
let pendingWriter: SetFn | null = null;
let scheduledFlush: ReturnType<typeof setTimeout> | null = null;
let lastFlushAt = 0;

type WindowParams = {
  readonly rows: number;
};

const coalesceWindowMs = ({ rows }: WindowParams): number => {
  if (rows <= FULL_SPEED_ROWS) {
    return COALESCE_WINDOW_MS;
  }
  if (rows >= SLOWEST_ROWS) {
    return SLOWEST_COALESCE_WINDOW_MS;
  }
  const share = (rows - FULL_SPEED_ROWS) / (SLOWEST_ROWS - FULL_SPEED_ROWS);
  return Math.round(COALESCE_WINDOW_MS + share * (SLOWEST_COALESCE_WINDOW_MS - COALESCE_WINDOW_MS));
};

const pendingWindowMs = (): number => {
  let rows = 0;
  for (const agentId of pending.keys()) {
    rows = Math.max(rows, rowCounts.get(agentId) ?? 0);
  }
  return coalesceWindowMs({ rows });
};

type DrainParams = {
  readonly state: AppStore;
};

const drainPending = ({ state }: DrainParams): Partial<AppStore> => {
  const transcripts: Record<string, ReadonlyArray<TurnEvent>> = { ...state.transcripts };
  let unknownPayloadCounts: Readonly<Record<string, number>> = state.unknownPayloadCounts;
  let sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<Agent>>> = state.sessionPhaseRuns;

  for (const [agentId, entry] of pending) {
    const next = [...(state.transcripts[agentId] ?? []), ...entry.events];
    transcripts[agentId] = next;
    rowCounts.set(agentId, next.length);
    for (const event of entry.events) {
      if (event.kind === 'unknown_payload') {
        const key = `${event.adapter}:${event.payloadType}`;
        unknownPayloadCounts = {
          ...unknownPayloadCounts,
          [key]: (unknownPayloadCounts[key] ?? 0) + 1,
        };
        continue;
      }
      if (event.kind === 'provider_session_init') {
        const provider = event.provider;
        if (provider === undefined) {
          continue;
        }
        const runs = sessionPhaseRuns[entry.sessionId] ?? [];
        sessionPhaseRuns = {
          ...sessionPhaseRuns,
          [entry.sessionId]: runs.map((run) =>
            run.id === agentId
              ? {
                  ...run,
                  providerSessionId: event.providerSessionId,
                  providerSessionProviderId: provider,
                }
              : run,
          ),
        };
      }
    }
  }

  pending.clear();
  return { transcripts, unknownPayloadCounts, sessionPhaseRuns };
};

export const flushTurnEvents = (): void => {
  if (scheduledFlush !== null) {
    clearTimeout(scheduledFlush);
    scheduledFlush = null;
  }
  lastFlushAt = Date.now();
  const write = pendingWriter;
  if (pending.size === 0 || write === null) {
    return;
  }
  write((state) => drainPending({ state }));
};

type BufferParams = {
  readonly set: SetFn;
  readonly agentId: AgentId;
  readonly sessionId: SessionId;
  readonly event: TurnEvent;
};

export const bufferTurnEvent = ({ set, agentId, sessionId, event }: BufferParams): void => {
  pendingWriter = set;
  const entry = pending.get(agentId) ?? { sessionId, events: [] };
  entry.events.push(event);
  pending.set(agentId, entry);

  const windowMs = pendingWindowMs();
  const elapsed = Date.now() - lastFlushAt;
  if (!COALESCED_KINDS.has(event.kind) || elapsed >= windowMs) {
    flushTurnEvents();
    return;
  }
  if (scheduledFlush !== null) {
    return;
  }
  scheduledFlush = setTimeout(flushTurnEvents, windowMs - elapsed);
};

type DropParams = {
  readonly agentIds: ReadonlyArray<AgentId>;
};

export const dropPendingTurnEvents = ({ agentIds }: DropParams): void => {
  for (const agentId of agentIds) {
    pending.delete(agentId);
    rowCounts.delete(agentId);
  }
};

export const clearPendingTurnEvents = (): void => {
  pending.clear();
  rowCounts.clear();
};
