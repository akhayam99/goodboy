import type { MountId, SessionEvent, SessionId } from '@goodboy/types';
import type { SettledStops } from './settledStopsMemory';

type Params = {
  readonly settled: SettledStops;
  readonly events: ReadonlyArray<SessionEvent> | undefined;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const settledStopsOfMount = ({
  settled,
  events,
  sessionId,
  mountId,
}: Params): SettledStops | null => {
  const known = new Set(settled[sessionId] ?? []);
  const fresh = (events ?? [])
    .filter(
      (event) =>
        event.kind === 'history_stopped' &&
        event.payload?.origin === 'rebase' &&
        event.payload.mountId === mountId &&
        !known.has(event.id),
    )
    .map((event) => event.id);
  if (fresh.length === 0) {
    return null;
  }
  return { ...settled, [sessionId]: [...known, ...fresh] };
};
