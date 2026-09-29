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
  Skeleton,
  formatError,
} from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { eventMatches } from '../../../../shared/keyboard/dispatcher';
import { SHORTCUTS, type ShortcutId } from '../../../../shared/keyboard/registry';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { reviewThreadId } from '../../../../store/slices/review-navigation';
import { bindTarget, runObjectAction } from '../../../actions/registry';
import { useActionEnv } from '../../../actions/useActionEnv';
import { openReview } from '../../../review/openReview';
import {
  REVIEW_TARGET_REASON_COPY,
  reviewTargetErrorLabel,
  reviewTargetPending,
} from '../../../review/reviewTargetCopy';
import { REVIEW_REQUEST_EVENT, isReviewRequest } from '../../../review/reviewRequest';
import { useResolveAgain } from '../../hooks/useResolveAgain';
import { RESOLVE_ITEM_LABEL } from '../../resolveItemCopy';
import { RESOLVE_QUEUE_REFRESH_LABEL } from '../../resolveQueueCopy';
import { REVIEW_FLOW_LABEL, REVIEW_TITLE, counterLabel } from '../../reviewFlowCopy';
import { startedLine } from '../../reviewLaunchCopy';
import {
  isPushFailure,
  matchesReviewStateFilter,
  type ReviewStateFilter,
} from '../../reviewCommentState';
import { ReviewEmptyState } from './ReviewEmptyState';
import { ReviewComment, type ReviewCompose } from './ReviewComment';
import { ReviewHeaderActions } from './ReviewHeaderActions';
import { ReviewHeaderMeta } from './ReviewHeaderMeta';
import { PushBanner } from './PushBanner';
import { ReviewLaunchStrip } from './ReviewLaunchStrip';
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

const ADVANCING = new Set([
  'reviewComment.accept',
  'reviewComment.skip',
  'reviewComment.resolveNoReply',
]);

const COMMENT_KEYS: ReadonlyArray<readonly [ShortcutId, ReadonlyArray<string>]> = [
  ['review.accept', ['reviewComment.accept']],
  ['review.edit', ['reviewComment.answer', 'reviewComment.edit']],
  ['review.reply', ['reviewComment.reply']],
  ['review.skip', ['reviewComment.skip']],
  ['review.undo', ['reviewComment.undo']],
  ['review.fix', ['reviewComment.draft']],
];

type ReviewLaunch = {
  readonly threadIds: ReadonlyArray<string>;
};

type StartedNote = {
  readonly count: number;
  readonly model: string;
};

const COULD_NOT_SEND =
  'This comment is no longer on the pull request, so the agent cannot be asked about it';

const SKELETON_ROWS = [0, 1, 2];

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

