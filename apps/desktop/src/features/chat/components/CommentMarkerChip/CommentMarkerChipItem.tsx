import { useState } from 'react';
import { Ban, CheckCheck, Clock, GitCommit, Search, X } from 'lucide-react';
import { isReviewThreadId } from '@goodboy/core';
import { Markdown } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { commentChipDismissal } from '../../../../shared/utils/commentChipDismissal';
import { CommentReplyPreview } from '../CommentReplyPreview';
import { MARKER_ACCENT } from '../marker-accents';
import { TranscriptShell } from '../TranscriptShell';
import type { CommentMarker } from './commentMarker';
import { COMMENT_MARKER_CONFIG } from './commentMarkerConfig';

type Props = {
  readonly marker: CommentMarker;
  readonly reply: string | null;
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export const CommentMarkerChipItem = ({ marker, reply, sessionId, agentId }: Props) => {
  const threadId = marker.value.threadId;
  const resolvedOnGithub = useAppStore(
    (state) =>
      state.sessionGithub[sessionId]?.detail?.comments?.some(
        (comment) => comment.threadId === threadId && comment.resolved === true,
      ) ?? false,
  );
  const queued = useAppStore(
    (state) =>
      state.sessionPendingResolutions[sessionId]?.some(
        (resolution) => resolution.threadId === threadId,
      ) ?? false,
  );
  const [isDismissed, setIsDismissed] = useState(() => commentChipDismissal.read({ threadId }));

  if (!isReviewThreadId(threadId) || isDismissed) {
    return null;
  }

  const config = COMMENT_MARKER_CONFIG[marker.kind];
  const actions = (
    <>
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
        data-testid={config.manageTestId}
        className="rounded-full px-2 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
      >
        Manage in panel
      </button>
      <button
        type="button"
        onClick={() => {
          commentChipDismissal.persist({ threadId });
          setIsDismissed(true);
        }}
        title={config.dismissLabel}
        aria-label={config.dismissLabel}
        className="rounded-md p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
      >
        <X size={10} aria-hidden />
      </button>
    </>
  );

  if (resolvedOnGithub) {
    return (
      <TranscriptShell
        tone="success"
        variant="pill"
        className={`inline-flex flex-wrap items-center gap-1.5 text-xs font-medium ${MARKER_ACCENT.success.text}`}
      >
        <CheckCheck size={11} aria-hidden />
        <span>
          {marker.kind === 'resolved' ? 'conversation resolved' : 'marked solved with explanation'}
        </span>
        <span className="font-mono text-2xs text-muted-foreground">{threadId}</span>
        {marker.kind === 'resolved' ? (
          <>
            <GitCommit size={10} aria-hidden className="text-muted-foreground/80" />
            <span className="font-mono text-muted-foreground/80">
              {marker.value.commitSha.slice(0, 7)}
            </span>
          </>
        ) : null}
        {reply === null ? null : <CommentReplyPreview body={reply} />}
      </TranscriptShell>
    );
  }

  if (marker.kind === 'analysis') {
    const isFix = marker.value.verdict === 'fix';
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
          <span className="font-mono text-2xs text-muted-foreground">{threadId}</span>
        </div>
        <div className="text-muted-foreground">
          <Markdown text={marker.value.summary} />
        </div>
        {reply === null ? null : <CommentReplyPreview body={reply} />}
        <div className="flex flex-wrap items-center justify-end gap-1">{actions}</div>
      </TranscriptShell>
    );
  }

  if (marker.kind === 'resolved') {
    const shaShort = marker.value.commitSha.slice(0, 7);

    return (
      <TranscriptShell
        tone={queued ? 'info' : 'success'}
        variant="boxed"
        className="flex flex-wrap items-center gap-1.5 text-xs"
      >
        {queued ? (
          <Clock size={12} aria-hidden className={MARKER_ACCENT.info.icon} />
        ) : (
          <CheckCheck size={12} aria-hidden className={MARKER_ACCENT.success.icon} />
        )}
        <span className="font-medium text-foreground">
          {queued ? 'solved locally · pending push' : 'fix committed locally'}
        </span>
        <span className="font-mono text-2xs text-muted-foreground">{threadId}</span>
        <span className="inline-flex items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
          <GitCommit size={9} aria-hidden />
          {shaShort}
        </span>
        <div className="flex flex-1 items-center justify-end gap-1">{actions}</div>
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
      <Ban size={12} aria-hidden className={MARKER_ACCENT.warning.icon} />
      <span className="font-medium text-foreground">not worth a change</span>
      <span className="font-mono text-2xs text-muted-foreground">{threadId}</span>
      <span className="min-w-0 flex-1 text-muted-foreground">{marker.value.reason}</span>
      <div className="flex items-center justify-end gap-1">{actions}</div>
      {reply === null ? null : <CommentReplyPreview body={reply} />}
    </TranscriptShell>
  );
};
