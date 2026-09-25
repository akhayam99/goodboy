import { useEffect } from 'react';
import { useCommitLinkInterceptor } from '../../../shared/hooks/useCommitLinkInterceptor';
import { openUrl } from '../../../shared/lib/editor';
import { useAppStore } from '../../../store';

export const useCommitDiff = () => {
  const { commitDiff, setCommitDiff } = useCommitLinkInterceptor();
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const openDrawer = useAppStore((state) => state.openDrawer);

  useEffect(() => {
    if (commitDiff === null) {
      return;
    }
    setCommitDiff(null);
    if (currentSessionId === null) {
      void openUrl(`https://github.com/${commitDiff.repo}/commit/${commitDiff.sha}`);
      return;
    }
    openDrawer({
      kind: 'file-diff',
      sessionId: currentSessionId,
      payload: {
        source: { kind: 'commit', repo: commitDiff.repo, sha: commitDiff.sha },
        path: null,
      },
    });
  }, [commitDiff, currentSessionId, openDrawer, setCommitDiff]);
};
