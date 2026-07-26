import { useMemo, useState } from 'react';
import { CheckCheck, Clock, GitCommit, X } from 'lucide-react';
import { extractCommentResolved, isReviewThreadId } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { commentChipDismissal } from '../../../../shared/utils/commentChipDismissal';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';

const infoAccent = MARKER_ACCENT.info;
const successAccent = MARKER_ACCENT.success;

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
};

export const CommentResolvedChip = ({ assistantText, sessionId, agentId = null }: Props) => {
  const marker = useMemo(() => extractCommentResolved(assistantText), [assistantText]);
  const threadId = marker?.threadId;
  const resolvedOnGithub = useAppStore((state) =>
    threadId != null
      ? (state.sessionGithub[sessionId]?.detail?.comments?.some(
          (comment) => comment.threadId === threadId && comment.resolved === true,
        ) ?? false)
      : false,
  );
  const queued = useAppStore((state) =>
    threadId != null
      ? (state.sessionPendingResolutions[sessionId]?.some(
          (resolution) => resolution.threadId === threadId,
        ) ?? false)
      : false,
  );
  const [isDismissed, setIsDismissed] = useState(
    threadId != null && commentChipDismissal.read({ threadId }),
  );

  if (marker === null || !isReviewThreadId(marker.threadId) || isDismissed) {
    return null;
  }

  const shaShort = marker.commitSha.slice(0, 7);
  if (resolvedOnGithub) {
    return (
      <TranscriptShell
        tone="success"
        variant="pill"
        className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium ${successAccent.text}`}
      >
        <CheckCheck size={11} aria-hidden />
        <span>conversation resolved</span>
        <GitCommit size={10} aria-hidden className="text-muted-foreground/80" />
        <span className="font-mono text-muted-foreground/80">{shaShort}</span>
      </TranscriptShell>
    );
  }

  const dismiss = () => {
    commentChipDismissal.persist({ threadId: marker.threadId });
    setIsDismissed(true);
  };
  const manage = () => {
    if (agentId === null) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent('goodboy:open-resolver-inspector', {
        detail: { sessionId, agentId },
      }),
    );
  };

  return (
    <TranscriptShell
      tone={queued ? 'info' : 'success'}
      variant="boxed"
      className="mt-2 flex flex-wrap items-center gap-1.5 text-xs"
    >
      {queued ? (
        <Clock size={12} aria-hidden className={infoAccent.icon} />
      ) : (
        <CheckCheck size={12} aria-hidden className={successAccent.icon} />
      )}
      <span className="font-medium text-foreground">
        {queued ? 'solved locally · pending push' : 'fix committed locally'}
      </span>
      <span className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
        <GitCommit size={9} aria-hidden />
        {shaShort}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={manage}
          disabled={agentId === null}
          data-testid="comment-resolved-manage"
          className="rounded-full px-2 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
        >
          Manage in panel
        </button>
        <button
          type="button"
          onClick={dismiss}
          title="dismiss resolver status"
          aria-label="dismiss resolver status"
          className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={10} aria-hidden />
        </button>
      </div>
    </TranscriptShell>
  );
};
