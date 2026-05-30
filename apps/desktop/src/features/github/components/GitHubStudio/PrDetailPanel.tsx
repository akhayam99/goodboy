import { useCallback, useEffect, useState } from 'react';
import type { PrComment, PrDetail, PullRequestState, SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import {
  ArrowRight,
  ExternalLink,
  GitMerge,
  GitPullRequest,
  GitPullRequestDraft,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  XCircle,
} from 'lucide-react';
import { GithubCard } from '../Card';
import { PullRequestChip } from '../PullRequestChip';
import {
  buildCommentAgentArgs,
  buildReviewChangesAgentArgs,
  type CommentAgentArgs,
} from '../../../chat/spawn-from-comment';
import { openUrl } from '../../../../shared/lib/editor';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore, useSessions } from '../../../../store';
import { ghPrDetailByNumber, ghPrsForBranch } from '../../github';
import { CreatePrDialog } from './CreatePrDialog';
import { PrSwitcher } from './PrSwitcher';

interface Props {
  readonly sessionId: SessionId | null;
  readonly onClose: () => void;
}

const TOOLBAR_BTN =
  'inline-flex items-center gap-1.5 rounded-md border border-border-soft px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

type Busy = 'ready' | 'undraft' | 'merge' | 'close' | 'reopen' | null;

