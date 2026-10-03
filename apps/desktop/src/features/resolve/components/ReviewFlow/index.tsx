import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import {
  EmptyState,
  ErrorStrip,
  IconButton,
  PageColumn,
  ScrollFade,
  SegmentedTabs,
  Skeleton,
  formatError,
  PaneShell,
} from '@goodboy/ui';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { isTypingTarget } from '../../../../shared/keyboard/isTypingTarget';
import { SHORTCUTS, type ShortcutId } from '../../../../shared/keyboard/registry';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { selectActiveMountId } from '../../../../store/slices/project-mounts/selectors';
import { reviewFocusThreadId } from '../../../../store/slices/review-navigation';
import { bindTarget, runObjectAction } from '../../../actions/registry';
import { useActionEnv } from '../../../actions/useActionEnv';
import { openReview } from '../../../review/openReview';
import {
  REVIEW_TARGET_REASON_COPY,
  reviewTargetErrorLabel,
  reviewTargetPending,
} from '../../../review/reviewTargetCopy';
import { REVIEW_REQUEST_EVENT, isReviewRequest } from '../../../review/reviewRequest';
import { useActiveReviewSource } from '../../hooks/useActiveReviewSource';
import { useReviewCommentController } from '../../hooks/useReviewCommentController';
import { resolveQueueRefreshLabel } from '../../resolveQueueCopy';
import { REVIEW_FLOW_LABEL, REVIEW_TITLE, counterLabel } from '../../reviewFlowCopy';
import { startedLine } from '../../reviewLaunchCopy';
import {
  isPushFailure,
  matchesReviewStateFilter,
  type ReviewStateFilter,
} from '../../reviewCommentState';
import { replyOnlyLine } from '../../reviewRemote';
import { REVIEW_VIEW_LABEL } from '../../reviewCommitsCopy';
import { ReviewCommits } from '../ReviewCommits';
import { ReviewEmptyState } from './ReviewEmptyState';
import { ReviewComment } from './ReviewComment';
import { ReviewHeaderActions } from './ReviewHeaderActions';
import { ReviewHeaderMeta } from './ReviewHeaderMeta';
import { PushBanner } from './PushBanner';
import { ReviewLaunchStrip } from '../../ReviewLaunchStrip';
import { ReviewList } from './ReviewList';
import { ReviewListMenu } from './ReviewListMenu';
import { ReviewSelectionBar } from './ReviewSelectionBar';
import { modelLabel } from '../../../chat/utils/chat-constants';
import { useReviewPush } from './useReviewPush';
import { useReviewEntries, type ReviewEntry } from './useReviewEntries';

type Props = {
  readonly session: Session;
  readonly noPullRequestLine?: ReactNode;
};

type ReviewView = 'comments' | 'commits';

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
};

type StartedNote = {
  readonly count: number;
  readonly model: string;
};

const SKELETON_ROWS = [0, 1, 2];

