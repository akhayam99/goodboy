import type { ClearNewSessionDraftParams, SetFn } from './types';

type Params = {
  readonly set: SetFn;
};

export const clearNewSessionDraft = ({ set }: Params) => {
  return ({ workspaceId }: ClearNewSessionDraftParams) => {
    set((state) => {
      if (!(workspaceId in state.newSessionDrafts)) {
        return state;
      }
      const next = { ...state.newSessionDrafts };
      delete next[workspaceId];
      return { newSessionDrafts: next };
    });
  };
};
