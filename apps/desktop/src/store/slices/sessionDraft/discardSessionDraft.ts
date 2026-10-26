import type { WorkspaceId } from '@goodboy/types';
import type { GetFn, SetFn } from './types';

export type DiscardSessionDraftParams = {
  readonly workspaceId: WorkspaceId;
};

export const discardSessionDraft = (set: SetFn, get: GetFn) => {
  return ({ workspaceId }: DiscardSessionDraftParams): void => {
    set((state) => {
      if (state.sessionDrafts[workspaceId] === undefined) {
        return {};
      }
      const sessionDrafts = { ...state.sessionDrafts };
      delete sessionDrafts[workspaceId];
      return { sessionDrafts };
    });
    get().closeSessionDraft({ workspaceId });
  };
};
