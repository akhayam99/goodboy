import type { WorkspaceId } from '@goodboy/types';

export const SESSION_PINS_KEY_PREFIX = 'sessions.pinned.';

export const sessionPinsKey = ({ workspaceId }: { readonly workspaceId: WorkspaceId }): string =>
  `${SESSION_PINS_KEY_PREFIX}${workspaceId}`;
