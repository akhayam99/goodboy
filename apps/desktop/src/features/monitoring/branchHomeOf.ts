import type { OwnedMount } from './ownedMountsOf';

type Params = {
  readonly mounts: ReadonlyArray<OwnedMount>;
  readonly mountId: string;
  readonly branch: string;
};

export const branchHomeOf = ({ mounts, mountId, branch }: Params): string | null => {
  const recorded = mounts.find((mount) => mount.mountId === mountId);
  if (recorded === undefined) {
    return null;
  }
  if (recorded.isLive && recorded.branch === branch) {
    return recorded.worktreePath;
  }
  const showing = mounts.find(
    (mount) =>
      mount.isLive &&
      mount.sessionId === recorded.sessionId &&
      mount.projectId === recorded.projectId &&
      mount.branch === branch,
  );
  return showing?.worktreePath ?? null;
};
