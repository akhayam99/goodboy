import type { SessionId, WorkspaceId } from '@goodboy/types';

export type SessionPin = {
  readonly id: SessionId;
  readonly at: number;
};

export type SessionPinsState = {
  readonly sessionPins: Readonly<Record<WorkspaceId, ReadonlyArray<SessionPin>>>;
};

export const sessionPinsInitialState: SessionPinsState = {
  sessionPins: {},
};
