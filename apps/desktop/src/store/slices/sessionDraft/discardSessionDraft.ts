import type { WorkspaceId } from '@goodboy/types';
import { kickoffDraftKey } from '../workflowDrafts/kickoffDraftKey';
import type { SetFn } from './types';

export type DiscardSessionDraftParams = {
  readonly workspaceId: WorkspaceId;
};

export const discardSessionDraft = (set: SetFn) => {
  return ({ workspaceId }: DiscardSessionDraftParams): void => {
    const builderKey = kickoffDraftKey({ workspaceId });
    set((state) => {
      const hasDraft = state.sessionDrafts[workspaceId] !== undefined;
      const hasBuilderDraft = state.workflowDrafts?.[builderKey] !== undefined;
      if (!hasDraft && !hasBuilderDraft) {
        return {};
      }
      const sessionDrafts = { ...state.sessionDrafts };
      delete sessionDrafts[workspaceId];
      const workflowDrafts = { ...state.workflowDrafts };
      delete workflowDrafts[builderKey];
      return { sessionDrafts, workflowDrafts };
    });
  };
};
