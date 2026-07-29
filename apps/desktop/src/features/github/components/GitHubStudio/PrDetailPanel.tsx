import { useCallback, useEffect, useState } from 'react';
import type { AgentId, PrDetail, PullRequestState, SessionId } from '@goodboy/types';
import { Divider, EmptyState, ScrollFade } from '@goodboy/ui';
import { ArrowRight, Inbox } from 'lucide-react';
import {
  buildCombinedCommentAgentArgs,
  buildCommentAgentArgs,
  type CommentAgentArgs,
  type ResolveModelChoice,
} from '../../../chat/spawn-from-comment';
import { useResolverIndex } from '../../../session/hooks/useResolverIndex';
import { resolverForComment, type ResolverLink } from '../../../session/resolver-linkage';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { openUrl } from '../../../../shared/lib/editor';
import { formatError } from '../../../../shared/lib/errors';
import { HeaderBand } from '../../../../shared/components/StudioDetail';
import { useAppStore, useSessions } from '../../../../store';
import { ghPrDetailByNumber, ghPrsForBranch } from '../../github';
import { groupThreads, type CommentThread } from '../../comment-threads';
import { PullRequestChip } from '../PullRequestChip';
import { CreatePrPanel } from './CreatePrPanel';
import { PrActionBar, type ActionBusy } from './PrActionBar';
import { PrChecks } from './PrChecks';
import { PrConversation } from './PrConversation';
import { ResolveBoard } from './ResolveBoard';
import { PrOverview } from './PrOverview';
import { PrReviewers } from './PrReviewers';
import { PrSectionNav } from './PrSectionNav';
import { PrSwitcher } from './PrSwitcher';
import { SectionBody } from './SectionBody';
import type { PrSection } from './prSection';

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
  const session =
    sessionId != null ? sessions.find((candidate) => candidate.id === sessionId) : undefined;
  const github = useAppStore((state) =>
    sessionId != null ? state.sessionGithub[sessionId] : null,
  );
  const branch = useAppStore((state) =>
    sessionId != null ? (state.sessionBranches[sessionId] ?? null) : null,
  );
  const workspaceRoot = useAppStore((s) => {
    const sess =
      sessionId != null ? s.sessions.find((candidate) => candidate.id === sessionId) : undefined;
    const ws =
      sess != null
        ? s.workspaces.find((workspace) => workspace.id === sess.workspaceId)
        : undefined;
    return ws?.rootPath ?? null;
  });
  const workspaceId = session?.workspaceId;
  const roleModels = useSessionRoleModels({ sessionId });
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
  const options = prs.length > 0 ? prs : primary != null ? [primary] : [];
  const selected = selectedNumber ?? primaryNumber ?? options[0]?.number ?? null;
  const activePr = options.find((pr) => pr.number === selected) ?? primary;
  const isPrimary = activePr != null && activePr.number === primaryNumber;

  const detail = isPrimary ? (github?.detail ?? null) : localDetail;
  const detailLoading = isPrimary ? github?.detailLoading === true : localDetailLoading;
  const detailError = isPrimary ? (github?.detailError ?? null) : localDetailError;

  const fetchLocalDetail = useCallback(
    async (num: number) => {
      if (workspaceRoot == null || workspaceRoot === '') {
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
    if (branch == null || branch === '' || workspaceRoot == null || workspaceRoot === '') {
      setPrs([]);
      return;
    }
    let cancelled = false;
    void ghPrsForBranch(workspaceRoot, branch, workspaceId)
      .then((list) => {
        if (cancelled === false) {
          setPrs(list);
        }
      })
      .catch(() => {
        if (cancelled === false) {
          setPrs([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [branch, workspaceRoot, workspaceId, prsTick]);

  useEffect(() => {
    if (sessionId == null || isPrimary === false || activePr == null) {
      return;
    }
    if (github?.detail == null && github?.detailLoading !== true && github?.detailError == null) {
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
    if (sessionId == null || prs.length === 0) {
      return;
    }
    if ((prs[0]?.number ?? null) === primaryNumber) {
      return;
    }
    void refreshSessionPr(sessionId, { force: true, silent: true });
  }, [sessionId, prs, primaryNumber, refreshSessionPr]);

  useEffect(() => {
    if (activePr == null || isPrimary) {
      return;
    }
    void fetchLocalDetail(activePr.number);
  }, [activePr, isPrimary, fetchLocalDetail]);

  if (sessionId == null || session == null) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <EmptyState
          bordered
          tone="neutral"
          icon={Inbox}
          title="No session selected"
          description="Pick a session from the inbox to see its pull request."
        />
      </div>
    );
  }

  const refreshActive = () => {
    if (activePr == null) {
      return;
    }
    if (isPrimary) {
      void refreshSessionPrDetail(sessionId, { force: true });
      return;
    }
    void fetchLocalDetail(activePr.number);
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
      ...(args.sourceThreadIds !== undefined && { sourceThreadIds: args.sourceThreadIds }),
      sourceCommentUrl: args.sourceCommentUrl,
      sourceKind: args.sourceKind,
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
    if (activePr == null) {
      return;
    }
    const existing = resolverFor(thread);
    if (existing != null && existing.status !== 'failed') {
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
      setActiveLens(sessionId, 'resolve');
      await selectAgent(sessionId, agentId);
      onClose();
    })();
  };

  const onSpawnBatch = (
    batch: ReadonlyArray<CommentThread>,
    choiceById: Readonly<Record<string, ResolveModelChoice>>,
  ) => {
    if (activePr == null || batch.length === 0) {
      return;
    }
    const fresh = batch.filter((t) => {
      const existing = resolverFor(t);
      return existing == null || existing.status === 'failed';
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
      setActiveLens(sessionId, 'resolve');
      await activateNextResolver(sessionId);
      onClose();
    })();
  };

  const onSpawnCombined = (
    batch: ReadonlyArray<CommentThread>,
    choiceById: Readonly<Record<string, ResolveModelChoice>>,
  ) => {
    if (activePr == null || batch.length < 2 || batch.length > 8) {
      return;
    }
    const fresh = batch.filter((thread) => {
      const existing = resolverFor(thread);
      return existing == null || existing.status === 'failed';
    });
    if (fresh.length < 2) {
      return;
    }
    const first = fresh[0];
    if (first === undefined) {
      return;
    }
    const choice = choiceById[first.head.id] ?? {};
    void (async () => {
      await spawnResolver(buildCombinedCommentAgentArgs(fresh, activePr, choice), choice, true);
      await setCurrentSession(sessionId);
      setActiveLens(sessionId, 'resolve');
      await activateNextResolver(sessionId);
      onClose();
    })();
  };

  const run = async (kind: Exclude<ActionBusy, null>, fn: () => Promise<void>) => {
    if (busy != null) {
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
    if (activePr == null) {
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

  if (activePr == null) {
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-6 py-4">
        <HeaderBand
          meta={
            options.length > 1 ? (
              <PrSwitcher prs={options} selected={selected} onSelect={setSelectedNumber} />
            ) : (
              <PullRequestChip
                state={activePr.state}
                variant="badge"
                number={activePr.number}
                iconSize={12}
              />
            )
          }
          title={activePr.title}
          subtitle={
            activePr.headBranch !== '' && activePr.baseBranch !== '' ? (
              <span className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
                <span className="font-mono">{activePr.headBranch}</span>
                <ArrowRight size={11} aria-hidden />
                <span className="font-mono">{activePr.baseBranch}</span>
              </span>
            ) : undefined
          }
        />
      </div>
      <Divider />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col">
          <PrSectionNav pr={activePr} detail={detail} section={section} onSection={setSection} />
          <Divider />
          <ScrollFade className="min-h-0 flex-1" viewportClassName="px-3 py-3" fadeSize={24}>
            <PrReviewers
              detail={detail}
              workspaceRoot={workspaceRoot}
              onAddReviewers={onAddReviewers}
            />
          </ScrollFade>
        </aside>

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
                        (thread) =>
                          thread.head.source === 'review' && thread.head.resolved === false,
                      )}
                      resolverFor={resolverFor}
                      onSpawnOne={onSpawnOne}
                      onSpawnBatch={onSpawnBatch}
                      onSpawnCombined={onSpawnCombined}
                      onOpenResolver={openResolver}
                      roleModels={roleModels}
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
                      onOpenUrl={(url) => void openUrl(url)}
                    />
                  ) : (
                    <PrChecks
                      checks={detail?.checks ?? []}
                      pr={activePr}
                      onOpenUrl={(url) => void openUrl(url)}
                    />
                  )}
                </SectionBody>
              )}
            </ScrollFade>
          )}
        </div>
      </div>
    </div>
  );
};
