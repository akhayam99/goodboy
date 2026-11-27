import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare } from '@goodboy/ui/icons';
import {
  EmptyState,
  ErrorStrip,
  Notice,
  PageColumn,
  ScrollFade,
  appScrollIntoView,
} from '@goodboy/ui';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core/review-source';
import type { MountId, Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectOpenDrawer } from '../../../../store/slices/drawer/selectOpenDrawer';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { isTypingTarget } from '../../../../shared/keyboard/isTypingTarget';
import { SHORTCUTS, shortcutGlyphs, type ShortcutId } from '../../../../shared/keyboard/registry';
import { reviewFocusThreadId } from '../../../../store/slices/review-navigation';
import { bindTarget, runObjectAction } from '../../../actions/registry';
import { useActionEnv } from '../../../actions/useActionEnv';
import { stateCountsInScopeOf } from '../../commentGroupsView';
import { useActiveReviewSource } from '../../hooks/useActiveReviewSource';
import { useLaneStatus } from '../../hooks/useLaneStatus';
import { LaneNotices } from './LaneNotices';
import { useReviewCommentDrawerSlot } from '../../hooks/useReviewCommentDrawerSlot';
import { useOpenReviewComment } from '../../hooks/useOpenReviewComment';
import { reviewCommentDrawerSlot } from '../../reviewCommentDrawerSlot';
import { ReviewCommentDrawer } from '../ReviewCommentDrawer';
import { useReviewCommentController } from '../../hooks/useReviewCommentController';
import { isUndoableAccept } from '../../bulkAccept';
import { useBulkAccept } from './useBulkAccept';
import { resolveQueueRefreshLabel } from '../../resolveQueueCopy';
import { isPushFailure } from '../../reviewCommentState';
import { bulkRunOf } from './bulkRun';
import { AnswersPanel } from './AnswersPanel';
import { useDropHandledSelection } from './useDropHandledSelection';
import { useFixRun } from './useFixRun';
import { useHeldReviewGroups } from './useHeldReviewGroups';
import { BulkUndoBar } from './BulkUndoBar';
import { focusedRowId } from './focusedRowId';
import { useCommentWork } from './useCommentWork';
import { openFixComments } from '../../../../store/slices/resolve/openFixComments';
import type { CommentScope, CommentState } from './ReviewScopeBar';
import { ReviewToolbar } from './ReviewToolbar';
import { useBulkQuestions } from './useBulkQuestions';
import { ReviewEmptyState } from './ReviewEmptyState';
import { ReviewList } from './ReviewList';
import { ReviewSkeleton } from './ReviewSkeleton';
import { ReviewTargetNotices } from './ReviewTargetNotices';
import { ReviewSelectionBar } from './ReviewSelectionBar';
import type { ReviewPush } from './useReviewPush';
import { useReviewEntries } from './useReviewEntries';

type Props = {
  readonly session: Session;
  readonly mountId?: MountId | null;
  readonly push: ReviewPush;
};

const COMMENT_KEYS: ReadonlyArray<readonly [ShortcutId, ReadonlyArray<string>]> = [
  [
    'review.accept',
    ['reviewComment.accept', 'reviewComment.resolveOnly', 'reviewComment.closeWithReply'],
  ],
  ['review.edit', ['reviewComment.answer', 'reviewComment.edit']],
  [
    'review.reply',
    ['reviewComment.replyOnly', 'reviewComment.reply', 'reviewComment.replyAndResolve'],
  ],
  ['review.skip', ['reviewComment.skip']],
  ['review.undo', ['reviewComment.undo']],
  ['review.fix', ['reviewComment.draft', 'reviewComment.fixAnyway', 'reviewComment.fixAgain']],
];

type FixLaunchParams = {
  readonly threadIds: ReadonlyArray<string>;
  readonly fromThreadId?: string | null;
};

type StepParams = {
  readonly delta: 1 | -1;
};

type FocusRowParams = {
  readonly threadId: string;
};

const DOCK_BOTTOM_OFFSET = 24;

