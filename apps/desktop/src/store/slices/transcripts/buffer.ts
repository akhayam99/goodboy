import type { AgentId, Agent, SessionId, TurnEvent } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { SetFn } from './types';

const COALESCE_WINDOW_MS = 16;
const COALESCED_KINDS: ReadonlySet<TurnEvent['kind']> = new Set(['assistant_text']);

type PendingTranscript = {
  readonly sessionId: SessionId;
  readonly events: TurnEvent[];
};

const pending = new Map<AgentId, PendingTranscript>();
let pendingWriter: SetFn | null = null;
let scheduledFlush: ReturnType<typeof setTimeout> | null = null;
let lastFlushAt = 0;

type DrainParams = {
  readonly state: AppStore;
};

const drainPending = ({ state }: DrainParams): Partial<AppStore> => {
  const transcripts: Record<string, ReadonlyArray<TurnEvent>> = { ...state.transcripts };
  let unknownPayloadCounts: Readonly<Record<string, number>> = state.unknownPayloadCounts;
  let sessionPhaseRuns: Readonly<Record<SessionId, ReadonlyArray<Agent>>> = state.sessionPhaseRuns;

  for (const [agentId, entry] of pending) {
    transcripts[agentId] = [...(state.transcripts[agentId] ?? []), ...entry.events];
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

  const elapsed = Date.now() - lastFlushAt;
  if (!COALESCED_KINDS.has(event.kind) || elapsed >= COALESCE_WINDOW_MS) {
    flushTurnEvents();
    return;
  }
  if (scheduledFlush !== null) {
    return;
  }
  scheduledFlush = setTimeout(flushTurnEvents, COALESCE_WINDOW_MS - elapsed);
};

type DropParams = {
  readonly agentId: AgentId;
};

export const dropPendingTurnEvents = ({ agentId }: DropParams): void => {
  pending.delete(agentId);
};
