import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type UIEvent,
} from 'react';
import { Button, DrawerFrame, ErrorStrip, SectionHeader, Skeleton, cn } from '@goodboy/ui';
import { MessageSquare } from 'lucide-react';
import { openUrl } from '../../../../shared/lib/editor';
import type {
  PrCheckRun,
  PrComment,
  ResolveAttempt,
  ResolvePublicationDrift,
  ResolveThread,
  Session,
  SessionId,
} from '@goodboy/types';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { replyVoiceOf } from '../../../../store/sessionReplySettings';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { useSessionRepo } from '../../../../store/slices/worktrees/useSessionRepo';
import { useSessionRoleModels } from '../../../../shared/hooks/useSessionRoleModels';
import { EMPTY_RESOLVE_QUEUE_VIEW } from '../../../../store/slices/session-view';
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
import { eligibleReviewThreads } from '../../../suggestions/eligibleThreads';
import type { CommentThread } from '../../../github/comment-threads';
import { useResolveQueueRows } from '../../hooks/useResolveQueueRows';
import { hasActiveResolveRun } from '../../hasActiveResolveRun';
import { heldBackByThreadId } from '../../heldBackByThreadId';
import { resolvableThread } from '../../resolvableThread';
import type { ResolveQueueRow as QueueRow } from '../../buildResolveQueueRows';
import { groupConversationsByFile } from '../../groupConversationsByFile';
import { isConversationOpen } from '../../conversationsWaiting';
import { resolveQueueErrorPlacement } from '../../resolveQueueErrorPlacement';
import { conversationsCounter } from '../../conversationsCounter';
import { useNow } from '../../../../shared/hooks/useNow';
import { RESOLVE_ROW_ACTION_LABEL } from '../../resolveRowState';
import {
  RESOLVE_QUEUE_REFRESH_LABEL,
  RESOLVE_QUEUE_TITLE,
  RESOLVE_RUN_IN_PROGRESS,
  resolveNewLabel,
} from '../../resolveQueueCopy';
import { ResolveWithPopover } from '../ResolveWithPopover';
import { ResolveItemContainer } from '../ResolveItemView/ResolveItemContainer';
import { ResolveSelectionBar } from '../ResolveSelectionBar';
import { ConversationTree } from '../ConversationTree';
import { firstSentence } from '../ConversationTree/firstSentence';
import { ResolveQueueFooter } from './ResolveQueueFooter';
import { threadIdAfterDecision, threadIdAtStep } from './queueTraversal';
import {
  NoResolveTargetState,
  NothingWaitingState,
  ResolveQueueErrorState,
} from './ResolveQueueEmptyState';

export const CONVERSATION_DRAWER_LABEL = 'Conversation';
export const OPEN_CONVERSATIONS_LABEL = 'Open conversations';

type Props = {
  readonly session: Session;
  readonly header?: ReactElement | null;
  readonly dock?: ReactNode;
};

type QueuePaneParams = {
  readonly children: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
};

const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];
const EMPTY_DRIFT: ReadonlyArray<ResolvePublicationDrift> = [];
const EMPTY_THREADS: ReadonlyArray<ResolveThread> = [];
const EMPTY_SELECTION: ReadonlySet<string> = new Set();

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

