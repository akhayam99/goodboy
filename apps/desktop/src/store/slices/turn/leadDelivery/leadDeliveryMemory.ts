import type { LeadDeliveryBaseline, LeadDeliverySent } from '@goodboy/core/auto';
import type { AgentId, TurnEvent } from '@goodboy/types';

export type SessionInitEvent = Extract<TurnEvent, { kind: 'provider_session_init' }>;

type Pending = Readonly<{
  runId: string;
  sent: LeadDeliverySent;
  isFresh: boolean;
  heldInit: SessionInitEvent | null;
}>;

type AgentParams = Readonly<{ agentId: AgentId }>;

type RunParams = AgentParams & Readonly<{ runId: string }>;

type BeginParams = RunParams & Readonly<{ sent: LeadDeliverySent; isFresh: boolean }>;

type HoldParams = RunParams & Readonly<{ event: SessionInitEvent }>;

type AckParams = RunParams & Readonly<{ sessionId: string | null }>;

type Acked = Readonly<{ heldInit: SessionInitEvent | null }>;

const acked = new Map<AgentId, LeadDeliveryBaseline>();
const pending = new Map<AgentId, Pending>();

export const leadDeliveryMemory = {
  baselineOf: ({ agentId }: AgentParams): LeadDeliveryBaseline | null => acked.get(agentId) ?? null,
  begin: ({ agentId, runId, sent, isFresh }: BeginParams): void => {
    pending.set(agentId, { runId, sent, isFresh, heldInit: null });
  },
  hold: ({ agentId, runId, event }: HoldParams): boolean => {
    const entry = pending.get(agentId);
    if (entry === undefined || entry.runId !== runId) {
      return false;
    }
    pending.set(agentId, { ...entry, heldInit: event });
    return true;
  },
  ack: ({ agentId, runId, sessionId }: AckParams): Acked | null => {
    const entry = pending.get(agentId);
    if (entry === undefined || entry.runId !== runId) {
      return null;
    }
    pending.delete(agentId);
    const turnSessionId = entry.isFresh ? (entry.heldInit?.providerSessionId ?? null) : sessionId;
    if (turnSessionId === null) {
      acked.delete(agentId);
      return { heldInit: entry.heldInit };
    }
    acked.set(agentId, { sessionId: turnSessionId, sent: entry.sent });
    return { heldInit: entry.heldInit };
  },
  drop: ({ agentId, runId }: RunParams): void => {
    if (pending.get(agentId)?.runId === runId) {
      pending.delete(agentId);
    }
  },
  clear: (): void => {
    acked.clear();
    pending.clear();
  },
};
