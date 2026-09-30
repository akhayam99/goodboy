import type { SessionId, SessionEvent } from '@goodboy/types';

export type SessionEventsState = {
  readonly sessionEvents: Readonly<Record<SessionId, ReadonlyArray<SessionEvent> | undefined>>;
};

export const sessionEventsInitialState: SessionEventsState = {
  sessionEvents: {},
};
