import { useCallback } from 'react';
import { ghCommitDiff } from '../../../features/github/github';
import { worktreeDiffCommit } from '../../../features/worktree/worktree';
import { useCommitLinkInterceptor } from '../../../shared/hooks/useCommitLinkInterceptor';
import { useAppStore } from '../../../store';
import { resolveSessionRepo } from '../../../store/slices/worktrees/resolveSessionRepo';

export const useCommitDiff = () => {
  const { commitDiff, setCommitDiff } = useCommitLinkInterceptor();
  const currentSessionWorktree = useAppStore((state) =>
    state.currentSessionId === null
      ? null
      : (resolveSessionRepo({ state, sessionId: state.currentSessionId })?.worktreePath ?? null),
  );

  const commitDiffLoader = useCallback(async () => {
    if (commitDiff === null) {
      return '';
    }
    if (currentSessionWorktree !== null) {
      try {
        return await worktreeDiffCommit(currentSessionWorktree, commitDiff.sha);
      } catch (error) {
        if (commitDiff.repo === '') {
          throw error;
        }
      }
    }
    return ghCommitDiff(commitDiff.repo, commitDiff.sha);
  }, [commitDiff, currentSessionWorktree]);

  const closeCommitDiff = useCallback(() => setCommitDiff(null), [setCommitDiff]);

  return { commitDiff, commitDiffLoader, closeCommitDiff };
};
