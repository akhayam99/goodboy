import type { SessionEvent } from '@goodboy/types';

type Params = {
  readonly event: SessionEvent;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly liveAgentIds?: ReadonlySet<string>;
};

type OrphanedStopParams = {
  readonly event: SessionEvent;
  readonly liveAgentIds: ReadonlySet<string> | undefined;
};

const isOrphanedStop = ({ event, liveAgentIds }: OrphanedStopParams): boolean => {
  const agentId = event.payload?.agentId;
  return (
    event.kind === 'history_stopped' &&
    liveAgentIds !== undefined &&
    agentId !== undefined &&
    !liveAgentIds.has(agentId)
  );
};

const isHistoryEvent = ({ event }: { readonly event: SessionEvent }): boolean =>
  event.kind.startsWith('history_');

const isSuperseded = ({ event, events }: Params): boolean => {
  const mountId = event.payload?.mountId ?? null;
  return events.some(
    (other) =>
      other.id !== event.id &&
      isHistoryEvent({ event: other }) &&
      (other.payload?.mountId ?? null) === mountId &&
      other.createdAt > event.createdAt,
  );
};

export const hasHistoryRecovery = ({ event, events, liveAgentIds }: Params): boolean => {
  if (
    !isHistoryEvent({ event }) ||
    isSuperseded({ event, events }) ||
    isOrphanedStop({ event, liveAgentIds })
  ) {
    return false;
  }
  if (event.kind === 'history_rewritten') {
    return event.payload?.backupRef != null;
  }
  return event.kind === 'history_pushed' || event.kind === 'history_stopped';
};
