import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
} from 'react';
import { Button, ErrorStrip, SectionHeader, Skeleton, Tooltip, formatError } from '@goodboy/ui';
import type {
  PrCheckRun,
  PrComment,
  ResolveAttempt,
  ResolvePublicationDrift,
  Session,
  SessionId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { useToast } from '../../../../app/components/Toast';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { EMPTY_RESOLVE_QUEUE_VIEW } from '../../../../store/slices/session-view';
import { StudioDetailLayout } from '../../../../shared/components/StudioDetail';
import { groupThreads } from '../../../github/comment-threads';
import { kindRouting } from '../../../session/agent-kind';
import { startFixAttempt } from '../../../review/startFixAttempt';
import { openReview } from '../../../review/openReview';
import {
  REVIEW_TARGET_REASON_COPY,
  reviewTargetErrorLabel,
  reviewTargetPending,
} from '../../../review/reviewTargetCopy';
import { reviewThreadId } from '../../../../store/slices/review-navigation';
import { DEFAULT_AGENT_SPAWN_CONFIG } from '../../../session/components/AgentSpawnConfig/defaultAgentSpawnConfig';
import type { AgentSpawnConfigValue } from '../../../session/components/AgentSpawnConfig/AgentSpawnConfigValue';
import { useResolveQueueRows } from '../../hooks/useResolveQueueRows';
import { hasActiveResolveRun } from '../../hasActiveResolveRun';
import { heldBackByThreadId } from '../../heldBackByThreadId';
import { startResolveRun } from '../../startResolveRun';
import type { ResolveQueueRow as QueueRow } from '../../buildResolveQueueRows';
import { groupResolveQueue, groupSharedRuns, rowsForResolveFilter } from '../../groupResolveQueue';
import { orderResolveQueueRows } from '../../orderResolveQueueRows';
import { resolveQueueErrorPlacement } from '../../resolveQueueErrorPlacement';
import {
  RESOLVE_QUEUE_ACTION_LABEL,
  RESOLVE_QUEUE_REFRESH_LABEL,
  RESOLVE_QUEUE_TITLE,
  RESOLVE_RUN_IN_PROGRESS,
  sharedRunHeading,
} from '../../resolveQueueCopy';
import { ResolveSpawnSheet } from '../ResolveSpawnSheet';
import { ResolveItemContainer } from '../ResolveItemView/ResolveItemContainer';
import { QueueFilterChips } from './QueueFilterChips';
import { ResolveQueueRow } from './ResolveQueueRow';
import { ResolveQueueFooter } from './ResolveQueueFooter';
import { threadIdAfterDecision, threadIdAtStep } from './queueTraversal';
import {
  NoResolveTargetState,
  NothingToRetryState,
  NothingWaitingState,
  ResolveQueueErrorState,
} from './ResolveQueueEmptyState';

type Props = {
  readonly session: Session;
  readonly header?: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly dock?: ReactNode;
};

const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];
const EMPTY_DRIFT: ReadonlyArray<ResolvePublicationDrift> = [];

type AskForChangesParams = {
  readonly threadId: string;
  readonly instruction: string;
};

type FocusRowParams = {
  readonly threadId: string;
};
const EMPTY_CHECKS: ReadonlyArray<PrCheckRun> = [];
const SKELETON_ROWS = [0, 1, 2];

type TextEntryParams = Readonly<{
  target: EventTarget | null;
}>;

const isTextEntry = ({ target }: TextEntryParams): boolean => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea';
};