export const ReviewFlow = ({ session, mountId = null, push }: Props) => {
  const sessionId = session.id as SessionId;
  const env = useActionEnv({ origin: 'button' });
  const {
    entries,
    groups: branchGroups,
    all: laneEntries,
    counts,
  } = useReviewEntries({ sessionId, scope: 'branch', mountId });
  const [pickedScope, setScope] = useState<CommentScope>('branch');
  const scope: CommentScope = counts.notes > 0 && counts.host > 0 ? pickedScope : 'branch';
  const [commentState, setCommentState] = useState<CommentState>('open');
  const stateCounts = useMemo(() => stateCountsInScopeOf({ entries, scope }), [entries, scope]);
  const groups = useHeldReviewGroups({ groups: branchGroups, scope, state: commentState });
  const lane = useLaneStatus({ sessionId, entries: laneEntries });
  const { run, fixRunReady, isRunLive } = useFixRun({ lane, entries });
  const { works, stopWork } = useCommentWork({ sessionId, entries, run, lane });
  const shownEntries = useMemo(() => groups.flatMap((group) => group.entries), [groups]);
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
  useDropHandledSelection({ sessionId, presentIds, fixableIds, acceptableIds });
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
  const { source } = useActiveReviewSource({ sessionId, mountId });
  const openComment = useOpenReviewComment({ sessionId, mountId });
  const openDrawer = useAppStore((s) => s.openDrawer);
  const openThreadId = useAppStore((s) => {
    const open = selectOpenDrawer(s);
    return open?.kind === 'conversation' && open.sessionId === sessionId
      ? open.payload.threadId
      : null;
  });
  const drawerSlot = useReviewCommentDrawerSlot();
  const openThreadRef = useRef(openThreadId);
  openThreadRef.current = openThreadId;
  const [lastThreadId, setLastThreadId] = useState<string | null>(openThreadId);
  const loadResolveSession = useAppStore((s) => s.loadResolveSession);
  const refreshReviewSource = useAppStore((s) => s.refreshReviewSource);
  const refreshThreadGitState = useAppStore((s) => s.refreshThreadGitState);
  const reviewTarget = useAppStore((s) => s.reviewTargets[sessionId] ?? null);
  const consumeReviewTarget = useAppStore((s) => s.consumeReviewTarget);
  const controller = useReviewCommentController({
    sessionId,
    entries,
    onFocus: (threadId) => select(threadId),
    onAdvance: ({ threadId, fromThreadId }) => {
      if (openThreadRef.current !== fromThreadId) {
        return;
      }
      select(threadId);
    },
  });
  const { compose, editingReplyId, runVerb } = controller;
  const [isAnswering, setIsAnswering] = useState(false);
  const [dockHeight, setDockHeight] = useState(0);
  const bulk = useBulkAccept({ sessionId });
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

  useEffect(() => {
    if (openThreadId === null) {
      return;
    }
    setLastThreadId(openThreadId);
    const row = listRef.current?.querySelector(`[data-thread-id="${CSS.escape(openThreadId)}"]`);
    appScrollIntoView({ element: row, block: 'nearest' });
  }, [openThreadId]);

  const opened =
    openThreadId === null
      ? null
      : (entries.find((entry) => entry.threadId === openThreadId) ?? null);

  const focusDrawer = useCallback((): void => {
    requestAnimationFrame(() => {
      const slot = reviewCommentDrawerSlot.get();
      if (slot === null || slot.contains(document.activeElement)) {
        return;
      }
      slot.querySelector<HTMLElement>('section')?.focus({ preventScroll: true });
    });
  }, []);

  const select = useCallback(
    (threadId: string): void => {
      setIsAnswering(false);
      if (reviewTarget !== null) {
        consumeReviewTarget({ sessionId, requestId: reviewTarget.requestId });
      }
      openComment({ threadId });
      controller.resetFor(threadId);
      focusDrawer();
    },
    [consumeReviewTarget, controller.resetFor, focusDrawer, openComment, reviewTarget, sessionId],
  );

  const focusRow = useCallback(({ threadId }: FocusRowParams): void => {
    requestAnimationFrame(() =>
      listRef.current
        ?.querySelector<HTMLElement>(`[data-thread-id="${CSS.escape(threadId)}"]`)
        ?.focus(),
    );
  }, []);

  const closeComment = useCallback((): void => {
    const threadId = openThreadId;
    openComment({ threadId: null });
    if (threadId !== null) {
      focusRow({ threadId });
    }
  }, [focusRow, openComment, openThreadId]);

  const step = useCallback(
    ({ delta }: StepParams): void => {
      const anchor = openThreadId ?? focusedRowId();
      const index = shownEntries.findIndex((entry) => entry.threadId === anchor);
      const next =
        index === -1
          ? shownEntries[delta === 1 ? 0 : shownEntries.length - 1]
          : shownEntries[index + delta];
      if (next === undefined) {
        return;
      }
      if (openThreadId !== null) {
        select(next.threadId);
        return;
      }
      focusRow({ threadId: next.threadId });
    },
    [focusRow, openThreadId, select, shownEntries],
  );

  const openLaunch = useCallback(
    ({ threadIds, fromThreadId = openThreadRef.current }: FixLaunchParams): void => {
      setIsAnswering(false);
      openFixComments({
        openDrawer,
        sessionId,
        mountId: null,
        threadIds,
        fromThreadId,
      });
    },
    [openDrawer, sessionId],
  );

  const openAnswers = useCallback((): void => {
    setIsAnswering(true);
  }, []);

  const closeAnswers = useCallback((): void => {
    setIsAnswering(false);
  }, []);

  useEffect(() => {
    if (isAnswering && bulkQuestions.length === 0) {
      setIsAnswering(false);
    }
  }, [bulkQuestions.length, isAnswering]);

  useEffect(() => {
    if (launchRequest === null || !hasComments) {
      return;
    }
    consumeReviewLaunch({ sessionId, requestId: launchRequest.requestId });
    const threadIds = launchRequest.threadIds.filter((threadId) => presentIds.has(threadId));
    if (threadIds.length > 0) {
      openLaunch({ threadIds, fromThreadId: launchRequest.fromThreadId });
    }
  }, [consumeReviewLaunch, hasComments, launchRequest, openLaunch, presentIds, sessionId]);

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
    const rowId = focusedRowId();
    const isArrowStep = openThreadId !== null || rowId !== null;
    if (
      eventMatches({ event: native, entry: SHORTCUTS['review.next'] }) ||
      (isArrowStep && eventMatches({ event: native, entry: SHORTCUTS['review.down'] }))
    ) {
      event.preventDefault();
      step({ delta: 1 });
      return;
    }
    if (
      eventMatches({ event: native, entry: SHORTCUTS['review.previous'] }) ||
      (isArrowStep && eventMatches({ event: native, entry: SHORTCUTS['review.up'] }))
    ) {
      event.preventDefault();
      step({ delta: -1 });
      return;
    }
    if (eventMatches({ event: native, entry: SHORTCUTS['review.selectAll'] })) {
      event.preventDefault();
      selectAllFixable();
      return;
    }
    const anchorId = openThreadId ?? rowId;
    if (anchorId !== null && eventMatches({ event: native, entry: SHORTCUTS['review.select'] })) {
      event.preventDefault();
      if (fixableIds.has(anchorId) || acceptableIds.has(anchorId)) {
        toggleReviewSelection({ sessionId, threadId: anchorId });
      }
      return;
    }
    const isInDrawer =
      event.target instanceof Node &&
      reviewCommentDrawerSlot.get()?.contains(event.target) === true;
    if (
      !isInDrawer &&
      fixSelectedIds.length > 0 &&
      eventMatches({ event: native, entry: SHORTCUTS['review.fix'] })
    ) {
      event.preventDefault();
      openLaunch({ threadIds: fixSelectedIds });
      return;
    }
    if (opened === null) {
      return;
    }
    const openedId = opened.threadId;
    const available =
      bindTarget({
        state: useAppStore.getState(),
        target: { kind: 'reviewComment', sessionId, threadId: openedId },
      })?.resolve() ?? [];
    for (const [shortcut, actionIds] of COMMENT_KEYS) {
      if (!eventMatches({ event: native, entry: SHORTCUTS[shortcut] })) {
        continue;
      }
      const action = actionIds
        .map((id) =>
          available.find((candidate) => candidate.id === id && candidate.blockedReason === null),
        )
        .find((candidate) => candidate !== undefined);
      if (action !== undefined) {
        event.preventDefault();
        void runVerb({ threadId: openedId, actionId: action.id });
        return;
      }
      if (
        shortcut === 'review.fix' &&
        opened.state === 'failed' &&
        !isPushFailure({ row: opened.row })
      ) {
        event.preventDefault();
        void controller.retryRun(openedId);
        return;
      }
      return;
    }
  };

  const refreshError = source?.error ?? null;
  const hasLocalEntries = entries.length > 0;
  const isLoading = source !== null && !source.hasDetail && source.isLoading && !hasLocalEntries;
  const isWholeError =
    source !== null && !source.hasDetail && refreshError !== null && !hasLocalEntries;
  const retry = (): void => void refreshReviewSource({ sessionId, force: true });
  const openedIndex =
    openThreadId === null ? -1 : shownEntries.findIndex((entry) => entry.threadId === openThreadId);

  const body = (): ReactNode => {
    if (isWholeError && refreshError !== null) {
      return (
        <ErrorStrip
          labels={[`comments from ${provider ?? 'GitHub'}`]}
          error={new Error(refreshError)}
          onRetry={retry}
        />
      );
    }
    if (isLoading) {
      return <ReviewSkeleton />;
    }
    if (entries.length === 0) {
      return <ReviewEmptyState sessionId={sessionId} provider={provider} />;
    }
    if (isAnswering && bulkRun !== null) {
      return (
        <ScrollFade className="min-h-0 min-w-0 flex-1" viewportClassName="pb-8" fadeSize="h-6">
          <AnswersPanel
            sessionId={sessionId}
            run={bulkRun}
            questions={bulkQuestions}
            onClose={closeAnswers}
            onContinued={closeAnswers}
          />
        </ScrollFade>
      );
    }
    if (shownEntries.length === 0) {
      return (
        <EmptyState
          size="page"
          icon={MessageSquare}
          title={commentState === 'resolved' ? 'No resolved comments' : 'No open comments'}
        />
      );
    }
    return (
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <ScrollFade className="min-h-0 flex-1" viewportClassName="pb-5" fadeSize="h-6">
          <div ref={listRef}>
            <ReviewList
              sessionId={sessionId}
              groups={groups}
              works={works}
              onStopWork={stopWork}
              focusedThreadId={openThreadId ?? lastThreadId}
              onSelect={select}
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
          isAccepting={bulk.isAccepting}
          note={
            undoableCount > 0 && selectedIds.length === 0 ? (
              <BulkUndoBar
                count={undoableCount}
                hint={shortcutGlyphs('app.undo')}
                isBusy={bulk.isUndoing}
                onUndo={() => void bulk.undo()}
              />
            ) : null
          }
          onHeightChange={setDockHeight}
          onClear={() => clearReviewSelection({ sessionId })}
          onSelectAll={selectAllFixable}
          onFix={() => openLaunch({ threadIds: fixSelectedIds })}
          onAccept={() => void bulk.accept(acceptSelectedIds)}
        />
      </div>
    );
  };

  const isDrawerShown = drawerSlot !== null && openThreadId !== null && !isLoading && !isWholeError;
  const drawer =
    !isDrawerShown || drawerSlot === null || openThreadId === null
      ? null
      : createPortal(
          <ReviewCommentDrawer
            sessionId={sessionId}
            mountId={mountId}
            entry={opened}
            entries={entries}
            push={push}
            position={
              openedIndex === -1 ? null : { index: openedIndex, total: shownEntries.length }
            }
            hasRunLine={run !== null && run.threadIds.includes(openThreadId)}
            binding={controller.bind(openThreadId)}
            onClose={closeComment}
            onSelect={select}
            onTryAgain={() => void controller.retryRun(openThreadId)}
            onStartOver={() => void controller.startOver(openThreadId)}
          />,
          drawerSlot,
        );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      <PageColumn width="column" className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        {refreshError !== null && !isWholeError && (
          <ErrorStrip
            labels={[resolveQueueRefreshLabel({ provider: provider ?? 'GitHub' })]}
            error={new Error(refreshError)}
            onRetry={retry}
          />
        )}
        <ReviewTargetNotices sessionId={sessionId} />
        <LaneNotices sessionId={sessionId} lane={lane} mountId={source?.mountId ?? null} />
        {bulk.error !== null && (
          <Notice
            tone="danger"
            placement="banner"
            role="alert"
            title={bulk.error.title}
            body={bulk.error.body}
          />
        )}
        <ReviewToolbar
          sessionId={sessionId}
          scope={scope}
          onScope={setScope}
          state={commentState}
          onState={setCommentState}
          counts={counts}
          stateCounts={stateCounts}
          hostLabel={provider}
          run={run}
          lane={lane}
          bulkRun={bulkRun}
          ready={fixRunReady}
          sourceKind={source?.kind ?? null}
          isChecksShown={!isRunLive}
          onOpenAnswers={openAnswers}
        />
        {body()}
      </PageColumn>
      {drawer}
    </div>
  );
};
