import type { WorkspaceId } from '@goodboy/types';
import { useFolderFacesOnFocus } from '../hooks/useFolderFacesOnFocus';
import { useFolderGitProbe } from '../hooks/useFolderGitProbe';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const FolderGitWatch = ({ workspaceId }: Props) => {
  useFolderGitProbe({ workspaceId, isIncludingLocalRepos: false });
  useFolderFacesOnFocus();
  return null;
};
