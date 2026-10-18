import type { FolderPurpose, Project, ProjectId, WorkspaceId } from '@goodboy/types';
import { folderCountLabel } from './folderCountLabel';
import { FOLDER_FACE_COPY } from './folderFaceCopy';

type Params = {
  readonly projects: ReadonlyArray<Project> | undefined;
  readonly workspaceId: WorkspaceId;
  readonly folderPurpose: Readonly<Record<ProjectId, FolderPurpose>>;
};

export const workspaceFaceLabel = ({ projects, workspaceId, folderPurpose }: Params): string => {
  const connected = (projects ?? []).filter(
    (project) => project.workspaceId === workspaceId && project.disconnectedAt === undefined,
  );
  const only = connected.length === 1 ? connected[0] : undefined;
  const purpose = only?.kind === 'folder' ? folderPurpose[only.id] : undefined;
  if (purpose === undefined) {
    return folderCountLabel({ projects, workspaceId });
  }
  return FOLDER_FACE_COPY[purpose].home;
};
