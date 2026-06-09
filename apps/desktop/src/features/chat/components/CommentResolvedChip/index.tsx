import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Clock, GitCommit, Loader2, Upload, X } from 'lucide-react';
import { extractCommentResolved, isReviewThreadId } from '@goodboy/core';
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

const DISMISS_PREFIX = 'goodboy:comment-dismissed:';

function readDismissed(threadId: string | undefined): boolean {
  if (!threadId) return false;
  try {
    return localStorage.getItem(DISMISS_PREFIX + threadId) === '1';
  } catch {
    return false;
  }
}

function persistDismissed(threadId: string) {
  try {
    localStorage.setItem(DISMISS_PREFIX + threadId, '1');
  } catch {
    void 0;
  }
}

/**
 * Renders alongside an assistant turn when the agent emitted a
 * `<<comment-resolved threadId="..." commit="...">>` marker after committing
 * a fix locally. The fix is already committed, so the choice is when to
 * publish: the primary action queues it for a batched single push (resolved
 * later via the ContextPanel "Push & resolve" button), the secondary pushes
 * and resolves this one thread immediately.
 */
export function CommentResolvedChip({ assistantText, sessionId }: Props) {
  const marker = useMemo(() => extractCommentResolved(assistantText), [assistantText]);
  const threadId = marker?.threadId;

  const queueResolution = useAppStore((s) => s.queueResolution);
  const dequeueResolution = useAppStore((s) => s.dequeueResolution);
  const resolveGithubThread = useAppStore((s) => s.resolveGithubThread);
  const loadPendingResolutions = useAppStore((s) => s.loadPendingResolutions);

  const prNumber = useAppStore((s) => s.sessionGithub[sessionId]?.pr?.number ?? null);
  const resolvedOnGithub = useAppStore((s) =>
    threadId
      ? (s.sessionGithub[sessionId]?.detail?.comments?.some(
          (c) => c.threadId === threadId && c.resolved === true,
        ) ?? false)
      : false,
  );
  const queued = useAppStore((s) =>
    threadId
      ? (s.sessionPendingResolutions[sessionId]?.some((r) => r.threadId === threadId) ?? false)
      : false,
  );

  const [state, setState] = useState<ChipState>(() =>
    readDismissed(threadId) ? { kind: 'dismissed' } : { kind: 'idle' },
  );

  useEffect(() => {
    void loadPendingResolutions(sessionId);
  }, [sessionId, loadPendingResolutions]);

  if (!marker || !isReviewThreadId(marker.threadId)) return null;

  const shaShort = marker.commitSha.slice(0, 7);

  if (state.kind === 'resolved' || resolvedOnGithub) {
    return (
      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
        <CheckCheck size={11} aria-hidden />
        <span>conversation resolved</span>
        <span className="text-muted-foreground/70">·</span>
        <GitCommit size={10} aria-hidden className="text-muted-foreground/80" />
        <span className="font-mono text-muted-foreground/80">{shaShort}</span>
      </div>
    );
  }

  if (state.kind === 'dismissed' && !queued) return null;

  const pushNow = async () => {
    if (state.kind === 'resolving') return;
    setState({ kind: 'resolving' });
    const ok = await resolveGithubThread(sessionId, marker.threadId, {
      commitSha: marker.commitSha,
    });
    if (ok && queued) await dequeueResolution(sessionId, marker.threadId);
    setState(ok ? { kind: 'resolved' } : { kind: 'idle' });
  };

  const queue = () => {
    if (prNumber === null) return;
    void queueResolution(sessionId, {
      threadId: marker.threadId,
      commitSha: marker.commitSha,
      prNumber,
    });
  };

  const busy = state.kind === 'resolving';

  if (queued) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-info/30 bg-info/5 px-2.5 py-1.5 text-[11px]">
        <Clock size={12} aria-hidden className="text-info" />
        <span className="font-medium text-foreground">solved locally · pending push</span>
        <span className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          <GitCommit size={9} aria-hidden />
          {shaShort}
        </span>
        <span className="text-muted-foreground/80">
          publish from "Push &amp; resolve" in context
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => void pushNow()}
            disabled={busy}
            title="push and resolve this one now"
            className="inline-flex items-center gap-1 rounded-full bg-info px-2 py-0.5 text-[10px] font-semibold text-info-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 size={9} aria-hidden className="animate-spin" /> : null}
            Push now
          </button>
          <button
            type="button"
            onClick={() => void dequeueResolution(sessionId, marker.threadId)}
            disabled={busy}
            title="remove from the batch (keeps the local commit)"
            aria-label="remove from the batch"
            className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={10} aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-success/30 bg-success/5 px-2.5 py-1.5 text-[11px]">
      <CheckCheck size={12} aria-hidden className="text-success" />
      <span className="font-medium text-foreground">fix committed locally</span>
      <span className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        <GitCommit size={9} aria-hidden />
        {shaShort}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={queue}
          disabled={busy || prNumber === null}
          data-testid="comment-resolved-queue"
          aria-label="mark solved, push later"
          title="mark solved and batch it for a single push later"
          className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Clock size={9} aria-hidden />
          Mark solved (push later)
        </button>
        <button
          type="button"
          onClick={() => void pushNow()}
          disabled={busy}
          data-testid="comment-resolved-confirm"
          aria-label="push and mark as solved now"
          title="push and resolve this thread immediately"
          className="inline-flex items-center gap-1 rounded-full border border-info/40 px-2 py-0.5 text-[10px] font-semibold text-info transition-colors hover:bg-info/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 size={9} aria-hidden className="animate-spin" />
          ) : (
            <Upload size={9} aria-hidden />
          )}
          Push &amp; mark now
        </button>
        <button
          type="button"
          onClick={() => {
            persistDismissed(marker.threadId);
            setState({ kind: 'dismissed' });
          }}
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
}
