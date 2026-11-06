import type { WorkspaceId } from '@goodboy/types';
import type { SliceDeps } from '../../slice-types';
import { EMPTY_SESSION_DRAFT, type SessionDraft } from './state';
import { storedSessionDraftText } from './storedSessionDraftText';

type Params = Readonly<{
  workspaceId: WorkspaceId;
}>;

type DraftParams = Readonly<{
  draft: SessionDraft | undefined;
}>;

const hasNoText = ({ draft }: DraftParams): boolean =>
  draft === undefined ||
  (draft.workflowGoal === '' && draft.agentPrompt === '' && draft.autoGoal === '');

export const hydrateSessionDraft = ({ set, get }: SliceDeps) => {
  return ({ workspaceId }: Params): void => {
    if (!hasNoText({ draft: get().sessionDrafts[workspaceId] })) {
      return;
    }
    const text = storedSessionDraftText.read({ workspaceId });
    if (text === null) {
      return;
    }
    set((state) => {
      const draft = state.sessionDrafts[workspaceId];
      if (!hasNoText({ draft })) {
        return state;
      }
      return {
        sessionDrafts: {
          ...state.sessionDrafts,
          [workspaceId]: { ...(draft ?? EMPTY_SESSION_DRAFT), ...text },
        },
      };
    });
  };
};