export function PrDetailPanel({ sessionId, onClose }: Props) {
  const sessions = useSessions();
  const session = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;
  const github = useAppStore((s) => (sessionId ? s.sessionGithub[sessionId] : null));
  const branch = useAppStore((s) => (sessionId ? (s.sessionBranches[sessionId] ?? null) : null));
  const workspaceRoot = useAppStore((s) => {
    const sess = sessionId ? s.sessions.find((x) => x.id === sessionId) : undefined;
    const ws = sess ? s.workspaces.find((w) => w.id === sess.workspaceId) : undefined;
    return ws?.rootPath ?? null;
  });
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const markPrReady = useAppStore((s) => s.markPrReady);
  const convertPrToDraft = useAppStore((s) => s.convertPrToDraft);
  const mergePr = useAppStore((s) => s.mergePr);
  const closePr = useAppStore((s) => s.closePr);
  const reopenPr = useAppStore((s) => s.reopenPr);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);

  const [busy, setBusy] = useState<Busy>(null);
  const [mergeConfirm, setMergeConfirm] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [prs, setPrs] = useState<ReadonlyArray<PullRequestState>>([]);
  const [prsTick, setPrsTick] = useState(0);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [localDetail, setLocalDetail] = useState<PrDetail | null>(null);
  const [localDetailLoading, setLocalDetailLoading] = useState(false);
  const [localDetailError, setLocalDetailError] = useState<string | null>(null);

  const primary = github?.pr ?? null;
  const primaryNumber = primary?.number ?? null;
  const options = prs.length > 0 ? prs : primary ? [primary] : [];
  const selected = selectedNumber ?? primaryNumber ?? options[0]?.number ?? null;
  const activePr = options.find((p) => p.number === selected) ?? primary;
  const isPrimary = !!activePr && activePr.number === primaryNumber;

  const detail = isPrimary ? (github?.detail ?? null) : localDetail;
  const detailLoading = isPrimary ? !!github?.detailLoading : localDetailLoading;
  const detailError = isPrimary ? (github?.detailError ?? null) : localDetailError;
  const detailFetchedAt = isPrimary ? (github?.detailFetchedAt ?? null) : null;

  const fetchLocalDetail = useCallback(
    async (num: number) => {
      if (!workspaceRoot) return;
      setLocalDetailLoading(true);
      setLocalDetailError(null);
      try {
        setLocalDetail(await ghPrDetailByNumber(workspaceRoot, num));
      } catch (e) {
        setLocalDetailError(formatError(e));
      } finally {
        setLocalDetailLoading(false);
      }
    },
    [workspaceRoot],
  );

  useEffect(() => {
    setSelectedNumber(null);
    setLocalDetail(null);
    setLocalDetailError(null);
    setMergeConfirm(false);
    setCreateOpen(false);
  }, [sessionId]);

  useEffect(() => {
    if (!branch || !workspaceRoot) {
      setPrs([]);
      return;
    }
    let cancelled = false;
    void ghPrsForBranch(workspaceRoot, branch)
      .then((list) => {
        if (!cancelled) setPrs(list);
      })
      .catch(() => {
        if (!cancelled) setPrs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [branch, workspaceRoot, prsTick]);

  useEffect(() => {
    if (!sessionId || !isPrimary || !activePr) return;
    if (!github?.detail && !github?.detailLoading && !github?.detailError) {
      void refreshSessionPrDetail(sessionId);
    }
  }, [
    sessionId,
    isPrimary,
    activePr,
    github?.detail,
    github?.detailLoading,
    github?.detailError,
    refreshSessionPrDetail,
  ]);

  useEffect(() => {
    if (!activePr || isPrimary) return;
    void fetchLocalDetail(activePr.number);
  }, [activePr, isPrimary, fetchLocalDetail]);

  if (!sessionId || !session) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground/70">Pick a session from the inbox.</p>
      </div>
    );
  }

  const refreshActive = () => {
    if (!activePr) return;
    if (isPrimary) void refreshSessionPrDetail(sessionId, { force: true });
    else void fetchLocalDetail(activePr.number);
  };

  const runResolve = async (args: CommentAgentArgs) => {
    const agentId = await spawnAgent(sessionId, {
      name: args.name,
      model: args.model,
      effort: args.effort,
      initialPrompt: args.initialPrompt,
      kindOverride: args.kind,
    });
    await selectAgent(sessionId, agentId);
    await setCurrentSession(sessionId);
    onClose();
  };

  const onSpawnFromComment = (comment: PrComment) => {
    if (!activePr) return;
    void runResolve(buildCommentAgentArgs(comment, activePr));
  };

  const onSpawnFromReviewChanges = () => {
    if (!activePr) return;
    const open = (detail?.comments ?? []).filter(
      (c) => c.source === 'review' && c.resolved === false,
    );
    void runResolve(buildReviewChangesAgentArgs(activePr, open));
  };

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
      setPrsTick((t) => t + 1);
      refreshActive();
    } catch {
      void 0;
    } finally {
      setBusy(null);
      setMergeConfirm(false);
    }
  };

  const activeNumber = activePr?.number;
  const isMerged = activePr?.state === 'merged';
  const isClosed = activePr?.state === 'closed';
  const isDraft = !!activePr?.isDraft;
  const isTerminal = isMerged || isClosed;
  const canMerge = !!activePr && !isTerminal && !isDraft && activePr.mergeable !== false;
  const mergeReason = !activePr
    ? ''
    : isDraft
      ? 'mark the PR ready before merging'
      : activePr.mergeable === false
        ? 'PR has conflicts, resolve them first'
        : 'squash merge this PR';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 flex-col gap-2 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {options.length > 1 ? (
            <PrSwitcher prs={options} selected={selected} onSelect={setSelectedNumber} />
          ) : activePr ? (
            <PullRequestChip
              state={activePr.state}
              variant="badge"
              number={activePr.number}
              iconSize={12}
            />
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              <GitPullRequest size={10} aria-hidden />
              No PR
            </span>
          )}
          <h2
            className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
            title={activePr?.title ?? session.goal}
          >
            {activePr?.title ?? session.goal}
          </h2>
        </div>
        {activePr ? (
          <p className="flex items-center gap-1 truncate font-mono text-2xs text-muted-foreground/70">
            <span className="truncate">{activePr.headBranch}</span>
            <ArrowRight size={9} aria-hidden className="shrink-0" />
            <span className="truncate">{activePr.baseBranch}</span>
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {isDraft ? (
            <button
              type="button"
              onClick={() =>
                activeNumber != null &&
                void run('ready', () => markPrReady(sessionId, activeNumber))
              }
              disabled={busy !== null}
              className={TOOLBAR_BTN}
            >
              {busy === 'ready' ? (
                <Loader2 size={13} aria-hidden className="animate-spin" />
              ) : (
                <Send size={13} aria-hidden />
              )}
              Mark ready
            </button>
          ) : activePr && !isTerminal ? (
            <button
              type="button"
              onClick={() =>
                activeNumber != null &&
                void run('undraft', () => convertPrToDraft(sessionId, activeNumber))
              }
              disabled={busy !== null}
              className={TOOLBAR_BTN}
            >
              {busy === 'undraft' ? (
                <Loader2 size={13} aria-hidden className="animate-spin" />
              ) : (
                <GitPullRequestDraft size={13} aria-hidden />
              )}
              Convert to draft
            </button>
          ) : null}

          {isClosed ? (
            <>
              <button
                type="button"
                onClick={() =>
                  activeNumber != null &&
                  void run('reopen', () => reopenPr(sessionId, activeNumber))
                }
                disabled={busy !== null}
                className={TOOLBAR_BTN}
              >
                {busy === 'reopen' ? (
                  <Loader2 size={13} aria-hidden className="animate-spin" />
                ) : (
                  <RotateCcw size={13} aria-hidden />
                )}
                Reopen
              </button>
              <button type="button" onClick={() => setCreateOpen(true)} className={TOOLBAR_BTN}>
                <Plus size={13} aria-hidden />
                Create new PR
              </button>
            </>
          ) : null}

          {activePr && !isTerminal ? (
            <button
              type="button"
              onClick={() =>
                activeNumber != null && void run('close', () => closePr(sessionId, activeNumber))
              }
              disabled={busy !== null}
              className={TOOLBAR_BTN}
            >
              {busy === 'close' ? (
                <Loader2 size={13} aria-hidden className="animate-spin" />
              ) : (
                <XCircle size={13} aria-hidden />
              )}
              Close
            </button>
          ) : null}

          {activePr ? (
            <>
              <button
                type="button"
                onClick={() => void openUrl(activePr.url)}
                className={TOOLBAR_BTN}
              >
                <ExternalLink size={13} aria-hidden />
                Open on GitHub
              </button>
              <button
                type="button"
                onClick={refreshActive}
                disabled={detailLoading}
                className={TOOLBAR_BTN}
                aria-label="refresh pr data"
              >
                <RefreshCw size={13} aria-hidden className={cn(detailLoading && 'animate-spin')} />
                Refresh
              </button>
            </>
          ) : null}

          {activePr && !isTerminal ? (
            <div className="ml-auto">
              {mergeConfirm ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-2 py-1 text-xs">
                  <span className="text-foreground">Squash merge?</span>
                  <button
                    type="button"
                    onClick={() =>
                      activeNumber != null &&
                      void run('merge', () => mergePr(sessionId, activeNumber))
                    }
                    disabled={busy !== null}
                    className="rounded bg-success px-1.5 py-0.5 text-[11px] font-semibold text-success-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {busy === 'merge' ? 'merging' : 'confirm'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMergeConfirm(false)}
                    className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setMergeConfirm(true)}
                  disabled={!canMerge || busy !== null}
                  title={mergeReason}
                  className={cn(
                    TOOLBAR_BTN,
                    canMerge &&
                      'border-success/40 text-success hover:bg-success/10 hover:text-success',
                  )}
                >
                  <GitMerge size={13} aria-hidden />
                  Merge
                </button>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {activePr ? (
          <GithubCard
            pr={activePr}
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            detailFetchedAt={detailFetchedAt}
            branchLastActivity={null}
            onOpenUrl={(url) => void openUrl(url)}
            onRefresh={refreshActive}
            onSpawnFromComment={onSpawnFromComment}
            onSpawnFromReviewChanges={onSpawnFromReviewChanges}
          />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-soft px-6 py-10 text-center">
            <GitPullRequest size={24} aria-hidden className="text-muted-foreground/50" />
            <p className="text-sm text-foreground">Ready to open a pull request.</p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus size={14} aria-hidden />
              Create PR
            </button>
            <p className="text-2xs text-muted-foreground/60">
              Compose the title and description, or let AI draft it.
            </p>
          </div>
        )}
      </div>

      {createOpen ? (
        <CreatePrDialog
          sessionId={sessionId}
          defaultTitle={session.goal}
          closedPr={
            isClosed && activePr ? { number: activePr.number, url: activePr.url } : undefined
          }
          onClose={() => setCreateOpen(false)}
          onStudioClose={onClose}
        />
      ) : null}
    </div>
  );
}
