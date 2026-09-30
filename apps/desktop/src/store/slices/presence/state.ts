import type { WorkspaceId } from '@goodboy/types';

export type PresenceState = {
  readonly windowPresence: Readonly<Record<string, WorkspaceId | null>>;
};

export const presenceInitialState: PresenceState = {
  windowPresence: {},
};
