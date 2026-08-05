import { cn } from '@goodboy/ui';
import { GitPullRequest } from 'lucide-react';
import type { LinearLinkedPr } from '../client';
import { prStatusTone } from '../prStatusTone';
import { openUrl } from '../../../../shared/lib/editor';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';

type Props = {
  readonly pr: LinearLinkedPr;
};

export const LinkedPrChip = ({ pr }: Props) => {
  const sessionId = useAppStore((s) => s.currentSessionId);
  const branchPrs = useAppStore((s) =>
    s.currentSessionId == null
      ? EMPTY_ARRAY
      : (s.sessionGithubPrs[s.currentSessionId] ?? EMPTY_ARRAY),
  );
  const canonicalPr = useAppStore((s) =>
    s.currentSessionId == null ? null : (s.sessionGithub[s.currentSessionId]?.pr ?? null),
  );
  const selectSessionPr = useAppStore((s) => s.selectSessionPr);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const sessionPr =
    branchPrs.find((candidate) => candidate.url === pr.url) ??
    (canonicalPr?.url === pr.url ? canonicalPr : null);

  const open = () => {
    const isUnderStudio = document.querySelector('[data-studio-overlay]') != null;
    if (sessionId == null || sessionPr == null || isUnderStudio) {
      void openUrl(pr.url);
      return;
    }
    void selectSessionPr(sessionId, sessionPr.number);
    setActiveLens(sessionId, 'pr');
  };

  return (
    <button
      type="button"
      onClick={open}
      title={pr.url}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-medium motion-safe:transition-opacity hover:opacity-80',
        prStatusTone({ status: pr.status }),
      )}
    >
      <GitPullRequest size={11} aria-hidden />#{pr.number}
      {pr.status != null ? <span className="opacity-70">· {pr.status}</span> : null}
    </button>
  );
};
