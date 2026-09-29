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
import { isPushFailure } from '../../reviewCommentState';
import { ReviewEmptyState } from './ReviewEmptyState';
import { ReviewComment, type ReviewCompose } from './ReviewComment';
import { ReviewHeaderActions } from './ReviewHeaderActions';
import { ReviewHeaderMeta } from './ReviewHeaderMeta';
import { PushBanner } from './PushBanner';
import { ReviewList } from './ReviewList';
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
  ['review.draft', ['reviewComment.draft']],
];

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
  const settleResolveSourceChange = useAppStore((s) => s.settleResolveSourceChange);
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
  const listRef = useRef<HTMLDivElement | null>(null);
  const hasPr = github?.pr != null;
  const push = useReviewPush({ sessionId });
  const hasPushFailure = entries.some((entry) => isPushFailure({ row: entry.row }));
  const isPushBusy = push.phase.kind === 'preparing' || push.phase.kind === 'pushing';

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
      const index = entries.findIndex((entry) => entry.threadId === focusedThreadId);
      const next = entries[index + delta];
      if (next === undefined) {
        return;
      }
      select(next.threadId);
      focusRow(next.threadId);
    },
    [entries, focusRow, focusedThreadId, select],
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
        await settleResolveSourceChange({
          sessionId,
          threadId: entry.threadId,
          keepDraft: false,
        });
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
    settleResolveSourceChange,
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
  }, [hasPushFailure, isPushBusy, push, select, sessionId]);

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
    if (focusedThreadId === null) {
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
      if (shortcut === 'review.draft') {
        event.preventDefault();
        void runObjectAction({
          target: { kind: 'review', sessionId },
          actionId: 'review.draftFixes',
          env,
        }).catch((caught: unknown) => setError(focusedThreadId, formatError(caught)));
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
        <ScrollFade
          className="hidden min-h-0 w-[300px] shrink-0 @4xl:block"
          viewportClassName="pb-5 pr-2"
          fadeSize="h-6"
        >
          <div ref={listRef}>
            <ReviewList groups={groups} focusedThreadId={focusedThreadId} onSelect={select} />
          </div>
        </ScrollFade>
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
