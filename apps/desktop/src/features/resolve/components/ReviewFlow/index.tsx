import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import {
  Button,
  EmptyState,
  ErrorStrip,
  Notice,
  PageColumn,
  ScrollFade,
  Skeleton,
  cn,
  formatError,
} from '@goodboy/ui';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { branchLayoutOf } from '../../../branch/branchLayout';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { isTypingTarget } from '../../../../shared/keyboard/isTypingTarget';
import { SHORTCUTS, shortcutGlyphs, type ShortcutId } from '../../../../shared/keyboard/registry';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { reviewFocusThreadId } from '../../../../store/slices/review-navigation';
import { bindTarget, runObjectAction } from '../../../actions/registry';
import { useActionEnv } from '../../../actions/useActionEnv';
import { ThreadHunk } from '../../../branch/components/ThreadHunk';
import { ThreadProperties } from '../../../branch/components/ThreadProperties';
import { openReview } from '../../../review/openReview';
import {
  REVIEW_TARGET_REASON_COPY,
  reviewTargetErrorLabel,
  reviewTargetPending,
} from '../../../review/reviewTargetCopy';
import { fixRunOf, type FixRunWord } from '../../fixRun';
import { useActiveReviewSource } from '../../hooks/useActiveReviewSource';
import { useLaneStatus } from '../../hooks/useLaneStatus';
import { useReviewCommentController } from '../../hooks/useReviewCommentController';
import { isUndoableAccept } from '../../bulkAccept';
import { REVIEW_BULK_LABEL, bulkAcceptFailureLine } from '../../reviewBulkCopy';
import { resolveQueueRefreshLabel } from '../../resolveQueueCopy';
import { REVIEW_FLOW_LABEL } from '../../reviewFlowCopy';
import { isPushFailure } from '../../reviewCommentState';
import { bulkRunOf } from './bulkRun';
import { AnswersPanel } from './AnswersPanel';
import { BulkUndoBar } from './BulkUndoBar';
import { FixOpenLine } from './FixOpenLine';
import { RunStatusBulkActions } from './RunStatusBulkActions';
import { useBulkQuestions } from './useBulkQuestions';
import { ReviewEmptyState } from './ReviewEmptyState';
import { ResolveRunStatus } from './ResolveRunStatus';
import { ReviewComment } from './ReviewComment';
import { LaunchPanel } from './LaunchPanel';
import { ReviewList } from './ReviewList';
import { ReviewSelectionBar } from './ReviewSelectionBar';
import type { ReviewPush } from './useReviewPush';
import { useReviewEntries } from './useReviewEntries';

type Props = {
  readonly session: Session;
  readonly push: ReviewPush;
};

const COMMENT_KEYS: ReadonlyArray<readonly [ShortcutId, ReadonlyArray<string>]> = [
  [
    'review.accept',
    ['reviewComment.accept', 'reviewComment.resolveOnly', 'reviewComment.closeWithReply'],
  ],
  ['review.edit', ['reviewComment.answer', 'reviewComment.edit']],
  ['review.reply', ['reviewComment.reply', 'reviewComment.replyAndResolve']],
  ['review.skip', ['reviewComment.skip']],
  ['review.undo', ['reviewComment.undo']],
  ['review.fix', ['reviewComment.draft', 'reviewComment.fixAnyway', 'reviewComment.fixAgain']],
];

type ReviewLaunch = {
  readonly threadIds: ReadonlyArray<string>;
  readonly isDirect: boolean;
};

const EMPTY_IDS: ReadonlyArray<string> = [];

const sameIds = ({
  left,
  right,
}: {
  readonly left: ReadonlyArray<string>;
  readonly right: ReadonlyArray<string>;
}): boolean => left.length === right.length && left.every((id, index) => id === right[index]);

const SKELETON_ROWS = [0, 1, 2];
const DOCK_BOTTOM_OFFSET = 24;

