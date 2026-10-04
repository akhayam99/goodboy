import { useEffect, useState } from 'react';
import type { MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import {
  selectActiveMount,
  selectMountById,
} from '../../../../store/slices/project-mounts/selectors';
import { listBranchCommits } from '../../../worktree/worktree';

export type ResolverCommit = {
  readonly sha: string;
  readonly subject: string | null;
  readonly isOnBranch: boolean | null;
};

export const useResolverCommit = ({
  sessionId,
  mountId,
  sha,
}: {
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly sha: string | null;
}): ResolverCommit | null => {
  const worktreePath = useAppStore((state) => {
    const mount =
      mountId === null
        ? selectActiveMount({ state, sessionId })
        : selectMountById({ state, sessionId, mountId });
    return mount?.worktreePath ?? null;
  });
  const [found, setFound] = useState<{
    readonly sha: string;
    readonly subject: string | null;
    readonly isOnBranch: boolean;
  } | null>(null);

  useEffect(() => {
    if (sha === null || worktreePath === null || worktreePath === '') {
      return;
    }
    let isCurrent = true;
    void listBranchCommits(worktreePath)
      .then((commits) => {
        if (!isCurrent) {
          return;
        }
        const commit = commits.find((candidate) => candidate.sha.startsWith(sha.slice(0, 7)));
        setFound({
          sha,
          subject: commit?.subject ?? null,
          isOnBranch: commit !== undefined,
        });
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [sha, worktreePath]);

  if (sha === null) {
    return null;
  }
  return found?.sha === sha
    ? { sha, subject: found.subject, isOnBranch: found.isOnBranch }
    : { sha, subject: null, isOnBranch: null };
};
