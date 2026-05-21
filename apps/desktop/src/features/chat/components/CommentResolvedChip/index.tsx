import { useMemo, useState } from 'react';
import { CheckCheck, GitCommit, Loader2, X } from 'lucide-react';
import { extractCommentResolved } from '@goodboy/core';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

interface CommentResolvedChipProps {
  readonly assistantText: string;
  readonly sessionId: SessionId;
}

type ChipState =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'resolved' }
  | { kind: 'dismissed' };

/**
 * Renders alongside an assistant turn when the agent emitted a
 * `<<comment-resolved threadId="..." commit="...">>` marker after committing
 * a fix locally. Offers one click to mark the underlying review thread
 * resolved on github (via the resolveReviewThread graphql mutation) and a
 * second to dismiss without taking action.
 */
export function CommentResolvedChip({ assistantText, sessionId }: CommentResolvedChipProps) {
  const marker = useMemo(() => extractCommentResolved(assistantText), [assistantText]);
  const resolveGithubThread = useAppStore((s) => s.resolveGithubThread);
  const [state, setState] = useState<ChipState>({ kind: 'idle' });

  if (!marker) return null;
  if (state.kind === 'dismissed') return null;

  const shaShort = marker.commitSha.slice(0, 7);

  if (state.kind === 'resolved') {
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
      <span className="text-muted-foreground/80">resolve the review conversation on github?</span>
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={() => void onResolve()}
          disabled={busy}
          data-testid="comment-resolved-confirm"
          aria-label="Resolve conversation"
          className="inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-success-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? <Loader2 size={9} aria-hidden className="animate-spin" /> : null}
          Resolve conversation
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
