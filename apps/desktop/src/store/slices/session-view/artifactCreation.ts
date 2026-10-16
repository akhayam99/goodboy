import type { IsoDateTime } from '@goodboy/types';
import { defaultArtifactDraft } from '../artifactDrafts/defaultArtifactDraft';
import { sessionPlace } from '../navigation/place';
import type { AwaitArtifactAgentParams, GetFn, OpenArtifactCreationParams, SetFn } from './types';

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
    if (get().currentSessionId !== sessionId) {
      get().navigate({
        to: sessionPlace({ sessionId, lens: get().activeLens[sessionId] ?? null }),
      });
    }
    set((s) => ({ focusedArtifactId: { ...s.focusedArtifactId, [sessionId]: null } }));
    get().openDrawer({
      kind: 'new',
      sessionId,
      payload: { form: kind, ...(note !== null && { note }) },
    });
  };
};

export const awaitArtifactAgent = (set: SetFn) => {
  return ({ sessionId, agentId }: AwaitArtifactAgentParams): void => {
    set((s) => ({ awaitedArtifactAgentId: { ...s.awaitedArtifactAgentId, [sessionId]: agentId } }));
  };
};
