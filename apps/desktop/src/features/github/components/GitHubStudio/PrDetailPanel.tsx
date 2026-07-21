import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { AgentId, PrDetail, PullRequestState, SessionId } from '@goodboy/types';
import { Divider, EmptyState, ScrollFade, Skeleton } from '@goodboy/ui';
import { AlertCircle, Inbox, RefreshCw } from 'lucide-react';
import {
  buildCommentAgentArgs,
  type CommentAgentArgs,
  type ResolveModelChoice,
} from '../../../chat/spawn-from-comment';
import { useResolverIndex } from '../../../session/hooks/useResolverIndex';
import { resolverForComment, type ResolverLink } from '../../../session/resolver-linkage';
import { openUrl } from '../../../../shared/lib/editor';
import { formatError } from '../../../../shared/lib/errors';
import { useAppStore, useSessions } from '../../../../store';
import { ghPrDetailByNumber, ghPrsForBranch } from '../../github';
import { groupThreads, type CommentThread } from '../../comment-threads';
import { CreatePrPanel } from './CreatePrPanel';
import { PrActionBar, type ActionBusy } from './PrActionBar';
import { PrChecks } from './PrChecks';
import { PrConversation } from './PrConversation';
import { ResolveBoard } from './ResolveBoard';
import { PrOverview } from './PrOverview';
import { PrSidebar, type PrSection } from './PrSidebar';

type Props = {
  readonly sessionId: SessionId | null;
  readonly initialPrNumber?: number | null;
  readonly initialThreadId?: string | null;
  readonly onClose: () => void;
};

