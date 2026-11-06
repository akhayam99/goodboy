import type { WorkspaceId } from '@goodboy/types';
import { EMPTY_SESSION_DRAFT, type SessionDraft } from './state';
import { storedSessionDraftText } from './storedSessionDraftText';
import type { GetFn, SetFn } from './types';

export type PatchSessionDraftParams = {
  readonly workspaceId: WorkspaceId;
  readonly patch: Partial<SessionDraft>;
};

const TEXT_FIELDS: ReadonlyArray<keyof SessionDraft> = ['workflowGoal', 'agentPrompt', 'autoGoal'];

export const patchSessionDraft = (set: SetFn, get: GetFn) => {
  return ({ workspaceId, patch }: PatchSessionDraftParams): void => {
    set((state) => ({
      sessionDrafts: {
        ...state.sessionDrafts,
        [workspaceId]: { ...(state.sessionDrafts[workspaceId] ?? EMPTY_SESSION_DRAFT), ...patch },
      },
    }));
    const written = get().sessionDrafts[workspaceId];
    if (written === undefined || !TEXT_FIELDS.some((field) => field in patch)) {
      return;
    }
    storedSessionDraftText.write({ workspaceId, text: written });
  };
};
