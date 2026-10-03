import type { ArtifactId, SessionId } from '@goodboy/types';
import { removeArtifactForGood } from '../../../features/artifacts/artifacts';
import { artifactFolderName } from '../../../features/artifacts/artifactFolderName';
import { removeArtifactMirror } from '../../../features/artifacts/artifactMirror/artifactMirrorInvoke';
import { sessionById } from '../sessions/sessionIndex';
import { refreshSessionArtifactsAndPlans } from './refresh';
import type { GetFn, SetFn } from './types';

export type DeleteArtifactPermanentlyParams = {
  readonly sessionId: SessionId;
  readonly artifactId: ArtifactId;
};

export const deleteArtifactPermanently = (set: SetFn, get: GetFn) => {
  return async ({ sessionId, artifactId }: DeleteArtifactPermanentlyParams): Promise<void> => {
    const state = get();
    const artifact = (state.sessionArtifacts[sessionId] ?? []).find(
      (candidate) => candidate.id === artifactId,
    );
    if (artifact === undefined || artifact.status !== 'discarded') {
      return;
    }
    const workspaceId = sessionById(state.sessions, sessionId)?.workspaceId ?? null;
    const workspaceSlug =
      state.workspaces.find((workspace) => workspace.id === workspaceId)?.slug ?? null;
    if (workspaceSlug !== null) {
      await removeArtifactMirror({ workspaceSlug, folder: artifactFolderName({ artifact }) });
    }
    await removeArtifactForGood(artifactId);
    await refreshSessionArtifactsAndPlans(set, sessionId);
  };
};
