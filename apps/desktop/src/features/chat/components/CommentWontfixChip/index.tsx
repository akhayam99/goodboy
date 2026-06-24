import { useMemo, useState } from 'react';
import { Ban, CheckCheck, MessageSquareReply, X } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { extractCommentWontfix, isReviewThreadId } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly assistantText: string;
  readonly sessionId: SessionId;
};

type ChipState =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'resolved' }
  | { kind: 'dismissed' };

export const CommentWontfixChip = ({ assistantText, sessionId }: Props) => {
  const marker = useMemo(() => extractCommentWontfix(assistantText), [assistantText]);
  const threadId = marker?.threadId;

  const resolveGithubThread = useAppStore((s) => s.resolveGithubThread);
  const resolvedOnGithub = useAppStore((s) =>
    threadId
      ? (s.sessionGithub[sessionId]?.detail?.comments?.some(
          (c) => c.threadId === threadId && c.resolved === true,
        ) ?? false)
      : false,
  );

  const [state, setState] = useState<ChipState>({ kind: 'idle' });

  if (!marker || !isReviewThreadId(marker.threadId)) {
    return null;
  }

  if (state.kind === 'resolved' || resolvedOnGithub) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
        <CheckCheck size={11} aria-hidden />
        <span>marked solved with explanation</span>
      </div>
    );
  }

  if (state.kind === 'dismissed') {
    return null;
  }

  const busy = state.kind === 'resolving';

  const markSolved = async () => {
    if (busy) {
      return;
    }
    setState({ kind: 'resolving' });
    const ok = await resolveGithubThread(sessionId, marker.threadId, { reason: marker.reason });
    setState(ok ? { kind: 'resolved' } : { kind: 'idle' });
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-[11px]">
      <Ban size={12} aria-hidden className="text-warning" />
      <span className="font-medium text-foreground">not worth a change</span>
      <span className="min-w-0 max-w-xs truncate text-muted-foreground/80" title={marker.reason}>
        {marker.reason}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => void markSolved()}
          disabled={busy}
          data-testid="comment-wontfix-explain"
          aria-label="post the explanation and mark the thread solved"
          title="post the reason as a reply and resolve the thread on GitHub"
          className={cn(
            'relative inline-flex items-center gap-1 rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60',
            busy && 'animate-border-pulse',
          )}
        >
          <MessageSquareReply size={9} aria-hidden />
          {busy ? 'Marking…' : 'Mark as solved & explain'}
        </button>
        <button
          type="button"
          onClick={() => setState({ kind: 'dismissed' })}
          disabled={busy}
          title="keep the conversation open on GitHub"
          aria-label="keep the conversation open on GitHub"
          className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={10} aria-hidden />
        </button>
      </div>
    </div>
  );
};
