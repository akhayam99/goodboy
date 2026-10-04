import type { PullRequestState, SessionId, SessionProjectMount } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { resolveDiffMount } from '../../../session/components/SessionWorkspace/parts/resolveDiffMount';

type Params = {
  readonly sessionId: SessionId;
};

export type BranchIdentity = {
  readonly mountPath: string | null;
  readonly mount: SessionProjectMount | null;
  readonly pr: PullRequestState | null;
  readonly label: string;
};

export const branchLabelOf = ({
  pr,
  mount,
}: {
  readonly pr: PullRequestState | null;
  readonly mount: SessionProjectMount | null;
}): string => {
  if (pr !== null) {
    return `#${pr.number} ${pr.title}`;
  }
  if (mount === null) {
    return 'Branch';
  }
  return mount.branch === '' ? mount.mountName : mount.branch;
};

export const useBranchIdentity = ({ sessionId }: Params): BranchIdentity => {
  const mounts = useAppStore((s) => s.sessionProjectMounts?.[sessionId] ?? EMPTY_ARRAY);
  const requestedPath = useAppStore((s) => s.diffMountPath?.[sessionId] ?? null);
  const fallbackPath = useAppStore(
    (s) => resolveSessionRepo({ state: s, sessionId })?.worktreePath ?? null,
  );
  const pr = useAppStore((s) => s.sessionGithub?.[sessionId]?.pr ?? null);
  const mountPath = resolveDiffMount({ mounts, requestedPath, fallbackPath });
  const mount = mounts.find((candidate) => candidate.worktreePath === mountPath) ?? null;
  return { mountPath, mount, pr, label: branchLabelOf({ pr, mount }) };
};
