import type { Session, SessionArtifact, SessionId, Workspace } from '@goodboy/types';
import type { ArtifactMirrorItem } from './artifactMirrorQueue';

type MirrorState = Readonly<{
  sessionArtifacts: Readonly<Record<SessionId, ReadonlyArray<SessionArtifact>>>;
  sessions: ReadonlyArray<Session>;
  workspaces: ReadonlyArray<Workspace>;
}>;

export const artifactMirrorItems = ({
  state,
}: {
  readonly state: MirrorState;
}): ReadonlyArray<ArtifactMirrorItem> => {
  const slugs = new Map(state.workspaces.map((workspace) => [workspace.id, workspace.slug]));
  const sessionSlug = new Map(
    state.sessions.map((session) => [session.id, slugs.get(session.workspaceId) ?? null]),
  );
  return Object.entries(state.sessionArtifacts).flatMap(([sessionId, artifacts]) => {
    const workspaceSlug = sessionSlug.get(sessionId as SessionId) ?? null;
    if (workspaceSlug === null) {
      return [];
    }
    return artifacts.map((artifact) => ({ artifact, workspaceSlug }));
  });
};
