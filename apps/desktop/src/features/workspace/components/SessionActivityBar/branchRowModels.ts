import type { MountId, ProjectId, PullRequestStateKind } from '@goodboy/types';

const BRANCH_ROW_LIMIT = 5;

type BranchRowMount = {
  readonly mountId: MountId;
  readonly projectId: ProjectId | null;
  readonly mountName: string;
  readonly branch: string;
  readonly worktreePath: string;
};

type BranchRowRequest = {
  readonly number: number;
  readonly state: PullRequestStateKind;
  readonly isDraft: boolean;
};

export type BranchRowModel = {
  readonly mountId: MountId;
  readonly worktreePath: string;
  readonly label: string;
  readonly request: BranchRowRequest | null;
  readonly isCurrent: boolean;
};

type Params = {
  readonly mounts: ReadonlyArray<BranchRowMount>;
  readonly currentPath: string | null;
  readonly requestOf: (mount: BranchRowMount) => BranchRowRequest | null;
};

export type BranchRows = {
  readonly shown: ReadonlyArray<BranchRowModel>;
  readonly hasMore: boolean;
};

export const branchRowsOf = ({ mounts, currentPath, requestOf }: Params): BranchRows => {
  if (mounts.length < 2) {
    return { shown: [], hasMore: false };
  }
  const models = mounts.map((mount): BranchRowModel => {
    const request = requestOf(mount);
    return {
      mountId: mount.mountId,
      worktreePath: mount.worktreePath,
      label: mount.branch === '' ? mount.mountName : mount.branch,
      request,
      isCurrent: mount.worktreePath === currentPath,
    };
  });
  const first = models.slice(0, BRANCH_ROW_LIMIT);
  const current = models.find((model) => model.isCurrent);
  const shown =
    current === undefined || first.includes(current)
      ? first
      : [...first.slice(0, BRANCH_ROW_LIMIT - 1), current];
  return { shown, hasMore: models.length > BRANCH_ROW_LIMIT };
};
