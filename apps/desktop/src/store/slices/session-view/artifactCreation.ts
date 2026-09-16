import type { IsoDateTime } from '@goodboy/types';
import { defaultArtifactDraft } from '../artifactDrafts/defaultArtifactDraft';
import type {
  CloseArtifactCreationParams,
  GetFn,
  OpenArtifactCreationParams,
  SetFn,
} from './types';

export const openArtifactCreation = (set: SetFn, get: GetFn) => {
  return ({
    sessionId,
    kind,
    workflowRunId = null,
    note = null,
  }: OpenArtifactCreationParams): void => {
    get().hydrateArtifactDrafts({ sessionId });
    if (workflowRunId !== null) {
      const current = get().artifactDrafts[sessionId]?.[kind];
      const base =
        current ?? defaultArtifactDraft({ kind, now: new Date().toISOString() as IsoDateTime });
      get().setArtifactDraft({
        sessionId,
        draft: {
          ...base,
          basedOn: { kind: 'workflow-run', workflowRunId },
          updatedAt: new Date().toISOString() as IsoDateTime,
        },
      });
    }
    get().setActiveLens(sessionId, 'plans');
    set((s) => ({
      focusedPlanId: { ...s.focusedPlanId, [sessionId]: null },
      artifactCreation: { ...s.artifactCreation, [sessionId]: { kind, note } },
    }));
  };
};

export const closeArtifactCreation = (set: SetFn) => {
  return ({ sessionId }: CloseArtifactCreationParams): void => {
    set((s) => ({ artifactCreation: { ...s.artifactCreation, [sessionId]: null } }));
  };
};
