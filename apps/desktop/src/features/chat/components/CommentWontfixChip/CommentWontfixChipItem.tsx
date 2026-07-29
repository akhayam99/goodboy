import { useState } from 'react';
import { Ban, CheckCheck, X } from 'lucide-react';
import { isReviewThreadId, type ExtractedCommentWontfix } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CommentReplyPreview } from '../CommentReplyPreview';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';

const warningAccent = MARKER_ACCENT.warning;

type Props = {
  readonly marker: ExtractedCommentWontfix;
  readonly reply: string | null;
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export const CommentWontfixChipItem = ({ marker, reply, sessionId, agentId }: Props) => {
  const resolvedOnGithub = useAppStore(
    (state) =>
      state.sessionGithub[sessionId]?.detail?.comments?.some(
        (comment) => comment.threadId === marker.threadId && comment.resolved === true,
      ) ?? false,
  );
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isReviewThreadId(marker.threadId) || isDismissed) {
    return null;
  }

  if (resolvedOnGithub) {
    return (
      <TranscriptShell
        tone="success"
        variant="pill"
        className={`inline-flex flex-wrap items-center gap-1.5 text-xs font-medium ${MARKER_ACCENT.success.text}`}
      >
        <CheckCheck size={11} aria-hidden />
        <span>marked solved with explanation</span>
        <span className="font-mono text-2xs text-muted-foreground">{marker.threadId}</span>
        {reply === null ? null : <CommentReplyPreview body={reply} />}
      </TranscriptShell>
    );
  }

  return (
    <TranscriptShell
      tone="warning"
      variant="boxed"
      className="flex flex-wrap items-center gap-1.5 text-xs"
    >
      <Ban size={12} aria-hidden className={warningAccent.icon} />
      <span className="font-medium text-foreground">not worth a change</span>
      <span className="font-mono text-2xs text-muted-foreground">{marker.threadId}</span>
      <span className="min-w-0 flex-1 text-muted-foreground">{marker.reason}</span>
      <div className="flex flex-1 items-center justify-end gap-1">
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
          className="rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={10} aria-hidden />
        </button>
      </div>
      {reply === null ? null : <CommentReplyPreview body={reply} />}
    </TranscriptShell>
  );
};
