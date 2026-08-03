import { Ban, CheckCheck, Clock, GitCommit, Search } from 'lucide-react';
import { isReviewThreadId } from '@goodboy/core';
import { Markdown } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CommentReplyPreview } from '../CommentReplyPreview';
import { tintClasses } from '@goodboy/ui';
import { TranscriptShell } from '../TranscriptShell';
import type { CommentMarker } from './commentMarker';
import { COMMENT_MARKER_CONFIG } from './commentMarkerConfig';
import { CommentMarkerChipLink } from './CommentMarkerChipLink';

type Props = {
  readonly marker: CommentMarker;
  readonly reply: string | null;
  readonly sessionId: SessionId;
  readonly agentId: AgentId | null;
};

export const CommentMarkerChipItem = ({ marker, reply, sessionId, agentId }: Props) => {
  const threadId = marker.value.threadId;
  const selectAgent = useAppStore((state) => state.selectAgent);
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

  if (!isReviewThreadId(threadId)) {
    return null;
  }

  const config = COMMENT_MARKER_CONFIG[marker.kind];
  const onOpen =
    agentId === null
      ? null
      : () => {
          void selectAgent(sessionId, agentId);
          window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
        };

  if (resolvedOnGithub) {
    return (
      <CommentMarkerChipLink label={config.openLabel} testId={config.openTestId} onOpen={onOpen}>
        <TranscriptShell
          tone="success"
          variant="pill"
          className={`inline-flex flex-wrap items-center gap-1.5 text-xs font-medium ${tintClasses('success').text}`}
        >
          <CheckCheck size={12} aria-hidden />
          <span>
            {marker.kind === 'resolved'
              ? 'conversation resolved'
              : 'marked solved with explanation'}
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
      </CommentMarkerChipLink>
    );
  }

  if (marker.kind === 'analysis') {
    const isFix = marker.value.verdict === 'fix';
    const tone = isFix ? 'info' : 'warning';
    const accent = isFix ? tintClasses('info') : tintClasses('warning');

    return (
      <CommentMarkerChipLink label={config.openLabel} testId={config.openTestId} onOpen={onOpen}>
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
        </TranscriptShell>
      </CommentMarkerChipLink>
    );
  }

  if (marker.kind === 'resolved') {
    const shaShort = marker.value.commitSha.slice(0, 7);

    return (
      <CommentMarkerChipLink label={config.openLabel} testId={config.openTestId} onOpen={onOpen}>
        <TranscriptShell
          tone={queued ? 'info' : 'success'}
          variant="boxed"
          className="flex flex-wrap items-center gap-1.5 text-xs"
        >
          {queued ? (
            <Clock size={12} aria-hidden className={tintClasses('info').icon} />
          ) : (
            <CheckCheck size={12} aria-hidden className={tintClasses('success').icon} />
          )}
          <span className="font-medium text-foreground">
            {queued ? 'solved locally · pending push' : 'fix committed locally'}
          </span>
          <span className="font-mono text-2xs text-muted-foreground">{threadId}</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-background/60 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
            <GitCommit size={9} aria-hidden />
            {shaShort}
          </span>
          {reply === null ? null : <CommentReplyPreview body={reply} />}
        </TranscriptShell>
      </CommentMarkerChipLink>
    );
  }

  return (
    <CommentMarkerChipLink label={config.openLabel} testId={config.openTestId} onOpen={onOpen}>
      <TranscriptShell
        tone="warning"
        variant="boxed"
        className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs"
      >
        <Ban size={12} aria-hidden className={tintClasses('warning').icon} />
        <span className="font-medium text-foreground">not worth a change</span>
        <span className="min-w-0 truncate font-mono text-2xs text-muted-foreground">
          {threadId}
        </span>
        <span className="basis-full text-2xs leading-relaxed text-muted-foreground">
          {marker.value.reason}
        </span>
        {reply === null ? null : <CommentReplyPreview body={reply} />}
      </TranscriptShell>
    </CommentMarkerChipLink>
  );
};