export const ResolveQueueHome = ({ session, header = null, dock = null }: Props) => {
  const sessionId = session.id as SessionId;
  const listRef = useRef<HTMLDivElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const reportError = useAppStore((s) => s.reportError);
  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const now = useNow(5_000);
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
  const replyVoice = useAppStore(useShallow((s) => replyVoiceOf({ state: s, sessionId })));
  const openResolvePublication = useAppStore((s) => s.openResolvePublication);
  const resolveThreads = useAppStore((s) => s.sessionResolveThreads[sessionId] ?? EMPTY_THREADS);

  const rows = useResolveQueueRows({ sessionId });
  const repo = useSessionRepo({ sessionId });
  const roleModels = useSessionRoleModels({ sessionId });
  const [checkedThreadIds, setCheckedThreadIds] = useState<ReadonlySet<string>>(EMPTY_SELECTION);

  const newThreads = useMemo(
    () => eligibleReviewThreads({ github, rows: resolveThreads }),
    [github, resolveThreads],
  );
  const resolvableByThreadId = useMemo(
    () =>
      new Map(
        rows.flatMap((row): ReadonlyArray<readonly [string, CommentThread]> => {
          const thread = resolvableThread({ row });
          return thread === null ? [] : [[row.thread.threadId, thread]];
        }),
      ),
    [rows],
  );
  const checkedThreads = useMemo(
    () =>
      [...checkedThreadIds].flatMap((threadId) => {
        const thread = resolvableByThreadId.get(threadId);
        return thread === undefined ? [] : [thread];
      }),
    [checkedThreadIds, resolvableByThreadId],
  );
  const onToggleChecked = useCallback(
    ({ threadId, isChecked }: { readonly threadId: string; readonly isChecked: boolean }): void => {
      setCheckedThreadIds((current) => {
        if (isChecked) {
          return new Set([...current, threadId]);
        }
        return new Set([...current].filter((candidate) => candidate !== threadId));
      });
    },
    [],
  );
  const clearChecked = useCallback((): void => setCheckedThreadIds(EMPTY_SELECTION), []);

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

  const openRows = useMemo(() => rows.filter((row) => isConversationOpen({ row })), [rows]);
  const laterRows = useMemo(() => rows.filter((row) => row.status === 'later'), [rows]);
  const resolvedRows = useMemo(() => rows.filter((row) => row.status === 'resolved'), [rows]);
  const listed = useMemo(
    () => groupConversationsByFile({ rows: openRows }).flatMap((group) => group.rows),
    [openRows],
  );
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
          ...(target?.status === 'resolved' && {
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
          style: replyVoice,
          spawnAgent,
          setAgentConfig,
        });
        return true;
      } catch (error) {
        void reportError({ title: "Couldn't retry the fix", error, sessionId });
        return false;
      }
    },
    [
      github,
      replyVoice,
      reportError,
      roleModels,
      rows,
      sessionId,
      setAgentConfig,
      spawnAgent,
      threadsByThreadId,
    ],
  );

  const onResume = useCallback(
    ({ itemId }: { readonly itemId: string }): void => {
      void takeUpResolveQueueItem({ sessionId, itemId }).catch((error: unknown) =>
        reportError({ title: "Couldn't resume the queued fix", error, sessionId }),
      );
    },
    [reportError, sessionId, takeUpResolveQueueItem],
  );

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

  const openRow = useCallback(
    (row: QueueRow): void => {
      pendingPanelThreadIdRef.current = row.thread.threadId;
      onSelect(row.thread.threadId);
    },
    [onSelect],
  );

  const queuePane = ({ children, meta, actions }: QueuePaneParams): ReactElement => {
    if (header === null) {
      return (
        <PaneShell
          title={RESOLVE_QUEUE_TITLE}
          scroll="body"
          dock={dock}
          {...(meta != null && { meta })}
          {...(actions != null && { actions })}
        >
          {children}
        </PaneShell>
      );
    }
    return (
      <PaneShell header={header} scroll="body" dock={dock}>
        <SectionHeader
          size="page"
          label={RESOLVE_QUEUE_TITLE}
          meta={
            meta != null ? (
              <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{meta}</span>
            ) : undefined
          }
          action={actions ?? undefined}
        />
        {children}
      </PaneShell>
    );
  };

  if (github?.pr == null) {
    return queuePane({
      children: <NoResolveTargetState onOpenReview={() => void openReview({ sessionId })} />,
    });
  }

  const refreshError = github.detailError ?? null;
  const errorPlacement = resolveQueueErrorPlacement({
    error: refreshError,
    hasLoadedComments: github.detail !== null,
  });

  if (errorPlacement === 'whole_surface' && refreshError !== null) {
    return queuePane({
      children: (
        <ResolveQueueErrorState
          message={refreshError}
          onRetry={() => void refreshSessionPrDetail(sessionId, { force: true })}
        />
      ),
    });
  }

  const isLoading = github.detail === null && github.detailLoading;
  const isRunLive = hasActiveResolveRun({ attempts });
  const counter = conversationsCounter({
    comments: github.detail?.comments ?? null,
    fetchedAt: github.detailFetchedAt ?? null,
    error: refreshError,
    now,
  });
  const isReadTrusted = github.detail !== null && refreshError === null;

  const renderAction = (row: QueueRow): ReactNode => {
    const action = row.rowState.action;
    if (action === null) {
      return null;
    }
    const resolvable = resolvableByThreadId.get(row.thread.threadId);
    if (action === 'resolve') {
      return resolvable === undefined ? null : (
        <ResolveWithPopover
          sessionId={sessionId}
          threads={[resolvable]}
          label={RESOLVE_ROW_ACTION_LABEL.resolve}
          isDisabled={isRunLive}
          disabledReason={RESOLVE_RUN_IN_PROGRESS}
        />
      );
    }
    const onPress = (): void => {
      if (action === 'resume') {
        onResume({ itemId: row.item.id });
        return;
      }
      const url = row.commentThread?.head.url ?? null;
      if (action === 'open_github' && url !== null) {
        void openUrl(url);
        return;
      }
      openRow(row);
    };
    return (
      <Button size="sm" variant="ghost" onClick={onPress}>
        {RESOLVE_ROW_ACTION_LABEL[action]}
      </Button>
    );
  };

  const renderTree = ({
    rows: treeRows,
    label,
  }: {
    readonly rows: ReadonlyArray<QueueRow>;
    readonly label: string;
  }): ReactNode => (
    <ConversationTree
      rows={treeRows}
      label={label}
      now={now}
      selectedThreadId={view.expandedThreadId}
      checkedThreadIds={checkedThreadIds}
      heldBack={heldBack}
      isCheckable={(row) => row.status !== 'resolved' && row.status !== 'working'}
      onToggleChecked={onToggleChecked}
      onOpen={openRow}
      onOpenCommit={({ row, sha }) =>
        onOpenInDiff({
          threadId: row.thread.threadId,
          sha,
          path: row.reviewerNote?.path ?? null,
          line: row.reviewerNote?.line ?? null,
        })
      }
      renderAction={renderAction}
    />
  );

  return (
    <div
      className={cn(
        'isolate grid h-full min-h-0 min-w-0 overflow-hidden',
        selectedRow === null
          ? 'grid-cols-[minmax(0,1fr)]'
          : 'grid-cols-[minmax(0,1fr)_clamp(340px,33vw,560px)]',
      )}
    >
      <div className="col-start-1 row-start-1 min-h-0 min-w-0">
        {queuePane({
          meta: counter,
          actions:
            newThreads.length === 0 ? null : (
              <ResolveWithPopover
                sessionId={sessionId}
                threads={newThreads}
                label={resolveNewLabel({ count: newThreads.length })}
                isDisabled={isRunLive}
                disabledReason={RESOLVE_RUN_IN_PROGRESS}
              />
            ),
          children: (
            <div className="flex min-w-0 flex-col gap-4" ref={listRef} onKeyDown={onListKeyDown}>
              {checkedThreadIds.size > 0 && (
                <ResolveSelectionBar
                  sessionId={sessionId}
                  rows={rows}
                  checkedThreadIds={checkedThreadIds}
                  threads={checkedThreads}
                  isRunLive={isRunLive}
                  onClear={clearChecked}
                />
              )}
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
              {!isLoading && isReadTrusted && listed.length === 0 && <NothingWaitingState />}
              {!isLoading &&
                listed.length > 0 &&
                renderTree({ rows: openRows, label: OPEN_CONVERSATIONS_LABEL })}
              <ResolveQueueFooter
                resolved={resolvedRows}
                later={laterRows}
                renderRows={renderTree}
                isDeferredShown={view.isDeferredShown}
                isResolvedShown={view.isCompletedShown}
                onDeferredShownChange={(isDeferredShown) =>
                  setResolveQueueView({ sessionId, patch: { isDeferredShown } })
                }
                onResolvedShownChange={(isCompletedShown) =>
                  setResolveQueueView({ sessionId, patch: { isCompletedShown } })
                }
              />
            </div>
          ),
        })}
      </div>
      {selectedRow !== null && (
        <aside
          aria-label={CONVERSATION_DRAWER_LABEL}
          className="col-start-2 row-start-1 flex min-h-0 min-w-0 flex-col border-l border-border bg-background"
        >
          <DrawerFrame
            title={
              selectedRow.reviewerNote === null
                ? CONVERSATION_DRAWER_LABEL
                : firstSentence({ text: selectedRow.reviewerNote.body })
            }
            icon={MessageSquare}
            iconClassName="text-faint-foreground"
            closeLabel={`Close ${CONVERSATION_DRAWER_LABEL.toLowerCase()}`}
            onClose={closeDetail}
            scroll="self"
          >
            <section
              ref={detailRef}
              aria-label="Resolve comment detail"
              onScrollCapture={onDetailScroll}
              className="flex h-full min-h-0 min-w-0 flex-col"
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
          </DrawerFrame>
        </aside>
      )}
    </div>
  );
};
