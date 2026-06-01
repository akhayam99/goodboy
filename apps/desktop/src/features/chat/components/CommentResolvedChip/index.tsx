import { useMemo, useState } from 'react';
import { CheckCheck, GitCommit, Loader2, X } from 'lucide-react';
import { extractCommentResolved, isReviewThreadId } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

interface Props {
  readonly assistantText: string;
  readonly sessionId: SessionId;
}

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
 * a fix locally. Offers one click to mark the underlying review thread
 * resolved on github (via the resolveReviewThread graphql mutation) and a
 * second to dismiss without taking action.
 */
export function CommentResolvedChip({ assistantText, sessionId }: Props) {
  const marker = useMemo(() => extractCommentResolved(assistantText), [assistantText]);
  const resolveGithubThread = useAppStore((s) => s.resolveGithubThread);
  const resolvedOnGithub = useAppStore((s) => {
    const tid = marker?.threadId;
    if (!tid) return false;
    return (
      s.sessionGithub[sessionId]?.detail?.comments?.some(
        (c) => c.threadId === tid && c.resolved === true,
      ) ?? false
    );
  });
  const [state, setState] = useState<ChipState>(() =>
    readDismissed(marker?.threadId) ? { kind: 'dismissed' } : { kind: 'idle' },
  );

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

  if (state.kind === 'dismissed') return null;

  const onResolve = async () => {
    if (state.kind === 'resolving') return;
    setState({ kind: 'resolving' });
    const ok = await resolveGithubThread(sessionId, marker.threadId, {
      commitSha: marker.commitSha,
    });
    setState(ok ? { kind: 'resolved' } : { kind: 'idle' });
  };

  const busy = state.kind === 'resolving';

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-success/30 bg-success/5 px-2.5 py-1.5 text-[11px]">
      <CheckCheck size={12} aria-hidden className="text-success" />
      <span className="font-medium text-foreground">fix committed locally</span>
      <span className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        <GitCommit size={9} aria-hidden />
        {shaShort}
      </span>
      <span className="text-muted-foreground/80">
        mark this review conversation as solved on github?
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => void onResolve()}
          disabled={busy}
          data-testid="comment-resolved-confirm"
          aria-label="Mark as Solved"
          className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 size={9} aria-hidden className="animate-spin" /> : null}
          Mark as Solved
        </button>
        <button
          type="button"
          onClick={() => {
            persistDismissed(marker.threadId);
            setState({ kind: 'dismissed' });
          }}
          disabled={busy}
          title="keep the conversation open on github"
          aria-label="keep the conversation open on github"
          className="rounded p-1 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={10} aria-hidden />
        </button>
      </div>
    </div>
  );
}
