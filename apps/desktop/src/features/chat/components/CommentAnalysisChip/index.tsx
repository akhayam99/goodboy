import { useMemo, useState } from 'react';
import { Ban, CheckCheck, Play, Search, X } from 'lucide-react';
import { Markdown, Textarea, cn } from '@goodboy/ui';
import { extractCommentAnalysis, isReviewThreadId } from '@goodboy/core';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { commentChipDismissal } from '../../../../shared/utils/commentChipDismissal';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';

const PROCEED_PROMPT =
  'Proceed with the fix you proposed in your analysis. When done, commit and emit the <<comment-resolved>> marker as instructed.';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
  readonly agentId?: AgentId | null;
};

type ChipState =
  | { kind: 'idle' }
  | { kind: 'continuing' }
  | { kind: 'resolving' }
  | { kind: 'resolved' }
  | { kind: 'dismissed' };

export const CommentAnalysisChip = ({ assistantText, sessionId, agentId = null }: Props) => {
  const marker = useMemo(() => extractCommentAnalysis(assistantText), [assistantText]);
  const threadId = marker?.threadId;
  const sendTurn = useAppStore((state) => state.sendTurn);
  const resolveGithubThread = useAppStore((state) => state.resolveGithubThread);
  const resolvedOnGithub = useAppStore((state) =>
    threadId != null
      ? (state.sessionGithub[sessionId]?.detail?.comments?.some(
          (comment) => comment.threadId === threadId && comment.resolved === true,
        ) ?? false)
      : false,
  );
  const [state, setState] = useState<ChipState>(() =>
    threadId != null && commentChipDismissal.read({ threadId })
      ? { kind: 'dismissed' }
      : { kind: 'idle' },
  );
  const [isExplaining, setIsExplaining] = useState(false);
  const [reason, setReason] = useState(marker?.summary ?? '');

  if (marker === null || !isReviewThreadId(marker.threadId)) {
    return null;
  }

  if (state.kind === 'resolved' || resolvedOnGithub) {
    return (
      <TranscriptShell
        tone="success"
        variant="pill"
        className={`inline-flex items-center gap-1.5 text-xs font-medium ${MARKER_ACCENT.success.text}`}
      >
        <CheckCheck size={11} aria-hidden />
        <span>marked solved with explanation</span>
      </TranscriptShell>
    );
  }

  if (state.kind === 'dismissed') {
    return null;
  }

  const busy = state.kind === 'continuing' || state.kind === 'resolving';
  const isFix = marker.verdict === 'fix';
  const tone = isFix ? 'info' : 'warning';
  const accent = isFix ? MARKER_ACCENT.info : MARKER_ACCENT.warning;

  const proceed = async () => {
    if (busy || agentId === null) {
      return;
    }
    setState({ kind: 'continuing' });
    try {
      await sendTurn({ sessionId, agentId, content: PROCEED_PROMPT });
    } finally {
      setState({ kind: 'idle' });
    }
  };

  const resolve = async () => {
    if (busy || reason.trim().length === 0) {
      return;
    }
    setState({ kind: 'resolving' });
    const ok = await resolveGithubThread(sessionId, marker.threadId, { reason });
    setState(ok ? { kind: 'resolved' } : { kind: 'idle' });
  };

  const proceedButton = (
    <button
      type="button"
      onClick={() => void proceed()}
      disabled={busy || agentId === null}
      data-testid="comment-analysis-proceed"
      className={cn(
        'relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60',
        isFix
          ? 'bg-info text-info-foreground'
          : `border ${MARKER_ACCENT.warning.border} ${MARKER_ACCENT.warning.text}`,
        state.kind === 'continuing' && 'animate-border-pulse',
      )}
    >
      <Play size={9} aria-hidden />
      {state.kind === 'continuing'
        ? 'Proceeding…'
        : isFix
          ? 'Proceed with fix'
          : 'Proceed with fix anyway'}
    </button>
  );

  const closeButton = (
    <button
      type="button"
      onClick={() => {
        setReason(marker.summary);
        setIsExplaining(true);
      }}
      disabled={busy}
      data-testid="comment-analysis-close"
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60',
        isFix
          ? `border ${MARKER_ACCENT.info.border} ${MARKER_ACCENT.info.text}`
          : 'bg-warning text-warning-foreground',
      )}
    >
      <Ban size={9} aria-hidden />
      Close with explanation
    </button>
  );

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
      </div>
      <div className="text-muted-foreground">
        <Markdown text={marker.summary} />
      </div>
      {isExplaining ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={busy}
            aria-label="explanation"
            autoGrow
            maxRows={6}
            className="min-h-16 resize-none bg-background/60 px-2 py-1.5 text-xs leading-relaxed"
          />
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => setIsExplaining(false)}
              disabled={busy}
              className="rounded-full px-2 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void resolve()}
              disabled={busy || reason.trim().length === 0}
              data-testid="comment-analysis-confirm"
              className={cn(
                'relative rounded-full bg-warning px-2 py-0.5 text-2xs font-semibold text-warning-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60',
                state.kind === 'resolving' && 'animate-border-pulse',
              )}
            >
              {state.kind === 'resolving' ? 'Marking…' : 'Post explanation & close'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {isFix ? (
            <>
              {proceedButton}
              {closeButton}
            </>
          ) : (
            <>
              {closeButton}
              {proceedButton}
            </>
          )}
          <button
            type="button"
            onClick={() => {
              commentChipDismissal.persist({ threadId: marker.threadId });
              setState({ kind: 'dismissed' });
            }}
            disabled={busy}
            title="dismiss this recommendation"
            aria-label="dismiss this recommendation"
            className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={10} aria-hidden />
          </button>
        </div>
      )}
    </TranscriptShell>
  );
};