const scrollableAncestor = (node: HTMLElement | null): HTMLElement | null => {
  let current = node?.parentElement ?? null;
  while (current !== null) {
    if (current.scrollHeight > current.clientHeight) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

export const ResolveQueueHome = ({ session, header = null, eyebrow, dock = null }: Props) => {
  const sessionId = session.id as SessionId;
  const listRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const { showToast } = useToast();
  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const comments = useAppStore(
    (s) =>
      s.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const checks = useAppStore((s) => s.sessionGithub[sessionId]?.detail?.checks ?? EMPTY_CHECKS);
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  const view = useAppStore((s) => s.resolveQueueView[sessionId] ?? EMPTY_RESOLVE_QUEUE_VIEW);
  const publicationPreview = useAppStore((s) => s.activePublicationPreview[sessionId] ?? null);
  const loadResolveSession = useAppStore((s) => s.loadResolveSession);
  const takeUpResolveQueueItem = useAppStore((s) => s.takeUpResolveQueueItem);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const setResolveQueueView = useAppStore((s) => s.setResolveQueueView);
  const reviewTarget = useAppStore((s) => s.reviewTargets[sessionId] ?? null);
  const consumeReviewTarget = useAppStore((s) => s.consumeReviewTarget);
  const openResolveDiff = useAppStore((s) => s.openResolveDiff);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const setAgentConfig = useAppStore((s) => s.setAgentConfig);
  const openResolvePublication = useAppStore((s) => s.openResolvePublication);

  const rows = useResolveQueueRows({ sessionId });
  const repo = useSessionRepo({ sessionId });
  const roleModels = useSessionRoleModels({ sessionId });
  const [spawnConfig, setSpawnConfig] = useState<AgentSpawnConfigValue>(DEFAULT_AGENT_SPAWN_CONFIG);
  const [isSpawning, setIsSpawning] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

  const groups = useMemo(() => groupResolveQueue({ rows }), [rows]);
  const listed = useMemo(() => {
    const ordered = orderResolveQueueRows({
      rows: rowsForResolveFilter({ groups, filter: view.filter }),
      pinned: view.order,
    });
    return [
      ...ordered.filter((row) => row.status === 'agent_asked'),
      ...ordered.filter((row) => row.status !== 'agent_asked'),
    ];
  }, [groups, view.filter, view.order]);
  const listGroups = useMemo(() => groupSharedRuns({ rows: listed }), [listed]);
  const heldBack = useMemo(
    () => heldBackByThreadId({ drift: publicationPreview?.drift ?? EMPTY_DRIFT }),
    [publicationPreview],
  );
  const selectedRow = useMemo(
    () => rows.find((row) => row.thread.threadId === view.expandedThreadId) ?? null,
    [rows, view.expandedThreadId],
  );

  useEffect(() => {
    const node = scrollableAncestor(listRef.current);
    if (node === null || view.scrollTop === 0) {
      return;
    }
    node.scrollTop = view.scrollTop;
  }, [view.scrollTop]);

  const threadsByThreadId = useMemo(
    () =>
      new Map(
        groupThreads(comments.filter((comment) => comment.source === 'review')).flatMap((thread) =>
          thread.head.threadId == null ? [] : [[thread.head.threadId, thread] as const],
        ),
      ),
    [comments],
  );

  const onSelect = useCallback(
    (threadId: string | null): void => {
      if (reviewTarget !== null) {
        consumeReviewTarget({ sessionId, requestId: reviewTarget.requestId });
      }
      const target = rows.find((row) => row.thread.threadId === threadId) ?? null;
      setResolveQueueView({
        sessionId,
        patch: {
          expandedThreadId: threadId,
          order: listed.map((row) => row.thread.threadId),
          ...(target?.status === 'later' && { isDeferredShown: true }),
          ...((target?.status === 'pushed' || target?.status === 'wont_fix_sent') && {
            isCompletedShown: true,
          }),
        },
      });
    },
    [consumeReviewTarget, listed, reviewTarget, rows, sessionId, setResolveQueueView],
  );

  const targetThreadId =
    reviewTarget === null ? null : reviewThreadId({ destination: reviewTarget.destination });
  const selectedThreadId = view.expandedThreadId;

  useEffect(() => {
    if (reviewTarget === null) {
      return;
    }
    if (reviewTarget.status === 'unavailable' || reviewTarget.status === 'failed') {
      if (selectedThreadId !== null) {
        setResolveQueueView({ sessionId, patch: { expandedThreadId: null } });
      }
      return;
    }
    if (targetThreadId === null || reviewTarget.status !== 'ready') {
      return;
    }
    if (!rows.some((row) => row.thread.threadId === targetThreadId)) {
      return;
    }
    onSelect(targetThreadId);
    consumeReviewTarget({ sessionId, requestId: reviewTarget.requestId });
  }, [
    consumeReviewTarget,
    reviewTarget,
    rows,
    selectedThreadId,
    sessionId,
    onSelect,
    targetThreadId,
  ]);

  const targetError =
    reviewTarget === null
      ? null
      : reviewTarget.status === 'unavailable' && reviewTarget.reason !== null
        ? REVIEW_TARGET_REASON_COPY[reviewTarget.reason]
        : reviewTarget.status === 'failed'
          ? reviewTarget.error
          : null;

  const onRetryTarget = useCallback((): void => {
    if (reviewTarget === null) {
      return;
    }
    void openReview({
      sessionId,
      destination: reviewTarget.destination,
      ...(reviewTarget.mode !== null && { mode: reviewTarget.mode }),
    });
  }, [reviewTarget, sessionId]);

  const onOpenInDiff = useCallback(
    ({
      threadId,
      sha,
      path,
      line,
    }: {
      readonly threadId: string;
      readonly sha: string;
      readonly path: string | null;
      readonly line: number | null;
    }): void => {
      openResolveDiff({
        sessionId,
        threadId,
        sha,
        path,
        line,
        order: listed.map((row) => row.thread.threadId),
        scrollTop: scrollableAncestor(listRef.current)?.scrollTop ?? 0,
      });
    },
    [listed, openResolveDiff, sessionId],
  );

  const onAskForChanges = useCallback(
    async ({ threadId, instruction }: AskForChangesParams): Promise<boolean> => {
      const pr = github?.pr ?? null;
      const thread = threadsByThreadId.get(threadId);
      if (pr === null || thread === undefined) {
        return false;
      }
      const routing = kindRouting({ kind: 'resolver', roleModels });
      const row = rows.find((candidate) => candidate.thread.threadId === threadId) ?? null;
      try {
        await startFixAttempt({
          sessionId,
          threads: [thread],
          pr,
          choice: {
            provider: routing.provider,
            model: routing.model,
            ...(routing.effort !== undefined &&
              routing.effort !== null && { effort: routing.effort }),
          },
          instructions: instruction,
          mode: 'retry',
          priorContext: [
            {
              threadId,
              reply: row?.thread.replyDraft ?? null,
              ...(row?.thread.commitShas != null && { commitShas: row.thread.commitShas }),
              intent: 'retry',
            },
          ],
          spawnAgent,
          setAgentConfig,
        });
        return true;
      } catch (error) {
        showToast('error', formatError(error));
        return false;
      }
    },
    [github, roleModels, rows, sessionId, setAgentConfig, showToast, spawnAgent, threadsByThreadId],
  );

  const onResume = useCallback(
    ({ itemId }: { readonly itemId: string }): void => {
      void takeUpResolveQueueItem({ sessionId, itemId }).catch((error: unknown) =>
        showToast('error', formatError(error)),
      );
    },
    [sessionId, showToast, takeUpResolveQueueItem],
  );

  const onStartResolveRun = async (): Promise<void> => {
    const pr = github?.pr;
    if (pr == null) {
      return;
    }
    setIsSpawning(true);
    try {
      await startResolveRun({ sessionId, pr, spawnConfig, spawnAgent, setAgentConfig });
      setIsConfiguring(false);
    } finally {
      setIsSpawning(false);
    }
  };

  const focusRow = useCallback(({ threadId }: FocusRowParams): void => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-thread-id="${CSS.escape(threadId)}"]`)
      ?.focus();
  }, []);

  const pendingPanelThreadIdRef = useRef<string | null>(null);

  const focusPanel = useCallback((): void => {
    const panel = detailRef.current;
    if (panel === null) {
      return;
    }
    const primary = panel.querySelector<HTMLElement>('[data-resolve-primary]:not([disabled])');
    const control =
      primary ??
      panel.querySelector<HTMLElement>(
        'button:not([disabled]), textarea, [href], input:not([disabled])',
      );
    control?.focus();
  }, []);

  const onListKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>): void => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      const target = event.target instanceof HTMLElement ? event.target : null;
      const rowThreadId = target?.dataset.threadId ?? null;
      if (rowThreadId === null) {
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const threadId = threadIdAtStep({
          rows: listed,
          selectedThreadId: rowThreadId,
          delta: event.key === 'ArrowDown' ? 1 : -1,
        });
        if (threadId === null) {
          return;
        }
        event.preventDefault();
        focusRow({ threadId });
        return;
      }
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      if (rowThreadId === view.expandedThreadId) {
        focusPanel();
        return;
      }
      pendingPanelThreadIdRef.current = rowThreadId;
      onSelect(rowThreadId);
    },
    [focusPanel, focusRow, listed, onSelect, view.expandedThreadId],
  );

  useEffect(() => {
    const pending = pendingPanelThreadIdRef.current;
    if (pending === null || selectedRow === null || selectedRow.thread.threadId !== pending) {
      return;
    }
    pendingPanelThreadIdRef.current = null;
    focusPanel();
  }, [focusPanel, selectedRow]);

  useEffect(() => {
    if (selectedRow === null || view.detailScrollTop === 0) {
      return;
    }
    const viewport =
      detailRef.current?.querySelector<HTMLElement>('[class*="overflow-y-auto"]') ?? null;
    if (viewport !== null) {
      viewport.scrollTop = view.detailScrollTop;
    }
  }, [selectedRow, view.detailScrollTop]);

  const onDetailScroll = useCallback(
    (event: UIEvent<HTMLElement>): void => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }
      setResolveQueueView({ sessionId, patch: { detailScrollTop: event.target.scrollTop } });
    },
    [sessionId, setResolveQueueView],
  );

  const onAdvanceFromPanel = useCallback(
    (threadId: string | null, excludedThreadIds: ReadonlyArray<string> = []): void => {
      const panel = detailRef.current;
      const focused = document.activeElement;
      if (threadId !== null && panel !== null && focused !== null && panel.contains(focused)) {
        pendingPanelThreadIdRef.current = threadId;
      }
      const next =
        threadId === null
          ? threadIdAfterDecision({
              rows: listed,
              selectedThreadId: view.expandedThreadId,
              excludedThreadIds,
              eligibleThreadIds: rows.map((row) => row.thread.threadId),
            })
          : threadId;
      if (next !== null && panel !== null && focused !== null && panel.contains(focused)) {
        pendingPanelThreadIdRef.current = next;
      }
      onSelect(next);
    },
    [listed, onSelect, rows, view.expandedThreadId],
  );

  const closeDetail = useCallback((): void => {
    const threadId = view.expandedThreadId;
    if (threadId === null) {
      return;
    }
    onSelect(null);
    requestAnimationFrame(() => focusRow({ threadId }));
  }, [focusRow, onSelect, view.expandedThreadId]);

  useEffect(() => {
    if (view.expandedThreadId === null) {
      return;
    }
    const onKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) {
        return;
      }
      if (isTextEntry({ target: event.target })) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      closeDetail();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeDetail, view.expandedThreadId]);

  const renderRow = useCallback(
    ({ row }: { readonly row: QueueRow }): ReactNode => (
      <ResolveQueueRow
        key={row.thread.threadId}
        row={row}
        isSelected={row.thread.threadId === view.expandedThreadId}
        heldBack={heldBack.get(row.thread.threadId) ?? null}
        onOpen={() => {
          pendingPanelThreadIdRef.current = row.thread.threadId;
          onSelect(row.thread.threadId);
        }}
        onResume={() => onResume({ itemId: row.item.id })}
        onOpenCommit={({ sha }) =>
          onOpenInDiff({
            threadId: row.thread.threadId,
            sha,
            path: row.reviewerNote?.path ?? null,
            line: row.reviewerNote?.line ?? null,
          })
        }
      />
    ),
    [heldBack, onOpenInDiff, onResume, onSelect, view.expandedThreadId],
  );

  if (github?.pr == null) {
    return (
      <PaneShell title={RESOLVE_QUEUE_TITLE}>
        <NoResolveTargetState onOpenReview={() => void openReview({ sessionId })} />
      </PaneShell>
    );
  }

  const refreshError = github.detailError ?? null;
  const errorPlacement = resolveQueueErrorPlacement({
    error: refreshError,
    hasLoadedComments: github.detail !== null,
  });

  if (errorPlacement === 'whole_surface' && refreshError !== null) {
    return (
      <PaneShell title={RESOLVE_QUEUE_TITLE}>
        <ResolveQueueErrorState
          message={refreshError}
          onRetry={() => void refreshSessionPrDetail(sessionId, { force: true })}
        />
      </PaneShell>
    );
  }

  const isLoading = github.detail === null && github.detailLoading;
  const isRunLive = hasActiveResolveRun({ attempts });

  return (
    <div className="isolate grid h-full min-h-0 min-w-0 overflow-hidden">
      <div
        className="col-start-1 row-start-1 min-h-0 min-w-0"
        aria-hidden={selectedRow !== null}
        {...(selectedRow !== null && { inert: true })}
      >
        <StudioDetailLayout header={header} eyebrow={eyebrow} dock={dock} fit="bleed">
          <PaneShell
            title={RESOLVE_QUEUE_TITLE}
            scroll="body"
            actions={
              isConfiguring ? null : (
                <Tooltip
                  content={
                    isRunLive ? RESOLVE_RUN_IN_PROGRESS : RESOLVE_QUEUE_ACTION_LABEL.startRun
                  }
                >
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isRunLive}
                    onClick={() => setIsConfiguring(true)}
                  >
                    {RESOLVE_QUEUE_ACTION_LABEL.startRun}
                  </Button>
                </Tooltip>
              )
            }
          >
            {isConfiguring ? (
              <ResolveSpawnSheet
                value={spawnConfig}
                onChange={setSpawnConfig}
                disabled={false}
                isBusy={isSpawning}
                onStart={() => void onStartResolveRun()}
                onCancel={() => setIsConfiguring(false)}
              />
            ) : (
              <div className="flex min-w-0 flex-col gap-4" ref={listRef} onKeyDown={onListKeyDown}>
                {errorPlacement === 'inline' && refreshError !== null && (
                  <ErrorStrip
                    label={RESOLVE_QUEUE_REFRESH_LABEL}
                    error={new Error(refreshError)}
                    onRetry={() => void refreshSessionPrDetail(sessionId, { force: true })}
                  />
                )}
                {reviewTarget?.status === 'pending' && (
                  <p role="status" className="text-2xs text-muted-foreground">
                    {reviewTargetPending({ hasThread: targetThreadId !== null })}
                  </p>
                )}
                {targetError !== null && (
                  <ErrorStrip
                    label={reviewTargetErrorLabel({ hasThread: targetThreadId !== null })}
                    error={new Error(targetError)}
                    onRetry={onRetryTarget}
                  />
                )}
                <QueueFilterChips
                  filter={view.filter}
                  needsReviewCount={groups.needsReview.length + groups.approved.length}
                  activeCount={groups.active.length}
                  retryableCount={groups.retryable.length}
                  onChange={(filter) => setResolveQueueView({ sessionId, patch: { filter } })}
                />
                {isLoading && (
                  <div className="flex flex-col gap-4">
                    {SKELETON_ROWS.map((key) => (
                      <div key={key} className="flex flex-col gap-2 px-3 py-2">
                        <Skeleton className="h-5 w-full" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3.5 w-48" />
                      </div>
                    ))}
                  </div>
                )}
                {!isLoading && listed.length === 0 && view.filter === 'retryable' && (
                  <NothingToRetryState />
                )}
                {!isLoading && listed.length === 0 && view.filter !== 'retryable' && (
                  <NothingWaitingState hasOtherActiveWork={groups.active.length > 0} />
                )}
                {!isLoading && listed.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {listGroups.map((group) => (
                      <div key={group.key} className="flex min-w-0 flex-col gap-2">
                        {group.attemptId !== null && (
                          <SectionHeader
                            label={sharedRunHeading({ count: group.rows.length })}
                            headingLevel={3}
                          />
                        )}
                        <ol className="flex flex-col gap-2">
                          {group.rows.map((row) => renderRow({ row }))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
                <ResolveQueueFooter
                  completed={groups.completed}
                  later={groups.later}
                  renderRow={renderRow}
                  isDeferredShown={view.isDeferredShown}
                  isCompletedShown={view.isCompletedShown}
                  onDeferredShownChange={(isDeferredShown) =>
                    setResolveQueueView({ sessionId, patch: { isDeferredShown } })
                  }
                  onCompletedShownChange={(isCompletedShown) =>
                    setResolveQueueView({ sessionId, patch: { isCompletedShown } })
                  }
                />
              </div>
            )}
          </PaneShell>
        </StudioDetailLayout>
      </div>
      {selectedRow !== null && (
        <div className="pointer-events-none col-start-1 row-start-1 z-10 min-h-0 min-w-0 bg-background">
          <section
            ref={detailRef}
            aria-label="Resolve comment detail"
            onScrollCapture={onDetailScroll}
            className="pointer-events-auto flex h-full min-h-0 min-w-0 flex-col"
          >
            <ResolveItemContainer
              key={selectedRow.thread.threadId}
              sessionId={sessionId}
              prNumber={github.pr.number}
              row={selectedRow}
              allRows={rows}
              worktreePath={repo?.worktreePath ?? null}
              onSelect={onAdvanceFromPanel}
              onRequestAttempt={onAskForChanges}
              onOpenInDiff={onOpenInDiff}
              onBack={closeDetail}
              onPrevious={() => {
                const threadId = threadIdAtStep({
                  rows: listed,
                  selectedThreadId: selectedRow.thread.threadId,
                  delta: -1,
                });
                if (threadId !== null) {
                  pendingPanelThreadIdRef.current = threadId;
                  onSelect(threadId);
                }
              }}
              onNext={() => {
                const threadId = threadIdAtStep({
                  rows: listed,
                  selectedThreadId: selectedRow.thread.threadId,
                  delta: 1,
                });
                if (threadId !== null) {
                  pendingPanelThreadIdRef.current = threadId;
                  onSelect(threadId);
                }
              }}
              canPrevious={
                threadIdAtStep({
                  rows: listed,
                  selectedThreadId: selectedRow.thread.threadId,
                  delta: -1,
                }) !== null
              }
              canNext={
                threadIdAtStep({
                  rows: listed,
                  selectedThreadId: selectedRow.thread.threadId,
                  delta: 1,
                }) !== null
              }
              onReviewPublication={({ threadId, reconcile }) =>
                openResolvePublication({ sessionId, threadId, reconcile })
              }
            />
          </section>
        </div>
      )}
    </div>
  );
};
