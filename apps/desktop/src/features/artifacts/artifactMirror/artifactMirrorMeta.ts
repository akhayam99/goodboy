import type { SessionArtifact } from '@goodboy/types';

export type ArtifactMirrorMeta = Readonly<{
  id: string;
  kind: SessionArtifact['kind'];
  title: string;
  status: SessionArtifact['status'];
  revision: number;
  session: string;
  workspace: string;
  createdAt: string;
  updatedAt: string;
  appVersion: string | null;
}>;

type Params = {
  readonly artifact: SessionArtifact;
  readonly workspaceSlug: string;
  readonly appVersion: string | null;
};

export const artifactMirrorMeta = ({
  artifact,
  workspaceSlug,
  appVersion,
}: Params): ArtifactMirrorMeta => ({
  id: artifact.id,
  kind: artifact.kind,
  title: artifact.title,
  status: artifact.status,
  revision: artifact.revision,
  session: artifact.sessionId,
  workspace: workspaceSlug,
  createdAt: artifact.createdAt,
  updatedAt: artifact.updatedAt,
  appVersion,
});
