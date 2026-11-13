import { OPEN_FAILED } from '../../../store/slices/notifications/errorRecovery';
import { useEffect, useRef, useState } from 'react';
import { openUrl } from '../../lib/editor';
import { useAppStore } from '../../../store';

export type CommitDiffTarget = { repo: string; sha: string };

type ClaimParams = {
  readonly href: string;
  readonly anchor: Element;
  readonly event: MouseEvent;
};

type Params = {
  readonly claimLink?: (params: ClaimParams) => boolean;
};

const NO_CLAIM = (): boolean => false;

export const useCommitLinkInterceptor = ({ claimLink = NO_CLAIM }: Params = {}) => {
  const [commitDiff, setCommitDiff] = useState<CommitDiffTarget | null>(null);
  const claimRef = useRef(claimLink);
  claimRef.current = claimLink;

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
      if (anchor != null && claimRef.current({ href, anchor, event: e })) {
        e.preventDefault();
        return;
      }
      if (/^https?:/i.test(href)) {
        e.preventDefault();
        openUrl(href).catch((error: unknown) => {
          void useAppStore.getState().reportError({
            recovery: OPEN_FAILED,
            title: "Couldn't open the link",
            error,
          });
        });
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return { commitDiff, setCommitDiff };
};
