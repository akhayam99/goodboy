import { useEffect, useRef } from 'react';
import { appScrollIntoView } from '@goodboy/ui';
import type { HistoryGraph, SessionId } from '@goodboy/types';

import { HISTORY_FOCUS_BASE_EVENT, diffEventName } from '../../../actions/kinds/diff';

type Props = {
  readonly sessionId: SessionId;
  readonly graph: HistoryGraph | null;
  readonly baseBranch: string;
  readonly baseSha: string;
  readonly forkAge: string;
  readonly isDone: boolean;
};

export const HistoryBaseRow = ({
  sessionId,
  graph,
  baseBranch,
  baseSha,
  forkAge,
  isDone,
}: Props) => {
  const headingRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const name = diffEventName({ name: HISTORY_FOCUS_BASE_EVENT, sessionId });
    const onFocus = () => {
      const heading = headingRef.current;
      if (heading === null) {
        return;
      }
      appScrollIntoView({ element: heading, block: 'center' });
      const page = heading.closest('[data-branch-pane]') ?? document;
      const own = page.querySelector<HTMLElement>('[data-base-rebase]');
      const rail = document.querySelector<HTMLElement>('[data-worktree-verb="mount.rebase"]');
      (own ?? rail)?.focus();
    };
    window.addEventListener(name, onFocus);
    return () => window.removeEventListener(name, onFocus);
  }, [sessionId]);

  const headingText = isDone ? 'Your branch starts here' : `Based on ${baseBranch}`;
  const summary = graph === null ? null : `${graph.mergeBase.subject}, ${forkAge}`;

  return (
    <>
      <span ref={headingRef} className="shrink-0 text-foreground">
        {headingText}
      </span>
      <span className="shrink-0 text-code tabular-nums">{baseSha.slice(0, 7)}</span>
      {summary === null ? null : <span className="min-w-0 flex-1 truncate">{summary}</span>}
    </>
  );
};