export const ReviewFlow = ({ session, noPullRequestLine = null }: Props) => {
  const sessionId = session.id as SessionId;
  const env = useActionEnv({ origin: 'button' });
  const { entries, groups } = useReviewEntries({ sessionId });
  const [filter, setFilter] = useState<ReviewStateFilter>('all');
  const shownGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          entries: group.entries.filter((entry) =>
            matchesReviewStateFilter({ state: entry.state, filter }),
          ),
        }))
        .filter((group) => group.entries.length > 0),
    [filter, groups],
  );
  const shownEntries = useMemo(() => shownGroups.flatMap((group) => group.entries), [shownGroups]);
  const storedSelection = useAppStore((s) => s.reviewSelection[sessionId]);
  const setReviewSelection = useAppStore((s) => s.setReviewSelection);
  const toggleReviewSelection = useAppStore((s) => s.toggleReviewSelection);
  const clearReviewSelection = useAppStore((s) => s.clearReviewSelection);
  const fixableIds = useMemo(
    () => new Set(entries.filter((entry) => entry.state === 'new').map((entry) => entry.threadId)),
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
  const checked = useMemo(() => new Set(selectedIds), [selectedIds]);
  const { source } = useActiveReviewSource({ sessionId });
  const selectedThreadId = useAppStore((s) =>
    s.drawer?.kind === 'conversation' && s.drawer.sessionId === sessionId
      ? s.drawer.payload.threadId
      : null,
  );
  const openDrawer = useAppStore((s) => s.openDrawer);
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
  const { compose, editingReplyId, runVerb, setError } = controller;
  const [modelPickerRequest, setModelPickerRequest] = useState(0);
  const [launch, setLaunch] = useState<ReviewLaunch | null>(null);
  const [started, setStarted] = useState<StartedNote | null>(null);
  const [view, setView] = useState<ReviewView>('comments');
  const commitCount = useAppStore((s) => {
    const mountId = selectActiveMountId({ state: s, sessionId });
    return mountId === null ? null : (s.historyDrafts[mountId]?.commits.length ?? null);
  });
  const listRef = useRef<HTMLDivElement | null>(null);
  const provider = source === null ? null : REVIEW_SOURCE_LABEL[source.kind];
  const push = useReviewPush({ sessionId });
  const hasPushFailure = entries.some((entry) => isPushFailure({ row: entry.row }));
  const isPushBusy =
    push.phase.kind === 'preparing' ||
    push.phase.kind === 'pushing' ||
    push.phase.kind === 'syncing';

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

  const replyOnlyCount = entries.filter(
    (entry) => entry.remote === 'on_origin' && entry.group === 'open',
  ).length;

  const focused =
    entries.find((entry) => entry.threadId === selectedThreadId) ??
    entries.find((entry) => entry.group === 'open') ??
    entries[0] ??
    null;
  const focusedThreadId = focused?.threadId ?? null;

  const select = useCallback(
    (threadId: string): void => {
      if (reviewTarget !== null) {
        consumeReviewTarget({ sessionId, requestId: reviewTarget.requestId });
      }
      openDrawer({ kind: 'conversation', sessionId, payload: { threadId } });
      controller.resetFor(threadId);
    },
    [consumeReviewTarget, controller.resetFor, openDrawer, reviewTarget, sessionId],
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
    (threadIds: ReadonlyArray<string>): void => {
      const [first] = threadIds;
      if (threadIds.length === 1 && first !== undefined) {
        select(first);
      }
      setStarted(null);
      setLaunch({ threadIds });
    },
    [select],
  );

  const closeLaunch = useCallback((): void => {
    setLaunch(null);
    if (focusedThreadId !== null) {
      focusRow(focusedThreadId);
    }
  }, [focusRow, focusedThreadId]);

  const onLaunchStarted = useCallback(
    ({ count, model }: StartedNote): void => {
      setStarted({ count, model: modelLabel(model) });
      clearReviewSelection({ sessionId });
      closeLaunch();
    },
    [clearReviewSelection, closeLaunch, sessionId],
  );

  const retryDelivery = useCallback((): void => {
    if (!isPushBusy) {
      void push.arm({ isRetry: true });
    }
  }, [isPushBusy, push]);

  useEffect(() => {
    const onRequest = (event: Event): void => {
      if (!isReviewRequest(event) || event.defaultPrevented) {
        return;
      }
      if (event.detail.sessionId !== sessionId) {
        return;
      }
      const { request } = event.detail;
      if (request.kind === 'fix') {
        event.preventDefault();
        openLaunch(request.threadIds);
        return;
      }
      if (request.kind === 'push') {
        event.preventDefault();
        if (!isPushBusy) {
          void push.arm({ isRetry: hasPushFailure });
        }
        return;
      }
      if (request.kind === 'draft_model') {
        event.preventDefault();
        setModelPickerRequest((count) => count + 1);
      }
    };
    window.addEventListener(REVIEW_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(REVIEW_REQUEST_EVENT, onRequest);
  }, [hasPushFailure, isPushBusy, openLaunch, push, select, sessionId]);

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

  const switchView = (event: KeyboardEvent<HTMLDivElement>): boolean => {
    if (
      isTypingTarget(event.target) ||
      compose !== null ||
      editingReplyId !== null ||
      !eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['review.view'] })
    ) {
      return false;
    }
    event.preventDefault();
    setView((current) => (current === 'comments' ? 'commits' : 'comments'));
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const native = event.nativeEvent;
    if (switchView(event) || view === 'commits') {
      return;
    }
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
    if (
      (native.metaKey || native.ctrlKey) &&
      !native.altKey &&
      !native.shiftKey &&
      native.code === 'KeyA'
    ) {
      event.preventDefault();
      setReviewSelection({
        sessionId,
        threadIds: shownEntries
          .filter((entry) => fixableIds.has(entry.threadId))
          .map((entry) => entry.threadId),
      });
      return;
    }
    if (native.key === 'Escape' && selectedIds.length > 0) {
      event.preventDefault();
      clearReviewSelection({ sessionId });
      return;
    }
    if (focusedThreadId === null) {
      return;
    }
    if (eventMatches({ event: native, entry: SHORTCUTS['review.select'] })) {
      event.preventDefault();
      if (fixableIds.has(focusedThreadId)) {
        toggleReviewSelection({ sessionId, threadId: focusedThreadId });
      }
      return;
    }
    if (
      eventMatches({ event: native, entry: SHORTCUTS['review.fix'] }) &&
      fixSelectedIds.length > 0
    ) {
      event.preventDefault();
      openLaunch(fixSelectedIds);
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
  const index = entries.findIndex((entry) => entry.threadId === focusedThreadId);

  const body = (): ReactNode => {
    if (isWholeError && refreshError !== null) {
      return (
        <EmptyState
          icon={AlertTriangle}
          tone="danger"
          title={`Couldn't read comments from ${provider ?? 'GitHub'}`}
          description={refreshError}
        />
      );
    }
    if (isLoading) {
      return (
        <div className="flex max-w-[300px] flex-col gap-3">
          {SKELETON_ROWS.map((key) => (
            <div key={key} className="flex flex-col gap-1.5 px-2.5 py-2">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      );
    }
    if (view === 'commits') {
      return (
        <ReviewCommits
          sessionId={sessionId}
          entries={entries}
          onOpenThread={(threadId) => {
            setView('comments');
            select(threadId);
          }}
        />
      );
    }
    if (focused === null) {
      return <ReviewEmptyState provider={provider} />;
    }
    return (
      <div className="flex min-h-0 min-w-0 flex-1 gap-8">
        <div className="hidden min-h-0 w-[300px] shrink-0 flex-col @4xl:flex">
          {selectedIds.length > 0 ? (
            <ReviewSelectionBar
              count={selectedIds.length}
              fixCount={fixSelectedIds.length}
              onClear={() => clearReviewSelection({ sessionId })}
              onFix={() => openLaunch(fixSelectedIds)}
            />
          ) : (
            <ReviewListMenu filter={filter} onFilter={setFilter} />
          )}
          <ScrollFade className="min-h-0 flex-1" viewportClassName="pb-5 pr-2" fadeSize="h-6">
            <div ref={listRef}>
              <ReviewList
                groups={shownGroups}
                focusedThreadId={focusedThreadId}
                onSelect={select}
                onFix={(threadId) => openLaunch([threadId])}
                checked={checked}
                onToggle={(threadId) => toggleReviewSelection({ sessionId, threadId })}
              />
              {shownGroups.length === 0 && (
                <p className="px-2.5 py-2 text-secondary text-muted-foreground">
                  {REVIEW_FLOW_LABEL.noMatch}
                </p>
              )}
            </div>
          </ScrollFade>
        </div>
        <ScrollFade className="min-h-0 min-w-0 flex-1" viewportClassName="pb-8 pr-4" fadeSize="h-6">
          <div className="mb-4 flex items-center gap-1 @4xl:hidden">
            <span className="text-secondary tabular-nums text-muted-foreground">
              {counterLabel({ index: index + 1, total: entries.length })}
            </span>
            <IconButton
              icon={ChevronUp}
              label={REVIEW_FLOW_LABEL.previous}
              variant="ghost"
              disabled={index <= 0}
              onClick={() => step(-1)}
            />
            <IconButton
              icon={ChevronDown}
              label={REVIEW_FLOW_LABEL.next}
              variant="ghost"
              disabled={index >= entries.length - 1}
              onClick={() => step(1)}
            />
          </div>
          <ReviewComment
            key={focused.threadId}
            sessionId={sessionId}
            entry={focused}
            entries={entries}
            {...controller.bind(focused.threadId)}
            onSelect={select}
            onTryAgain={() => void controller.retryRun(focused.threadId)}
            onRetryDelivery={retryDelivery}
            onSync={push.askSync}
          />
        </ScrollFade>
      </div>
    );
  };

  return (
    <PaneShell
      title={REVIEW_TITLE}
      icon={CONCEPT_ICONS.review}
      tone={CONCEPT_TONE.review}
      scroll="self"
      actions={
        <ReviewHeaderActions
          sessionId={sessionId}
          modelPickerRequest={modelPickerRequest}
          busyActionId={isPushBusy ? 'review.push' : null}
          replyOnlyLine={replyOnlyCount === 0 ? null : replyOnlyLine({ count: replyOnlyCount })}
        />
      }
      subheader={
        <div className="flex flex-col gap-3 pl-6" onKeyDown={(event) => void switchView(event)}>
          <ReviewHeaderMeta
            sessionId={sessionId}
            entries={entries}
            noPullRequestLine={noPullRequestLine}
          />
          <SegmentedTabs<ReviewView>
            ariaLabel={REVIEW_VIEW_LABEL.group}
            size="sm"
            className="w-fit"
            value={view}
            onChange={setView}
            options={[
              {
                value: 'comments',
                label: REVIEW_VIEW_LABEL.comments,
                badge: <span className="tabular-nums text-faint-foreground">{entries.length}</span>,
              },
              {
                value: 'commits',
                label: REVIEW_VIEW_LABEL.commits,
                ...(commitCount !== null && {
                  badge: <span className="tabular-nums text-faint-foreground">{commitCount}</span>,
                }),
              },
            ]}
          />
        </div>
      }
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" onKeyDown={onKeyDown}>
        <PageColumn className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          <PushBanner sessionId={sessionId} push={push} />
          {launch !== null && (
            <ReviewLaunchStrip
              key={launch.threadIds.join(',')}
              sessionId={sessionId}
              threadIds={launch.threadIds}
              onClose={closeLaunch}
              onStarted={onLaunchStarted}
            />
          )}
          {started !== null && launch === null && (
            <p role="status" className="text-secondary text-muted-foreground">
              {startedLine({ count: started.count, modelName: started.model })}
            </p>
          )}
          {refreshError !== null && !isWholeError && (
            <ErrorStrip
              label={resolveQueueRefreshLabel({ provider: provider ?? 'GitHub' })}
              error={new Error(refreshError)}
              onRetry={retry}
            />
          )}
          {reviewTarget?.status === 'pending' && (
            <p role="status" className="text-secondary text-muted-foreground">
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
          {body()}
        </PageColumn>
      </div>
    </PaneShell>
  );
};