const nextOpenAfter = ({
  entries,
  threadId,
}: {
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly threadId: string;
}): string | null => {
  const open = entries.filter((entry) => entry.group === 'open');
  const index = open.findIndex((entry) => entry.threadId === threadId);
  if (index === -1) {
    return open[0]?.threadId ?? null;
  }
  return open[index + 1]?.threadId ?? open[index - 1]?.threadId ?? null;
};

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
  const selectedIds = useMemo(
    () => (storedSelection ?? []).filter((threadId) => fixableIds.has(threadId)),
    [fixableIds, storedSelection],
  );
  const checked = useMemo(() => new Set(selectedIds), [selectedIds]);
  const github = useAppStore((s) => s.sessionGithub[sessionId] ?? null);
  const selectedThreadId = useAppStore((s) =>
    s.drawer?.kind === 'conversation' && s.drawer.sessionId === sessionId
      ? s.drawer.payload.threadId
      : null,
  );
  const openDrawer = useAppStore((s) => s.openDrawer);
  const loadResolveSession = useAppStore((s) => s.loadResolveSession);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const refuseResolveQueueItem = useAppStore((s) => s.refuseResolveQueueItem);
  const reviewTarget = useAppStore((s) => s.reviewTargets[sessionId] ?? null);
  const consumeReviewTarget = useAppStore((s) => s.consumeReviewTarget);
  const requestAttempt = useResolveAgain({
    sessionId,
    rows: useMemo(() => entries.map((entry) => entry.row), [entries]),
  });
  const [compose, setCompose] = useState<ReviewCompose | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ threadId: string; actionId: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [modelPickerRequest, setModelPickerRequest] = useState(0);
  const [launch, setLaunch] = useState<ReviewLaunch | null>(null);
  const [started, setStarted] = useState<StartedNote | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const hasPr = github?.pr != null;
  const push = useReviewPush({ sessionId });
  const hasPushFailure = entries.some((entry) => isPushFailure({ row: entry.row }));
  const isPushBusy =
    push.phase.kind === 'preparing' ||
    push.phase.kind === 'pushing' ||
    push.phase.kind === 'syncing';

  useEffect(() => {
    void loadResolveSession({ sessionId });
  }, [loadResolveSession, sessionId]);

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
      setCompose((current) => (current?.threadId === threadId ? current : null));
      setEditingReplyId(null);
    },
    [consumeReviewTarget, openDrawer, reviewTarget, sessionId],
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

  const setError = useCallback((threadId: string, message: string | null): void => {
    setErrors((current) => {
      const { [threadId]: _dropped, ...rest } = current;
      return message === null ? rest : { ...rest, [threadId]: message };
    });
  }, []);

  const runVerb = useCallback(
    async ({ threadId, actionId }: { readonly threadId: string; readonly actionId: string }) => {
      if (pending !== null) {
        return;
      }
      const advanceTo = ADVANCING.has(actionId) ? nextOpenAfter({ entries, threadId }) : null;
      setPending({ threadId, actionId });
      setError(threadId, null);
      try {
        await runObjectAction({
          target: { kind: 'reviewComment', sessionId, threadId },
          actionId,
          env,
        });
        if (advanceTo !== null) {
          select(advanceTo);
          focusRow(advanceTo);
        }
      } catch (caught) {
        if (!isReportedError(caught)) {
          setError(threadId, formatError(caught));
        }
      } finally {
        setPending(null);
      }
    },
    [entries, env, focusRow, pending, select, sessionId, setError],
  );

  const retryRun = useCallback(
    async (threadId: string): Promise<void> => {
      if (isSubmitting) {
        return;
      }
      setIsSubmitting(true);
      setError(threadId, null);
      try {
        const outcome = await requestAttempt({
          threadId,
          instruction: RESOLVE_ITEM_LABEL.rereadInstruction,
        });
        if (outcome === 'missing') {
          throw new Error(COULD_NOT_SEND);
        }
      } catch (caught) {
        if (!isReportedError(caught)) {
          setError(threadId, formatError(caught));
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, requestAttempt, setError],
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

  const submitCompose = useCallback(async (): Promise<void> => {
    if (compose === null || isSubmitting) {
      return;
    }
    const entry = entries.find((candidate) => candidate.threadId === compose.threadId);
    if (entry === undefined) {
      setCompose(null);
      return;
    }
    const text = compose.text.trim();
    setIsSubmitting(true);
    setError(entry.threadId, null);
    try {
      if (compose.mode === 'reply') {
        await refuseResolveQueueItem({
          sessionId,
          itemId: entry.row.item.id,
          revision: entry.row.thread.revision,
          reply: text,
        });
        const next = nextOpenAfter({ entries, threadId: entry.threadId });
        setCompose(null);
        if (next !== null) {
          select(next);
          focusRow(next);
        }
        return;
      }
      const outcome = await requestAttempt({
        threadId: entry.threadId,
        instruction: text === '' ? RESOLVE_ITEM_LABEL.rereadInstruction : text,
      });
      if (outcome === 'missing') {
        throw new Error(COULD_NOT_SEND);
      }
      if (outcome === 'started') {
        setCompose(null);
      }
    } catch (caught) {
      if (!isReportedError(caught)) {
        setError(entry.threadId, formatError(caught));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    compose,
    entries,
    focusRow,
    isSubmitting,
    refuseResolveQueueItem,
    requestAttempt,
    select,
    sessionId,
    setError,
  ]);

  useEffect(() => {
    const onRequest = (event: Event): void => {
      if (!isReviewRequest(event) || event.defaultPrevented) {
        return;
      }
      if (event.detail.sessionId !== sessionId) {
        return;
      }
      const { request } = event.detail;
      if (request.kind === 'compose') {
        event.preventDefault();
        select(request.threadId);
        setCompose({ threadId: request.threadId, mode: request.mode, text: '' });
        return;
      }
      if (request.kind === 'fix') {
        event.preventDefault();
        openLaunch(request.threadIds);
        return;
      }
      if (request.kind === 'edit_reply') {
        event.preventDefault();
        select(request.threadId);
        setEditingReplyId(request.threadId);
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
    const threadId = reviewThreadId({ destination: reviewTarget.destination });
    if (threadId !== null && !entries.some((entry) => entry.threadId === threadId)) {
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
    if (isEditable(event.target) || compose !== null || editingReplyId !== null) {
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
    if (eventMatches({ event: native, entry: SHORTCUTS['review.fix'] }) && selectedIds.length > 0) {
      event.preventDefault();
      openLaunch(selectedIds);
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
        void retryRun(focusedThreadId);
        return;
      }
      return;
    }
  };

  const refreshError = hasPr ? (github.detailError ?? null) : null;
  const isLoading = hasPr && github.detail === null && github.detailLoading;
  const isWholeError = hasPr && github.detail === null && refreshError !== null;
  const targetThreadId =
    reviewTarget === null ? null : reviewThreadId({ destination: reviewTarget.destination });
  const targetError =
    reviewTarget === null
      ? null
      : reviewTarget.status === 'unavailable' && reviewTarget.reason !== null
        ? REVIEW_TARGET_REASON_COPY[reviewTarget.reason]
        : reviewTarget.status === 'failed'
          ? reviewTarget.error
          : null;
  const retry = (): void => void refreshSessionPrDetail(sessionId, { force: true });
  const index = entries.findIndex((entry) => entry.threadId === focusedThreadId);

  const body = (): ReactNode => {
    if (isWholeError && refreshError !== null) {
      return (
        <EmptyState
          icon={AlertTriangle}
          tone="danger"
          title="Couldn't read comments from GitHub"
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
    if (focused === null) {
      return <ReviewEmptyState hasPr={hasPr} />;
    }
    return (
      <div className="flex min-h-0 min-w-0 flex-1 gap-8">
        <div className="hidden min-h-0 w-[300px] shrink-0 flex-col @4xl:flex">
          {selectedIds.length > 0 ? (
            <ReviewSelectionBar
              count={selectedIds.length}
              onClear={() => clearReviewSelection({ sessionId })}
              onFix={() => openLaunch(selectedIds)}
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
            compose={compose?.threadId === focused.threadId ? compose : null}
            isEditingReply={editingReplyId === focused.threadId}
            isSubmitting={isSubmitting}
            pendingActionId={pending?.threadId === focused.threadId ? pending.actionId : null}
            error={errors[focused.threadId] ?? null}
            onRun={(actionId) => void runVerb({ threadId: focused.threadId, actionId })}
            onComposeChange={(text) =>
              setCompose((current) => (current === null ? current : { ...current, text }))
            }
            onComposeSubmit={() => void submitCompose()}
            onComposeCancel={() => setCompose(null)}
            onEditReply={() => setEditingReplyId(focused.threadId)}
            onReplyDone={() => setEditingReplyId(null)}
            onSelect={select}
            onTryAgain={() => void retryRun(focused.threadId)}
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
        />
      }
      subheader={
        <div className="pl-6">
          <ReviewHeaderMeta
            sessionId={sessionId}
            entries={entries}
            noPullRequestLine={noPullRequestLine}
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
              label={RESOLVE_QUEUE_REFRESH_LABEL}
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
