import type { FolderGitProbe, FolderPurpose, Project } from '@goodboy/types';
import type {
  FolderGitChoice,
  FolderGitNotice,
} from '../../../../store/slices/folder-purpose/state';

export type FolderGitRow =
  'hidden' | 'no-git' | 'no-commits' | 'found' | 'in-place' | 'inside' | 'local';

type Params = {
  readonly project: Project;
  readonly purpose: FolderPurpose | null;
  readonly probe: FolderGitProbe | null;
  readonly choice: FolderGitChoice | null;
  readonly notice: FolderGitNotice | null;
  readonly isFirstLap: boolean;
};

type FolderParams = Pick<Params, 'purpose' | 'probe' | 'choice' | 'notice'>;

const folderRowOf = ({ purpose, probe, choice, notice }: FolderParams): FolderGitRow => {
  if (purpose === 'documents' && notice === null) {
    return 'hidden';
  }
  if (probe?.state === 'above') {
    return choice === 'in-place' || notice !== null ? 'inside' : 'hidden';
  }
  if (probe?.state === 'tracked') {
    return choice === 'in-place' ? 'in-place' : 'found';
  }
  if (purpose === 'documents') {
    return 'hidden';
  }
  return probe?.state === 'empty' ? 'no-commits' : 'no-git';
};

export const folderGitRowOf = ({
  project,
  purpose,
  probe,
  choice,
  notice,
  isFirstLap,
}: Params): FolderGitRow => {
  if (project.disconnectedAt != null) {
    return 'hidden';
  }
  if (project.kind === 'folder') {
    return folderRowOf({ purpose, probe, choice, notice });
  }
  if (isFirstLap || probe === null || probe.state !== 'tracked' || probe.remoteUrl !== null) {
    return 'hidden';
  }
  return 'local';
};
