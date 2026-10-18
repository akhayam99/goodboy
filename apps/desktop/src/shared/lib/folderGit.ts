import type { FirstCommit, FirstCommitPlan, FolderGitProbe } from '@goodboy/types';
import { invokeCommand } from './invokeCommand';

type PathParams = {
  readonly path: string;
};

type MakeFirstCommitParams = {
  readonly path: string;
  readonly include: ReadonlyArray<string>;
};

export const firstCommitPlan = ({ path }: PathParams): Promise<FirstCommitPlan> =>
  invokeCommand<FirstCommitPlan>('folder_git_first_commit_plan', { path });

export const makeFirstCommit = ({ path, include }: MakeFirstCommitParams): Promise<FirstCommit> =>
  invokeCommand<FirstCommit>('folder_git_make_first_commit', { args: { path, include } });

export const folderGitProbe = ({ path }: PathParams): Promise<FolderGitProbe> =>
  invokeCommand<FolderGitProbe>('folder_git_probe', { path });
