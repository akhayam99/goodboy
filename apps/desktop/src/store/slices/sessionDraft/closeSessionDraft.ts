import type { WorkspaceId } from '@goodboy/types';
import type { GetFn } from './types';

export type CloseSessionDraftParams = {
  readonly workspaceId: WorkspaceId;
};

export const closeSessionDraft = (get: GetFn) => {
  return ({ workspaceId }: CloseSessionDraftParams): void => {
    const state = get();
    if (state.openSessionDraftWorkspaceId !== workspaceId || state.currentSessionId !== null) {
      return;
    }
    state.up();
  };
};
