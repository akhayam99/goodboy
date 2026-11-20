import { useEffect } from 'react';
import { useCommitLinkInterceptor } from '../../../shared/hooks/useCommitLinkInterceptor';
import { openLink } from '../../../features/open/openLink';
import { useAppStore } from '../../../store';
import { claimSessionLink } from '../../../features/browser/claimSessionLink';

export const useCommitDiff = () => {
  const { commitDiff, setCommitDiff } = useCommitLinkInterceptor({ claimLink: claimSessionLink });
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const openDrawer = useAppStore((state) => state.openDrawer);

  useEffect(() => {
    if (commitDiff === null) {
      return;
    }
    setCommitDiff(null);
    if (currentSessionId === null) {
      openLink({
        url: `https://github.com/${commitDiff.repo}/commit/${commitDiff.sha}`,
        sessionId: null,
      });
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