export const PrDetailPanel = ({
  sessionId,
  initialPrNumber = null,
  initialThreadId = null,
  onClose,
}: Props) => {
  const sessions = useSessions();
  const session = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;
  const github = useAppStore((s) => (sessionId ? s.sessionGithub[sessionId] : null));
  const branch = useAppStore((s) => (sessionId ? (s.sessionBranches[sessionId] ?? null) : null));
  const workspaceRoot = useAppStore((s) => {
    const sess = sessionId ? s.sessions.find((x) => x.id === sessionId) : undefined;
    const ws = sess ? s.workspaces.find((w) => w.id === sess.workspaceId) : undefined;
    return ws?.rootPath ?? null;
  });
  const workspaceId = session?.workspaceId;
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const refreshSessionPr = useAppStore((s) => s.refreshSessionPr);
  const markPrReady = useAppStore((s) => s.markPrReady);
  const convertPrToDraft = useAppStore((s) => s.convertPrToDraft);
  const mergePr = useAppStore((s) => s.mergePr);
  const closePr = useAppStore((s) => s.closePr);
  const reopenPr = useAppStore((s) => s.reopenPr);
  const requestReview = useAppStore((s) => s.requestReview);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectAgent = useAppStore((s) => s.selectAgent);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const activateNextResolver = useAppStore((s) => s.activateNextResolver);
  const setAgentConfig = useAppStore((s) => s.setAgentConfig);

  const resolverIndex = useResolverIndex((sessionId ?? '') as SessionId);
  const resolverFor = useCallback(
    (thread: CommentThread): ResolverLink | undefined =>
      resolverForComment(resolverIndex, { threadId: thread.head.threadId, url: thread.head.url }),
    [resolverIndex],
  );

  const [busy, setBusy] = useState<ActionBusy>(null);
  const [mergeConfirm, setMergeConfirm] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [section, setSection] = useState<PrSection>('overview');
  const [jumpThreadId, setJumpThreadId] = useState<string | null>(null);
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

  const fetchLocalDetail = useCallback(
    async (num: number) => {
      if (!workspaceRoot) {
        return;
      }
      setLocalDetailLoading(true);
      setLocalDetailError(null);
      try {
        setLocalDetail(await ghPrDetailByNumber(workspaceRoot, num, workspaceId));
      } catch (e) {
        setLocalDetailError(formatError(e));
      } finally {
        setLocalDetailLoading(false);
      }
    },
    [workspaceRoot, workspaceId],
  );

  useEffect(() => {
    setSelectedNumber(null);
    setPrs([]);
    setLocalDetail(null);
    setLocalDetailError(null);
    setMergeConfirm(false);
    setCreateOpen(false);
    setSection('overview');
  }, [sessionId]);

  useEffect(() => {
    if (initialThreadId == null) {
      return;
    }
    if (initialPrNumber != null) {
      setSelectedNumber(initialPrNumber);
    }
    setSection('comments');
  }, [sessionId, initialThreadId, initialPrNumber]);

  useEffect(() => {
    if (!branch || !workspaceRoot) {
      setPrs([]);
      return;
    }
    let cancelled = false;
    void ghPrsForBranch(workspaceRoot, branch, workspaceId)
      .then((list) => {
        if (!cancelled) {
          setPrs(list);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrs([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [branch, workspaceRoot, workspaceId, prsTick]);

  useEffect(() => {
    if (!sessionId || !isPrimary || !activePr) {
      return;
    }
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
    if (!sessionId || prs.length === 0) {
      return;
    }
    if ((prs[0]?.number ?? null) === primaryNumber) {
      return;
    }
    void refreshSessionPr(sessionId, { force: true, silent: true });
  }, [sessionId, prs, primaryNumber, refreshSessionPr]);

  useEffect(() => {
    if (!activePr || isPrimary) {
      return;
    }
    void fetchLocalDetail(activePr.number);
  }, [activePr, isPrimary, fetchLocalDetail]);

  if (!sessionId || !session) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <EmptyState
          icon={Inbox}
          title="No session selected"
          description="Pick a session from the inbox to see its pull request."
        />
      </div>
    );
  }

  const refreshActive = () => {
    if (!activePr) {
      return;
    }
    if (isPrimary) {
      void refreshSessionPrDetail(sessionId, { force: true });
    } else {
      void fetchLocalDetail(activePr.number);
    }
  };

  const onMutated = () => {
    setPrsTick((t) => t + 1);
    refreshActive();
  };

  const spawnResolver = async (
    args: CommentAgentArgs,
    choice: ResolveModelChoice,
    deferKickoff: boolean,
  ) => {
    const agentId = await spawnAgent(sessionId, {
      name: args.name,
      model: args.model,
      ...(args.provider !== undefined && { provider: args.provider }),
      effort: args.effort,
      initialPrompt: args.initialPrompt,
      kindOverride: args.kind,
      ...(args.sourceThreadId !== undefined && { sourceThreadId: args.sourceThreadId }),
      sourceCommentUrl: args.sourceCommentUrl,
      ...(deferKickoff && { deferKickoff: true }),
    });
    await setAgentConfig(sessionId, agentId, {
      ...(choice.provider !== undefined && { providerOverride: choice.provider }),
      ...(choice.model !== undefined && { modelOverride: choice.model }),
      effort: args.effort,
    });
    return agentId;
  };

  const openResolver = (agentId: AgentId) => {
    void (async () => {
      await setCurrentSession(sessionId);
      setActiveLens(sessionId, 'resolve');
      await selectAgent(sessionId, agentId);
      onClose();
    })();
  };

  const onSpawnOne = (thread: CommentThread, choice: ResolveModelChoice) => {
    if (!activePr) {
      return;
    }
    const existing = resolverFor(thread);
    if (existing && existing.status !== 'failed') {
      openResolver(existing.agent.id as AgentId);
      return;
    }
    void (async () => {
      const agentId = await spawnResolver(
        buildCommentAgentArgs(thread.head, activePr, choice, thread.replies),
        choice,
        false,
      );
      await setCurrentSession(sessionId);
      await selectAgent(sessionId, agentId);
      onClose();
    })();
  };

  const onSpawnBatch = (
    batch: ReadonlyArray<CommentThread>,
    choiceById: Readonly<Record<string, ResolveModelChoice>>,
  ) => {
    if (!activePr || batch.length === 0) {
      return;
    }
    const fresh = batch.filter((t) => {
      const existing = resolverFor(t);
      return !existing || existing.status === 'failed';
    });
    if (fresh.length === 0) {
      void (async () => {
        await setCurrentSession(sessionId);
        onClose();
      })();
      return;
    }
    void (async () => {
      for (const t of fresh) {
        const choice = choiceById[t.head.id] ?? {};
        await spawnResolver(
          buildCommentAgentArgs(t.head, activePr, choice, t.replies),
          choice,
          true,
        );
      }
      await setCurrentSession(sessionId);
      await activateNextResolver(sessionId);
      onClose();
    })();
  };

  const run = async (kind: Exclude<ActionBusy, null>, fn: () => Promise<void>) => {
    if (busy) {
      return;
    }
    setBusy(kind);
    try {
      await fn();
      onMutated();
    } catch {
      void 0;
    } finally {
      setBusy(null);
      setMergeConfirm(false);
    }
  };

  const onAddReviewers = (logins: ReadonlyArray<string>) => {
    if (!activePr) {
      return;
    }
    void (async () => {
      try {
        await requestReview(sessionId, activePr.number, logins);
      } catch {
        void 0;
      }
      onMutated();
    })();
  };

  if (!activePr) {
    return (
      <div className="flex h-full flex-col">
        <CreatePrPanel
          sessionId={sessionId}
          defaultTitle={session.goal}
          onCreated={onMutated}
          onStudioClose={onClose}
        />
      </div>
    );
  }

  const isTerminal = activePr.state === 'merged' || activePr.state === 'closed';
  const isClosed = activePr.state === 'closed';
  const isDraft = activePr.isDraft;
  const canMerge = !isTerminal && !isDraft && activePr.mergeable !== false;
  const mergeReason = isDraft
    ? 'mark the PR ready before merging'
    : activePr.mergeable === false
      ? 'PR has conflicts, resolve them first'
      : 'squash merge this PR';
  const num = activePr.number;

  return (
    <div className="flex h-full min-h-0">
      <PrSidebar
        pr={activePr}
        options={options}
        selected={selected}
        onSelectPr={setSelectedNumber}
        detail={detail}
        section={section}
        onSection={setSection}
        workspaceRoot={workspaceRoot}
        onAddReviewers={onAddReviewers}
      />

      <Divider orientation="vertical" />

      <div className="flex min-w-0 flex-1 flex-col">
        <PrActionBar
          pr={activePr}
          sessionId={sessionId}
          onOpenSession={onClose}
          busy={busy}
          detailLoading={detailLoading}
          mergeConfirm={mergeConfirm}
          canMerge={canMerge}
          mergeReason={mergeReason}
          onMarkReady={() => void run('ready', () => markPrReady(sessionId, num))}
          onConvertDraft={() => void run('undraft', () => convertPrToDraft(sessionId, num))}
          onClose={() => void run('close', () => closePr(sessionId, num))}
          onReopen={() => void run('reopen', () => reopenPr(sessionId, num))}
          onCreateNew={() => setCreateOpen(true)}
          onMerge={() => void run('merge', () => mergePr(sessionId, num))}
          onSetMergeConfirm={setMergeConfirm}
          onOpenGithub={() => void openUrl(activePr.url)}
          onRefresh={refreshActive}
        />

        <Divider />

        {createOpen ? (
          <CreatePrPanel
            sessionId={sessionId}
            defaultTitle={session.goal}
            closedPr={isClosed ? { number: activePr.number, url: activePr.url } : undefined}
            onCreated={() => {
              setCreateOpen(false);
              onMutated();
            }}
            onCancel={() => setCreateOpen(false)}
            onStudioClose={onClose}
          />
        ) : (
          <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
            {section === 'overview' ? (
              <PrOverview pr={activePr} sessionId={sessionId} onMutated={onMutated} />
            ) : (
              <SectionBody
                detailLoading={detailLoading}
                detailError={detailError}
                detail={detail}
                onRetry={refreshActive}
              >
                {section === 'resolve' ? (
                  <ResolveBoard
                    threads={groupThreads(detail?.comments ?? []).filter(
                      (t) => t.head.source === 'review' && t.head.resolved === false,
                    )}
                    resolverFor={resolverFor}
                    onSpawnOne={onSpawnOne}
                    onSpawnBatch={onSpawnBatch}
                    onOpenResolver={openResolver}
                    onOpenThread={(threadId) => {
                      setJumpThreadId(threadId);
                      setSection('comments');
                    }}
                  />
                ) : section === 'comments' ? (
                  <PrConversation
                    comments={detail?.comments ?? []}
                    pr={activePr}
                    resolverFor={resolverFor}
                    scrollToThreadId={jumpThreadId ?? initialThreadId}
                    onOpenUrl={(u) => void openUrl(u)}
                  />
                ) : (
                  <PrChecks
                    checks={detail?.checks ?? []}
                    pr={activePr}
                    onOpenUrl={(u) => void openUrl(u)}
                  />
                )}
              </SectionBody>
            )}
          </ScrollFade>
        )}
      </div>
    </div>
  );
};

function SectionBody({
  detail,
  detailLoading,
  detailError,
  onRetry,
  children,
}: {
  detail: PrDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  onRetry: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-8 py-6">
      {detailError ? (
        <div className="flex items-center gap-1.5 text-xs text-danger">
          <AlertCircle size={13} aria-hidden />
          <span className="min-w-0 flex-1 truncate" title={detailError}>
            {detailError}
          </span>
          <button
            type="button"
            onClick={onRetry}
            aria-label="retry"
            className="rounded p-0.5 hover:bg-muted"
          >
            <RefreshCw size={12} aria-hidden />
          </button>
        </div>
      ) : detailLoading && !detail ? (
        <div className="flex flex-col gap-2" role="status" aria-label="loading pr data">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="size-4 shrink-0 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
