import type { SessionId } from '@goodboy/types';

export type SessionSyncState = {
  readonly sessionSyncing: Readonly<Record<SessionId, true>>;
};

export const sessionSyncInitialState: SessionSyncState = {
  sessionSyncing: {},
};