export const ReviewFlow = ({ session, push }: Props) => {
  const sessionId = session.id as SessionId;
  const env = useActionEnv({ origin: 'button' });
  const { entries, groups: allGroups } = useReviewEntries({ sessionId });
  const forceCloseResolver = useAppStore((s) => s.forceCloseResolver);
  const stopResolveLane = useAppStore((s) => s.stopResolveLane);
  const [filter, setFilter] = useState<FixRunWord | null>(null);
  const [isDoneOpen, setIsDoneOpen] = useState(false);
  const run = useMemo(
    () =>
      fixRunOf({
        sources: entries.map((entry) => ({
          threadId: entry.threadId,
          state: entry.state,
          attempt: entry.row.attempt,
        })),
      }),
    [entries],
  );
  const lane = useLaneStatus({ sessionId, entries });
  const activeFilter = run !== null && filter !== null && run.tally[filter] > 0 ? filter : null;
  const groups = useMemo(
    () =>
      activeFilter === null ? allGroups : allGroups.filter((group) => group.word === activeFilter),
    [activeFilter, allGroups],
  );
  const isDoneShown = isDoneOpen || allGroups.length === 1;
  const shownEntries = useMemo(
    () => groups.flatMap((group) => (group.word === 'done' && !isDoneShown ? [] : group.entries)),
    [groups, isDoneShown],
  );
  const storedSelection = useAppStore((s) => s.reviewSelection[sessionId]);
  const setReviewSelection = useAppStore((s) => s.setReviewSelection);
  const toggleReviewSelection = useAppStore((s) => s.toggleReviewSelection);
  const clearReviewSelection = useAppStore((s) => s.clearReviewSelection);
  const fixableIds = useMemo(
    () => new Set(entries.filter((entry) => entry.isFixable).map((entry) => entry.threadId)),
    [entries],
  );
  const acceptableIds = useMemo(
    () => new Set(entries.filter((entry) => entry.isAcceptable).map((entry) => entry.threadId)),
    [entries],
  );
  const presentIds = useMemo(() => new Set(entries.map((entry) => entry.threadId)), [entries]);
  const selectedIds = useMemo(
    () => (storedSelection ?? []).filter((threadId) => presentIds.has(threadId)),
    [presentIds, storedSelection],
  );
  const fixSelectedIds = useMemo(
    () => selectedIds.filter((threadId) => fixableIds.has(threadId)),
    [fixableIds, selectedIds],
  );
  const acceptSelectedIds = useMemo(
    () => selectedIds.filter((threadId) => acceptableIds.has(threadId)),
    [acceptableIds, selectedIds],
  );
  const checked = useMemo(() => new Set(selectedIds), [selectedIds]);
  const shownFixableIds = useMemo(
    () =>
      shownEntries.filter((entry) => fixableIds.has(entry.threadId)).map((entry) => entry.threadId),
    [fixableIds, shownEntries],
  );
  const selectAllFixable = () => setReviewSelection({ sessionId, threadIds: shownFixableIds });
  const { source } = useActiveReviewSource({ sessionId });
  const addressThreadId = useAppStore((s) => s.branchThreadId[sessionId] ?? null);
  const navigate = useAppStore((s) => s.navigate);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const up = useAppStore((s) => s.up);
  const loadResolveSession = useAppStore((s) => s.loadResolveSession);
  const refreshReviewSource = useAppStore((s) => s.refreshReviewSource);
  const refreshThreadGitState = useAppStore((s) => s.refreshThreadGitState);
  const reviewTarget = useAppStore((s) => s.reviewTargets[sessionId] ?? null);
  const consumeReviewTarget = useAppStore((s) => s.consumeReviewTarget);
  const controller = useReviewCommentController({
    sessionId,
    entries,
    onFocus: (threadId) => select(threadId),
    onAdvance: (threadId) => {
      select(threadId);
      focusRow(threadId);
    },
  });
  const { compose, editingReplyId, runVerb } = controller;
  const [launch, setLaunch] = useState<ReviewLaunch | null>(null);
  const launchRef = useRef(launch);
  launchRef.current = launch;
  const [isAnswering, setIsAnswering] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [dockHeight, setDockHeight] = useState(0);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const acceptReviewComments = useAppStore((s) => s.acceptReviewComments);
  const undoReviewAccepts = useAppStore((s) => s.undoReviewAccepts);
  const lastBulkAccept = useAppStore((s) => s.reviewBulkAccepts[sessionId] ?? null);
  const bulkRun = useMemo(() => bulkRunOf({ run, entries }), [entries, run]);
  const bulkQuestions = useBulkQuestions({ sessionId, run: bulkRun });
  const undoableCount = useMemo(
    () =>
      lastBulkAccept === null
        ? 0
        : entries.filter(
            (entry) =>
              lastBulkAccept.itemIds.includes(entry.row.item.id) &&
              isUndoableAccept({ row: entry.row }),
          ).length,
    [entries, lastBulkAccept],
  );
  const launchRequest = useAppStore((s) => s.reviewLaunchRequests[sessionId] ?? null);
  const consumeReviewLaunch = useAppStore((s) => s.consumeReviewLaunch);
  const [lastThreadId, setLastThreadId] = useState<string | null>(null);
  const stage = useElementWidth();
  const layout = branchLayoutOf({ widthPx: stage.width });
  const listRef = useRef<HTMLDivElement | null>(null);
  const provider = source === null ? null : REVIEW_SOURCE_LABEL[source.kind];

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

  useEffect(() => {
    void refreshReviewSource({ sessionId, silent: true });
  }, [refreshReviewSource, sessionId]);

  const hasComments = source !== null && source.hasDetail;
  const gitKey = entries
    .map((entry) => `${entry.threadId}:${entry.row.thread.commitShas?.join(',') ?? ''}`)
    .join('|');

  useEffect(() => {
    if (!hasComments) {
      return;
    }
    void refreshThreadGitState({ sessionId }).catch(() => undefined);
  }, [gitKey, hasComments, refreshThreadGitState, sessionId]);

  const hasAddressThread =
    addressThreadId !== null && entries.some((entry) => entry.threadId === addressThreadId);
  const focused =
    entries.find((entry) => entry.threadId === addressThreadId) ??
    entries.find((entry) => entry.threadId === lastThreadId) ??
    shownEntries[0] ??
    entries[0] ??
    null;
  const focusedThreadId = focused?.threadId ?? null;
  const isFocusedDone = focused?.resolveWord === 'done';

  useEffect(() => {
    if (isFocusedDone) {
      setIsDoneOpen(true);
    }
  }, [focusedThreadId, isFocusedDone]);

  const releaseLaunch = useCallback((): void => {
    const current = launchRef.current;
    if (current === null) {
      return;
    }
    setLaunch(null);
    if (!current.isDirect) {
      return;
    }
    const stored = useAppStore.getState().reviewSelection[sessionId] ?? EMPTY_IDS;
    if (sameIds({ left: stored, right: current.threadIds })) {
      clearReviewSelection({ sessionId });
    }
  }, [clearReviewSelection, sessionId]);

  const select = useCallback(
    (threadId: string): void => {
      releaseLaunch();
      setIsAnswering(false);
      if (reviewTarget !== null) {
        consumeReviewTarget({ sessionId, requestId: reviewTarget.requestId });
      }
      setLastThreadId(threadId);
      navigate({ to: branchPlace({ sessionId, threadId }), mode: 'replace' });
      controller.resetFor(threadId);
    },
    [consumeReviewTarget, controller.resetFor, navigate, releaseLaunch, reviewTarget, sessionId],
  );

  const focusRow = useCallback((threadId: string): void => {
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelector<HTMLElement>(`[data-thread-id="${CSS.escape(threadId)}"]`)
        ?.focus(),
    );
  }, []);

  const step = useCallback(
    (delta: 1 | -1): void => {
      const index = shownEntries.findIndex((entry) => entry.threadId === focusedThreadId);
      const next = shownEntries[index + delta];
      if (next === undefined) {
        return;
      }
      select(next.threadId);
      focusRow(next.threadId);
    },
    [focusRow, focusedThreadId, select, shownEntries],
  );

  const openLaunch = useCallback(
    ({ threadIds, isDirect }: ReviewLaunch): void => {
      if (isDirect) {
        setReviewSelection({ sessionId, threadIds });
      }
      setIsAnswering(false);
      setLaunch({ threadIds, isDirect });
    },
    [sessionId, setReviewSelection],
  );

  const openAnswers = useCallback((): void => {
    releaseLaunch();
    setIsAnswering(true);
  }, [releaseLaunch]);

  const closeAnswers = useCallback((): void => {
    setIsAnswering(false);
    if (focusedThreadId !== null) {
      focusRow(focusedThreadId);
    }
  }, [focusRow, focusedThreadId]);

  useEffect(() => {
    if (isAnswering && bulkQuestions.length === 0) {
      setIsAnswering(false);
    }
  }, [bulkQuestions.length, isAnswering]);

  const acceptMany = useCallback(
    async (threadIds: ReadonlyArray<string>): Promise<void> => {
      if (isAccepting || threadIds.length === 0) {
        return;
      }
      setIsAccepting(true);
      setAcceptError(null);
      try {
        const result = await acceptReviewComments({ sessionId, threadIds });
        clearReviewSelection({ sessionId });
        const [first] = result.failures;
        if (first !== undefined) {
          setAcceptError(
            bulkAcceptFailureLine({ count: result.failures.length, message: first.message }),
          );
        }
      } catch (caught) {
        if (!isReportedError(caught)) {
          setAcceptError(formatError(caught));
        }
      } finally {
        setIsAccepting(false);
      }
    },
    [acceptReviewComments, clearReviewSelection, isAccepting, sessionId],
  );

  const undoBulk = useCallback(async (): Promise<void> => {
    if (isUndoing) {
      return;
    }
    setIsUndoing(true);
    setAcceptError(null);
    try {
      await undoReviewAccepts({ sessionId });
    } finally {
      setIsUndoing(false);
    }
  }, [isUndoing, sessionId, undoReviewAccepts]);

  const closeLaunch = useCallback((): void => {
    releaseLaunch();
    if (focusedThreadId !== null) {
      focusRow(focusedThreadId);
    }
  }, [focusRow, focusedThreadId, releaseLaunch]);

  const onLaunchStarted = useCallback((): void => {
    setLaunch(null);
    clearReviewSelection({ sessionId });
    if (focusedThreadId !== null) {
      focusRow(focusedThreadId);
    }
  }, [clearReviewSelection, focusRow, focusedThreadId, sessionId]);

  useEffect(() => {
    if (launchRequest === null || !hasComments) {
      return;
    }
    consumeReviewLaunch({ sessionId, requestId: launchRequest.requestId });
    const threadIds = launchRequest.threadIds.filter((threadId) => presentIds.has(threadId));
    if (threadIds.length > 0) {
      openLaunch({ threadIds, isDirect: true });
    }
  }, [consumeReviewLaunch, hasComments, launchRequest, openLaunch, presentIds, sessionId]);

  const entryById = useMemo(
    () => new Map(entries.map((entry) => [entry.threadId, entry] as const)),
    [entries],
  );
  const launchRows = useMemo(() => {
    if (launch === null) {
      return [];
    }
    const ids = [...new Set([...launch.threadIds, ...fixSelectedIds])];
    return ids.flatMap((threadId) => {
      const entry = entryById.get(threadId);
      return entry === undefined ? [] : [{ entry, isIncluded: checked.has(threadId) }];
    });
  }, [checked, entryById, fixSelectedIds, launch]);
  const hasLaunchRows = launchRows.length > 0;

  useEffect(() => {
    if (launch !== null && !hasLaunchRows) {
      setLaunch(null);
    }
  }, [hasLaunchRows, launch]);

  useEffect(() => {
    if (reviewTarget === null || reviewTarget.status !== 'ready') {
      return;
    }
    const { destination } = reviewTarget;
    const wanted = reviewFocusThreadId({ destination });
    const threadId = reviewFocusThreadId({
      destination,
      isPresent: (candidate) => entries.some((entry) => entry.threadId === candidate),
    });
    if (wanted !== null && threadId === null) {
      return;
    }
    if (threadId !== null) {
      select(threadId);
    }
    consumeReviewTarget({ sessionId, requestId: reviewTarget.requestId });
  }, [consumeReviewTarget, entries, reviewTarget, select, sessionId]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const native = event.nativeEvent;
    if (eventMatches({ event: native, entry: SHORTCUTS['composer.submit'] })) {
      if (compose !== null || editingReplyId !== null) {
        return;
      }
      event.preventDefault();
      if (push.phase.kind === 'confirm') {
        void push.confirm();
        return;
      }
      if (push.phase.kind === 'sync_confirm') {
        void push.confirmSync();
        return;
      }
      void runObjectAction({
        target: { kind: 'review', sessionId },
        actionId: 'review.push',
        env,
      });
      return;
    }
    if (isTypingTarget(event.target) || compose !== null || editingReplyId !== null) {
      return;
    }
    if (eventMatches({ event: native, entry: SHORTCUTS['review.next'] })) {
      event.preventDefault();
      step(1);
      return;
    }
    if (eventMatches({ event: native, entry: SHORTCUTS['review.previous'] })) {
      event.preventDefault();
      step(-1);
      return;
    }
    if (eventMatches({ event: native, entry: SHORTCUTS['review.selectAll'] })) {
      event.preventDefault();
      selectAllFixable();
      return;
    }
    if (focusedThreadId === null) {
      return;
    }
    if (eventMatches({ event: native, entry: SHORTCUTS['review.select'] })) {
      event.preventDefault();
      if (fixableIds.has(focusedThreadId) || acceptableIds.has(focusedThreadId)) {
        toggleReviewSelection({ sessionId, threadId: focusedThreadId });
      }
      return;
    }
    if (
      eventMatches({ event: native, entry: SHORTCUTS['review.fix'] }) &&
      fixSelectedIds.length > 0
    ) {
      event.preventDefault();
      openLaunch({ threadIds: fixSelectedIds, isDirect: false });
      return;
    }
    const available =
      bindTarget({
        state: useAppStore.getState(),
        target: { kind: 'reviewComment', sessionId, threadId: focusedThreadId },
      })?.resolve() ?? [];
    for (const [shortcut, actionIds] of COMMENT_KEYS) {
      if (!eventMatches({ event: native, entry: SHORTCUTS[shortcut] })) {
        continue;
      }
      const action = available.find(
        (candidate) => actionIds.includes(candidate.id) && candidate.blockedReason === null,
      );
      if (action !== undefined) {
        event.preventDefault();
        void runVerb({ threadId: focusedThreadId, actionId: action.id });
        return;
      }
      if (
        shortcut === 'review.fix' &&
        focused?.state === 'failed' &&
        !isPushFailure({ row: focused.row })
      ) {
        event.preventDefault();
        void controller.retryRun(focusedThreadId);
        return;
      }
      return;
    }
  };

  const refreshError = source?.error ?? null;
  const isLoading = source !== null && !source.hasDetail && source.isLoading;
  const isWholeError = source !== null && !source.hasDetail && refreshError !== null;
  const targetThreadId =
    reviewTarget === null ? null : reviewFocusThreadId({ destination: reviewTarget.destination });
  const targetError =
    reviewTarget === null
      ? null
      : reviewTarget.status === 'unavailable' && reviewTarget.reason !== null
        ? REVIEW_TARGET_REASON_COPY[reviewTarget.reason]
        : reviewTarget.status === 'failed'
          ? reviewTarget.error
          : null;
  const retry = (): void => void refreshReviewSource({ sessionId, force: true });

  const body = (): ReactNode => {
    if (isWholeError && refreshError !== null) {
      return (
        <EmptyState
          icon={AlertTriangle}
          tone="danger"
          title={`Couldn't read comments from ${provider ?? 'GitHub'}`}
          description={refreshError}
          action={
            <Button size="sm" variant="secondary" onClick={retry}>
              Retry
            </Button>
          }
        />
      );
    }
    if (isLoading) {
      return (
        <div className="flex w-full flex-col gap-3">
          {SKELETON_ROWS.map((key) => (
            <div key={key} className="flex flex-col gap-2 px-3 py-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      );
    }
    if (focused === null) {
      return <ReviewEmptyState provider={provider} />;
    }
    const isSingle = layout === 'single';
    const isLaunching = launch !== null;
    const isPanelOpen = isLaunching || (isAnswering && bulkRun !== null);
    const isRightShown = !isSingle || hasAddressThread || isPanelOpen;
    return (
      <div className="flex min-h-0 min-w-0 flex-1 gap-6">
        {(!isSingle || (!hasAddressThread && !isPanelOpen)) && (
          <div
            className={cn(
              'relative flex min-h-0 shrink-0 flex-col',
              isSingle ? 'w-full' : 'w-[300px]',
            )}
          >
            <ScrollFade className="min-h-0 flex-1" viewportClassName="pr-2 pb-5" fadeSize="h-6">
              <div ref={listRef}>
                <ReviewList
                  groups={groups}
                  focusedThreadId={focusedThreadId}
                  isDoneOpen={isDoneShown}
                  onToggleDone={() => setIsDoneOpen((current) => !current)}
                  onSelect={select}
                  onFix={(threadId) => openLaunch({ threadIds: [threadId], isDirect: true })}
                  onAccept={(threadIds) => void acceptMany(threadIds)}
                  isAccepting={isAccepting}
                  checked={checked}
                  onToggle={(threadId) => toggleReviewSelection({ sessionId, threadId })}
                />
              </div>
              <div
                aria-hidden
                data-testid="review-list-clearance"
                style={{ height: dockHeight === 0 ? 0 : dockHeight + DOCK_BOTTOM_OFFSET }}
              />
            </ScrollFade>
            <ReviewSelectionBar
              count={selectedIds.length}
              total={shownFixableIds.length}
              fixCount={fixSelectedIds.length}
              acceptCount={acceptSelectedIds.length}
              isAccepting={isAccepting}
              note={
                undoableCount > 0 && selectedIds.length === 0 ? (
                  <BulkUndoBar
                    count={undoableCount}
                    hint={shortcutGlyphs('app.undo')}
                    isBusy={isUndoing}
                    onUndo={() => void undoBulk()}
                  />
                ) : null
              }
              onHeightChange={setDockHeight}
              onClear={() => clearReviewSelection({ sessionId })}
              onSelectAll={selectAllFixable}
              onFix={() => openLaunch({ threadIds: fixSelectedIds, isDirect: false })}
              onAccept={() => void acceptMany(acceptSelectedIds)}
            />
          </div>
        )}
        {isRightShown && (
          <ScrollFade
            className="min-h-0 min-w-0 flex-1"
            viewportClassName="pb-8 pr-4"
            fadeSize="h-6"
          >
            {isSingle && (
              <button
                type="button"
                onClick={isLaunching ? closeLaunch : isPanelOpen ? closeAnswers : () => up()}
                className="mb-4 inline-flex items-center gap-1 rounded-sm text-meta text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <ChevronLeft size={ICON_SIZE.row} aria-hidden />
                {REVIEW_FLOW_LABEL.list}
              </button>
            )}
            {isLaunching ? (
              <LaunchPanel
                sessionId={sessionId}
                rows={launchRows}
                onToggle={(threadId) => toggleReviewSelection({ sessionId, threadId })}
                onClose={closeLaunch}
                onStarted={onLaunchStarted}
              />
            ) : isAnswering && bulkRun !== null ? (
              <AnswersPanel
                sessionId={sessionId}
                run={bulkRun}
                questions={bulkQuestions}
                onClose={closeAnswers}
                onContinued={closeAnswers}
              />
            ) : (
              <div className="flex min-w-0 gap-6">
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <ReviewComment
                    key={focused.threadId}
                    sessionId={sessionId}
                    entry={focused}
                    entries={entries}
                    hunk={
                      <ThreadHunk
                        entry={focused}
                        onOpenInDiff={() =>
                          void runVerb({
                            threadId: focused.threadId,
                            actionId: 'reviewComment.openInDiff',
                          })
                        }
                      />
                    }
                    {...controller.bind(focused.threadId)}
                    onSelect={select}
                    onTryAgain={() => void controller.retryRun(focused.threadId)}
                    onStartOver={() => void controller.startOver(focused.threadId)}
                  />
                  <ThreadProperties sessionId={sessionId} entry={focused} />
                </div>
              </div>
            )}
          </ScrollFade>
        )}
      </div>
    );
  };

  return (
    <div ref={stage.ref} className="flex min-h-0 min-w-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <PageColumn width="column" className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        {refreshError !== null && !isWholeError && (
          <ErrorStrip
            label={resolveQueueRefreshLabel({ provider: provider ?? 'GitHub' })}
            error={new Error(refreshError)}
            onRetry={retry}
          />
        )}
        {reviewTarget?.status === 'pending' && (
          <p role="status" className="text-meta text-muted-foreground">
            {reviewTargetPending({ hasThread: targetThreadId !== null })}
          </p>
        )}
        {targetError !== null && reviewTarget !== null && (
          <ErrorStrip
            label={reviewTargetErrorLabel({ hasThread: targetThreadId !== null })}
            error={new Error(targetError)}
            onRetry={() => void openReview({ sessionId, destination: reviewTarget.destination })}
          />
        )}
        {lane?.rebuildLine != null && (
          <p role="status" className="text-meta text-muted-foreground">
            {lane.rebuildLine}
          </p>
        )}
        {acceptError !== null && (
          <Notice
            tone="danger"
            placement="banner"
            role="alert"
            title={REVIEW_BULK_LABEL.acceptFailed}
            body={acceptError}
          />
        )}
        {run === null ? (
          shownFixableIds.length > 0 && (
            <FixOpenLine
              count={shownFixableIds.length}
              onFix={() => openLaunch({ threadIds: shownFixableIds, isDirect: true })}
            />
          )
        ) : (
          <ResolveRunStatus
            run={run}
            filter={activeFilter}
            onFilter={setFilter}
            onOpenTranscript={() =>
              openDrawer({ kind: 'transcript', sessionId, payload: { agentId: run.agentId } })
            }
            lane={lane}
            onStop={() =>
              void (lane === null
                ? forceCloseResolver(sessionId, run.agentId)
                : stopResolveLane({ sessionId, worktreePath: lane.worktreePath }))
            }
            actions={
              bulkRun === null ? null : (
                <RunStatusBulkActions
                  sessionId={sessionId}
                  run={bulkRun}
                  onOpenAnswers={openAnswers}
                />
              )
            }
          />
        )}
        {body()}
      </PageColumn>
    </div>
  );
};
