import { useMemo, useState } from 'react';
import { Ban, CheckCheck, X } from 'lucide-react';
import { extractCommentWontfix, isReviewThreadId } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';

const warningAccent = MARKER_ACCENT.warning;

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
};

export const CommentWontfixChip = ({ assistantText, sessionId, agentId = null }: Props) => {
  const marker = useMemo(() => extractCommentWontfix(assistantText), [assistantText]);
  const resolvedOnGithub = useAppStore((state) =>
    marker?.threadId != null
      ? (state.sessionGithub[sessionId]?.detail?.comments?.some(
          (comment) => comment.threadId === marker.threadId && comment.resolved === true,
        ) ?? false)
      : false,
  );
  const [isDismissed, setIsDismissed] = useState(false);

  if (marker === null || !isReviewThreadId(marker.threadId) || isDismissed) {
    return null;
  }

  if (resolvedOnGithub) {
    return (
      <TranscriptShell
        tone="success"
        variant="pill"
        className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium ${MARKER_ACCENT.success.text}`}
      >
        <CheckCheck size={11} aria-hidden />
        <span>marked solved with explanation</span>
      </TranscriptShell>
    );
  }

  return (
    <TranscriptShell
      tone="warning"
      variant="boxed"
      className="mt-2 flex flex-wrap items-center gap-1.5 text-xs"
    >
      <Ban size={12} aria-hidden className={warningAccent.icon} />
      <span className="font-medium text-foreground">not worth a change</span>
      <span className="min-w-0 flex-1 text-muted-foreground">{marker.reason}</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          disabled={agentId === null}
          onClick={() => {
            if (agentId === null) {
              return;
            }
            window.dispatchEvent(
              new CustomEvent('goodboy:open-resolver-inspector', {
                detail: { sessionId, agentId },
              }),
            );
          }}
          data-testid="comment-wontfix-manage"
          className="rounded-full px-2 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
        >
          Manage in panel
        </button>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
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
