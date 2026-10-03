import type { SessionContextItem, SessionId, WorkspaceId } from '@goodboy/types';

export type ContextItemsState = {
  readonly sessionContextItems: Readonly<Record<SessionId, ReadonlyArray<SessionContextItem>>>;
  readonly workspaceLearnings: Readonly<Record<WorkspaceId, ReadonlyArray<SessionContextItem>>>;
};

export const initialContextItemsState: ContextItemsState = {
  sessionContextItems: {},
  workspaceLearnings: {},
};
