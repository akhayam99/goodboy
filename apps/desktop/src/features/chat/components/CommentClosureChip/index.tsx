import { useMemo, useState } from 'react';
import { CheckCheck, GitCommit, Loader2, X } from 'lucide-react';
import {
  extractCommentDismissed,
  extractCommentResolved,
  type ExtractedCommentDismissal,
  type ExtractedCommentResolution,
} from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

interface CommentClosureChipProps {
  readonly assistantText: string;
  readonly sessionId: SessionId;
}

type ClosureMarker =
  | { variant: 'resolved'; data: ExtractedCommentResolution }
  | { variant: 'dismissed'; data: ExtractedCommentDismissal };

type ChipState =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'resolved' }
  | { kind: 'dismissed' };

function pickMarker(text: string): ClosureMarker | null {
  const resolved = extractCommentResolved(text);
  if (resolved) return { variant: 'resolved', data: resolved };
  const dismissed = extractCommentDismissed(text);
  if (dismissed) return { variant: 'dismissed', data: dismissed };
  return null;
}

/**
 * Renders alongside an assistant turn that ends a review conversation. Two
 * shapes share this surface:
 *   - resolved: agent committed a fix → "Mark as Solved" posts the commit
 *     reference and closes the thread on github.
 *   - dismissed: agent decided the comment is not actionable → "Close on
 *     GitHub" posts the reason and closes the thread.
 * If both markers appear in the same turn (shouldn't happen — prompt forbids
 * it) resolved wins because it carries the commit reference.
 */
export function CommentClosureChip({ assistantText, sessionId }: CommentClosureChipProps) {
  const marker = useMemo(() => pickMarker(assistantText), [assistantText]);
  const resolveGithubThread = useAppStore((s) => s.resolveGithubThread);
  const [state, setState] = useState<ChipState>({ kind: 'idle' });

  if (!marker) return null;
  if (state.kind === 'dismissed') return null;

  if (state.kind === 'resolved') {
    if (marker.variant === 'resolved') {
      const shaShort = marker.data.commitSha.slice(0, 7);
      return (
        <div
          role="status"
          className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success"
        >
          <CheckCheck size={11} aria-hidden />
          <span>conversation resolved</span>
          <span className="text-muted-foreground/70">·</span>
          <GitCommit size={10} aria-hidden className="text-muted-foreground/80" />
          <span className="font-mono text-muted-foreground/80">{shaShort}</span>
        </div>
      );
    }
    return (
      <div
        role="status"
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
      >
        <X size={11} aria-hidden />
        <span>conversation closed</span>
      </div>
    );
  }

  const onConfirm = async () => {
    if (state.kind === 'resolving') return;
    setState({ kind: 'resolving' });
    const closure =
      marker.variant === 'resolved'
        ? { commitSha: marker.data.commitSha }
        : { reason: marker.data.reason };
    const ok = await resolveGithubThread(sessionId, marker.data.threadId, closure);
    setState(ok ? { kind: 'resolved' } : { kind: 'idle' });
  };

  const busy = state.kind === 'resolving';

  if (marker.variant === 'resolved') {
    const shaShort = marker.data.commitSha.slice(0, 7);
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
            onClick={() => void onConfirm()}
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
            onClick={() => setState({ kind: 'dismissed' })}
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

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-[11px]">
      <X size={12} aria-hidden className="text-muted-foreground" />
      <span className="font-medium text-foreground">comment dismissed</span>
      <span title={marker.data.reason} className="max-w-[28rem] truncate text-muted-foreground/80">
        {marker.data.reason}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => void onConfirm()}
          disabled={busy}
          data-testid="comment-dismissed-confirm"
          aria-label="Close conversation on GitHub"
          className="inline-flex items-center gap-1 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 size={9} aria-hidden className="animate-spin" /> : null}
          Close on GitHub
        </button>
        <button
          type="button"
          onClick={() => setState({ kind: 'dismissed' })}
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
