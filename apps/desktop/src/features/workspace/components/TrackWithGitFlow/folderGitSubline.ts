import type { FolderGitProbe } from '@goodboy/types';
import { pluralize } from '../../../../shared/utils/pluralize';
import type { FolderGitRow } from './folderGitRowOf';

type Params = {
  readonly row: FolderGitRow;
  readonly probe: FolderGitProbe | null;
};

export const folderGitSubline = ({ row, probe }: Params): string => {
  switch (row) {
    case 'hidden':
      return '';
    case 'no-git':
      return 'Code project. Agents edit files in place, one session at a time.';
    case 'no-commits':
      return 'A repository with nothing in it yet, so there is no branch to start from. Agents keep editing in place until the first commit.';
    case 'found':
      return 'Git was set up here outside the app. Agents keep editing in place until you choose.';
    case 'in-place':
      return 'Git is set up here and agents keep editing in place, one session at a time.';
    case 'inside':
      return `Inside the repository at ${probe?.rootPath ?? 'a parent folder'}. Agents edit only this folder, in place.`;
    case 'local':
      return `${pluralize(probe?.commitCount ?? 0, 'commit')}, on this Mac only. New sessions get their own branch from ${probe?.branch ?? 'main'}.`;
    default: {
      const exhaustive: never = row;
      return exhaustive;
    }
  }
};
