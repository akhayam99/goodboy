import { useEffect, useState } from 'react';
import { openUrl } from '../../lib/editor';

export type CommitDiffTarget = { repo: string; sha: string };

export const useCommitLinkInterceptor = () => {
  const [commitDiff, setCommitDiff] = useState<CommitDiffTarget | null>(null);

  useEffect(() => {
    const COMMIT_RE = /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/commit\/([0-9a-f]{7,40})/i;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.('a');
      const href = anchor?.getAttribute('href');
      if (!href) {
        return;
      }
      const commit = href.match(COMMIT_RE);
      if (commit) {
        e.preventDefault();
        setCommitDiff({ repo: commit[1] as string, sha: commit[2] as string });
        return;
      }
      if (/^(https?:|mailto:)/i.test(href)) {
        e.preventDefault();
        void openUrl(href);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return { commitDiff, setCommitDiff };
};
