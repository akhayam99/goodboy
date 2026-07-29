import { useState } from 'react';
import { CheckCheck, Search, X } from 'lucide-react';
import { isReviewThreadId, type ExtractedCommentAnalysis } from '@goodboy/core';
import { Markdown } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { commentChipDismissal } from '../../../../shared/utils/commentChipDismissal';
import { CommentReplyPreview } from '../CommentReplyPreview';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';

type Props = {
  readonly marker: ExtractedCommentAnalysis;
  readonly reply: string | null;
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export const CommentAnalysisChipItem = ({ marker, reply, sessionId, agentId }: Props) => {
  const resolvedOnGithub = useAppStore(
    (state) =>
      state.sessionGithub[sessionId]?.detail?.comments?.some(
        (comment) => comment.threadId === marker.threadId && comment.resolved === true,
      ) ?? false,
  );
  const [isDismissed, setIsDismissed] = useState(() =>
    commentChipDismissal.read({ threadId: marker.threadId }),
  );

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

  const isFix = marker.verdict === 'fix';
  const tone = isFix ? 'info' : 'warning';
  const accent = isFix ? MARKER_ACCENT.info : MARKER_ACCENT.warning;

  return (
    <TranscriptShell
      tone={tone}
      variant="boxed"
      className="flex w-full max-w-2xl flex-col gap-2 text-xs"
    >
      <div className="flex items-center gap-1.5">
        <Search size={12} aria-hidden className={accent.icon} />
        <span className="font-medium text-foreground">
          {isFix ? 'fix recommended' : 'no change recommended'}
        </span>
        <span className="font-mono text-2xs text-muted-foreground">{marker.threadId}</span>
      </div>
      <div className="text-muted-foreground">
        <Markdown text={marker.summary} />
      </div>
      {reply === null ? null : <CommentReplyPreview body={reply} />}
      <div className="flex flex-wrap items-center justify-end gap-1">
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
          data-testid="comment-analysis-manage"
          className="rounded-full px-2 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
        >
          Manage in panel
        </button>
        <button
          type="button"
          onClick={() => {
            commentChipDismissal.persist({ threadId: marker.threadId });
            setIsDismissed(true);
          }}
          title="dismiss this recommendation"
          aria-label="dismiss this recommendation"
          className="rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X size={10} aria-hidden />
        </button>
      </div>
    </TranscriptShell>
  );
};
