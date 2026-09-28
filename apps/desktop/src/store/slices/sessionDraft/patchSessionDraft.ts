import type { WorkspaceId } from '@goodboy/types';
import { EMPTY_SESSION_DRAFT, type SessionDraft } from './state';
import type { SetFn } from './types';

export type PatchSessionDraftParams = {
  readonly workspaceId: WorkspaceId;
  readonly patch: Partial<SessionDraft>;
};

export const patchSessionDraft = (set: SetFn) => {
  return ({ workspaceId, patch }: PatchSessionDraftParams): void => {
    set((state) => ({
      sessionDrafts: {
        ...state.sessionDrafts,
        [workspaceId]: { ...(state.sessionDrafts[workspaceId] ?? EMPTY_SESSION_DRAFT), ...patch },
      },
    }));
  };
};
