import { PULL_REQUEST_NOUNS } from '@goodboy/core';
import type {
  PullRequestHost,
  PullRequestState,
  SessionId,
  SessionProjectMount,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import {
  sessionPullRequestHostOf,
  sessionPullRequestOf,
} from '../../../../store/slices/review-source/sessionPullRequestOf';
import { resolveSessionRepo } from '../../../../store/slices/worktrees/resolveSessionRepo';
import { resolveDiffMount } from '../../../session/components/SessionWorkspace/parts/resolveDiffMount';

type Params = {
  readonly sessionId: SessionId;
};

export type BranchIdentity = {
  readonly mountPath: string | null;
  readonly mount: SessionProjectMount | null;
  readonly pr: PullRequestState | null;
  readonly host: PullRequestHost;
  readonly label: string;
};

const branchLabelOf = ({
  pr,
  prefix,
  mount,
}: {
  readonly pr: PullRequestState | null;
  readonly prefix: string;
  readonly mount: SessionProjectMount | null;
}): string => {
  if (pr !== null) {
    return `${prefix}${pr.number} ${pr.title}`;
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
  const mountPath = resolveDiffMount({ mounts, requestedPath, fallbackPath });
  const mount = mounts.find((candidate) => candidate.worktreePath === mountPath) ?? null;
  const mountId = mount?.mountId ?? null;
  const pr = useAppStore((s) => sessionPullRequestOf({ state: s, sessionId, mountId }));
  const host = useAppStore((s) => sessionPullRequestHostOf({ state: s, sessionId, mountId }));
  const prefix = PULL_REQUEST_NOUNS[host].numberPrefix;
  return { mountPath, mount, pr, host, label: branchLabelOf({ pr, prefix, mount }) };
};
