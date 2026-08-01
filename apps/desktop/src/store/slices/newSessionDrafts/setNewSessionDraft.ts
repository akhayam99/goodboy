import { EMPTY_NEW_SESSION_DRAFT } from './emptyNewSessionDraft';
import type { SetFn, SetNewSessionDraftParams } from './types';

type Params = {
  readonly set: SetFn;
};

export const setNewSessionDraft = ({ set }: Params) => {
  return ({ workspaceId, draft }: SetNewSessionDraftParams) => {
    set((state) => ({
      newSessionDrafts: {
        ...state.newSessionDrafts,
        [workspaceId]: {
          ...(state.newSessionDrafts[workspaceId] ?? EMPTY_NEW_SESSION_DRAFT),
          ...draft,
        },
      },
    }));
  };
};
