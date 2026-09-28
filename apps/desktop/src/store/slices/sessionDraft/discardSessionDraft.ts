import type { WorkspaceId } from '@goodboy/types';
import { kickoffDraftKey } from '../workflowDrafts/kickoffDraftKey';
import type { SetFn } from './types';

export type DiscardSessionDraftParams = {
  readonly workspaceId: WorkspaceId;
};

export const discardSessionDraft = (set: SetFn) => {
  return ({ workspaceId }: DiscardSessionDraftParams): void => {
    const builderKeys = [
      kickoffDraftKey({ workspaceId }),
      kickoffDraftKey({ workspaceId, lane: 'task' }),
    ];
    set((state) => {
      const hasDraft = state.sessionDrafts[workspaceId] !== undefined;
      const hasBuilderDraft = builderKeys.some((key) => state.workflowDrafts?.[key] !== undefined);
      if (!hasDraft && !hasBuilderDraft) {
        return {};
      }
      const sessionDrafts = { ...state.sessionDrafts };
      delete sessionDrafts[workspaceId];
      const workflowDrafts = { ...state.workflowDrafts };
      for (const key of builderKeys) {
        delete workflowDrafts[key];
      }
      return { sessionDrafts, workflowDrafts };
    });
  };
};
