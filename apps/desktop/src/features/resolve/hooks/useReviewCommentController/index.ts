import { useCallback, useEffect, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { isReportedError } from '../../../../store/slices/notifications/reportedError';
import { runObjectAction } from '../../../actions/registry';
import { useActionEnv } from '../../../actions/useActionEnv';
import { REVIEW_REQUEST_EVENT, isReviewRequest } from '../../../review/reviewRequest';
import type { ReviewComposeMode } from '../../../review/reviewRequest';
import type { ReviewEntry } from '../../components/ReviewFlow/useReviewEntries';
import { RESOLVE_ITEM_LABEL } from '../../resolveItemCopy';
import { useResolveAgain } from '../useResolveAgain';

export type ReviewCompose = {
  readonly threadId: string;
  readonly mode: ReviewComposeMode;
  readonly text: string;
};

export type ReviewCommentBinding = {
  readonly compose: ReviewCompose | null;
  readonly isEditingReply: boolean;
  readonly isSubmitting: boolean;
  readonly pendingActionId: string | null;
  readonly error: string | null;
  readonly onRun: (actionId: string) => void;
  readonly onComposeChange: (text: string) => void;
  readonly onComposeSubmit: () => void;
  readonly onComposeCancel: () => void;
  readonly onEditReply: () => void;
  readonly onReplyDone: () => void;
};

export type ReviewCommentController = {
  readonly compose: ReviewCompose | null;
  readonly editingReplyId: string | null;
  readonly bind: (threadId: string) => ReviewCommentBinding;
  readonly runVerb: (params: {
    readonly threadId: string;
    readonly actionId: string;
  }) => Promise<void>;
  readonly retryRun: (threadId: string) => Promise<void>;
  readonly resetFor: (threadId: string) => void;
  readonly setError: (threadId: string, message: string | null) => void;
};

type Params = {
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<ReviewEntry>;
  readonly threadIds?: ReadonlyArray<string>;
  readonly onFocus?: (threadId: string) => void;
  readonly onAdvance?: (threadId: string) => void;
};

const ADVANCING = new Set([
  'reviewComment.accept',
  'reviewComment.skip',
  'reviewComment.resolveNoReply',
]);

export const COULD_NOT_SEND =
  'This comment is no longer on the pull request, so the agent cannot be asked about it';

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

export const useReviewCommentController = ({
  sessionId,
  entries,
  threadIds,
  onFocus,
  onAdvance,
}: Params): ReviewCommentController => {
  const env = useActionEnv({ origin: 'button' });
  const refuseResolveQueueItem = useAppStore((s) => s.refuseResolveQueueItem);
  const requestAttempt = useResolveAgain({
    sessionId,
    rows: entries.map((entry) => entry.row),
  });
  const [compose, setCompose] = useState<ReviewCompose | null>(null);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ threadId: string; actionId: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const onFocusRef = useRef(onFocus);
  const onAdvanceRef = useRef(onAdvance);
  onFocusRef.current = onFocus;
  onAdvanceRef.current = onAdvance;
  const scopeKey = threadIds === undefined ? null : threadIds.join('\u0000');

  const resetFor = useCallback((threadId: string): void => {
    setCompose((current) => (current?.threadId === threadId ? current : null));
    setEditingReplyId(null);
  }, []);

  const setError = useCallback((threadId: string, message: string | null): void => {
    setErrors((current) => {
      const { [threadId]: _dropped, ...rest } = current;
      return message === null ? rest : { ...rest, [threadId]: message };
    });
  }, []);

  const advance = useCallback((threadId: string | null): void => {
    if (threadId !== null) {
      onAdvanceRef.current?.(threadId);
    }
  }, []);

  const runVerb = useCallback(
    async ({ threadId, actionId }: { readonly threadId: string; readonly actionId: string }) => {
      if (pending !== null) {
        return;
      }
      const advanceTo =
        ADVANCING.has(actionId) && onAdvanceRef.current !== undefined
          ? nextOpenAfter({ entries, threadId })
          : null;
      setPending({ threadId, actionId });
      setError(threadId, null);
      try {
        await runObjectAction({
          target: { kind: 'reviewComment', sessionId, threadId },
          actionId,
          env,
        });
        advance(advanceTo);
      } catch (caught) {
        if (!isReportedError(caught)) {
          setError(threadId, formatError(caught));
        }
      } finally {
        setPending(null);
      }
    },
    [advance, entries, env, pending, sessionId, setError],
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
        const next =
          onAdvanceRef.current === undefined
            ? null
            : nextOpenAfter({ entries, threadId: entry.threadId });
        setCompose(null);
        advance(next);
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
    advance,
    compose,
    entries,
    isSubmitting,
    refuseResolveQueueItem,
    requestAttempt,
    sessionId,
    setError,
  ]);

  useEffect(() => {
    const owned = scopeKey === null ? null : new Set(scopeKey.split('\u0000'));
    const onRequest = (event: Event): void => {
      if (!isReviewRequest(event) || event.defaultPrevented) {
        return;
      }
      if (event.detail.sessionId !== sessionId) {
        return;
      }
      const { request } = event.detail;
      if (request.kind !== 'compose' && request.kind !== 'edit_reply') {
        return;
      }
      if (owned !== null && !owned.has(request.threadId)) {
        return;
      }
      event.preventDefault();
      onFocusRef.current?.(request.threadId);
      if (request.kind === 'compose') {
        setCompose({ threadId: request.threadId, mode: request.mode, text: '' });
        return;
      }
      setEditingReplyId(request.threadId);
    };
    window.addEventListener(REVIEW_REQUEST_EVENT, onRequest, owned !== null);
    return () => window.removeEventListener(REVIEW_REQUEST_EVENT, onRequest, owned !== null);
  }, [scopeKey, sessionId]);

  const bind = (threadId: string): ReviewCommentBinding => ({
    compose: compose?.threadId === threadId ? compose : null,
    isEditingReply: editingReplyId === threadId,
    isSubmitting,
    pendingActionId: pending?.threadId === threadId ? pending.actionId : null,
    error: errors[threadId] ?? null,
    onRun: (actionId) => void runVerb({ threadId, actionId }),
    onComposeChange: (text) =>
      setCompose((current) => (current === null ? current : { ...current, text })),
    onComposeSubmit: () => void submitCompose(),
    onComposeCancel: () => setCompose(null),
    onEditReply: () => setEditingReplyId(threadId),
    onReplyDone: () => setEditingReplyId(null),
  });

  return { compose, editingReplyId, bind, runVerb, retryRun, resetFor, setError };
};
