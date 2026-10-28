import { invokeCommand } from './invokeCommand';

export type WorktreeDepsState = 'ready' | 'missing' | 'outside' | 'not-applicable';

export type WorktreeDepsCheck = {
  readonly state: WorktreeDepsState;
  readonly command: string | null;
  readonly source: string | null;
  readonly folder: string | null;
  readonly isFolderLink: boolean;
  readonly outside: ReadonlyArray<string>;
};

type Params = {
  readonly worktreePath: string;
};

export const worktreeDepsCheck = ({ worktreePath }: Params): Promise<WorktreeDepsCheck> =>
  invokeCommand<WorktreeDepsCheck>('worktree_deps_check', { worktreePath });

export const worktreeDepsUnlink = ({ worktreePath }: Params): Promise<ReadonlyArray<string>> =>
  invokeCommand<ReadonlyArray<string>>('worktree_deps_unlink', { worktreePath });
