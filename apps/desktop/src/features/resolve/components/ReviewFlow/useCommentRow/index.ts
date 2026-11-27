import { useMemo } from 'react';
import type { ResolveCandidate, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { launchKeyOf } from '../../../../../store/slices/resolve/resolveLaunch';
import type { ResolveCandidateWithItems } from '../../../../../store/slices/resolve/state';
import { usePendingAction } from '../../../../../shared/hooks/usePendingAction';
import { threadMountIdOf } from '../../../../../store/slices/review-source/threadMountIdOf';
import { requestReview } from '../../../../review/reviewRequest';
import { commentRowResultOf, type CommentRowResult } from '../../../commentRowResultOf';
import { draftRoutingOf } from '../../../draftRouting';
import { causeOfAttempt } from '../../../failureSentence';
import { launchChoiceOf } from '../../../launchChoice';
import { selectResolveCandidate } from '../../../selectResolveCandidate';
import { startBatch } from '../../../startBatch';
import { useFixStartedToast } from '../../../hooks/useFixStartedToast';
import type { ReviewEntry } from '../useReviewEntries';

type Params = {
  readonly sessionId: SessionId;
  readonly entry: ReviewEntry;
};

export type CommentRow = {
  readonly result: CommentRowResult | null;
  readonly candidate: ResolveCandidate | null;
  readonly isStarting: boolean;
  readonly isApplying: boolean;
  readonly isDiscarding: boolean;
  readonly fix: () => void;
  readonly retry: () => void;
  readonly apply: () => void;
  readonly discard: () => void;
  readonly retryWithHint: () => void;
};

const NO_CANDIDATES: ReadonlyArray<ResolveCandidateWithItems> = [];

const COMMENT_ROW_FAILURE = {
  fix: "Couldn't start the fix",
  retry: "Couldn't retry the fix",
  apply: "Couldn't apply the fix",
  discard: "Couldn't discard the fix",
  noAttempt: 'This comment has no fix to retry. Start a new one with Fix',
} as const;

export const useCommentRow = ({ sessionId, entry }: Params): CommentRow => {
  const { threadId } = entry;
  const pending = usePendingAction({ sessionId });
  const announceStart = useFixStartedToast();
  const candidates = useAppStore((s) => s.sessionResolveCandidates[sessionId] ?? NO_CANDIDATES);
  const itemId = entry.row.item.id;
  const candidate = useMemo(
    () => selectResolveCandidate({ candidates, itemId }),
    [candidates, itemId],
  );
  const startKey = `comment.fix:${threadId}`;
  const applyKey = `comment.apply:${threadId}`;
  const discardKey = `comment.discard:${threadId}`;
  const isApplying = pending.pendingKeys.has(applyKey);
  const isDiscarding = pending.pendingKeys.has(discardKey);
  const attempt = entry.row.attempt;
  const result = commentRowResultOf({
    state: entry.state,
    resolveWord: entry.resolveWord,
    fix: entry.fix,
    isStopped: causeOfAttempt({ attempt }) === 'stopped',
    isPushing: entry.row.thread.stage === 'publishing',
  });
  const fix = (): void =>
    void pending.run({
      key: startKey,
      failureTitle: COMMENT_ROW_FAILURE.fix,
      task: async () => {
        const getState = useAppStore.getState;
        const mountId = threadMountIdOf({ state: getState(), sessionId, threadId });
        const started = await startBatch({
          getState,
          sessionId,
          threadIds: [threadId],
          ...(mountId !== null && { mountId }),
          launchChoice: launchChoiceOf({
            routing: draftRoutingOf({ state: getState(), sessionId }),
            commitStyle: null,
            hint: null,
          }),
        });
        announceStart({ sessionId, started, count: 1 });
      },
    });
  const retry = (): void =>
    void pending.run({
      key: startKey,
      failureTitle: COMMENT_ROW_FAILURE.retry,
      task: async () => {
        if (attempt === null) {
          throw new Error(COMMENT_ROW_FAILURE.noAttempt);
        }
        await useAppStore.getState().retryCouldntFix({
          sessionId,
          launchId: launchKeyOf({ attempt }),
          threadIds: [threadId],
        });
      },
    });
  const apply = (): void => {
    if (isDiscarding) {
      return;
    }
    void pending.run({
      key: applyKey,
      failureTitle: COMMENT_ROW_FAILURE.apply,
      task: async () => {
        const result = await useAppStore
          .getState()
          .acceptReviewComments({ sessionId, threadIds: [threadId] });
        const [failure] = result.failures;
        if (failure !== undefined) {
          throw new Error(failure.message);
        }
      },
    });
  };
  const worktreePath = candidate?.worktreePath ?? null;
  const discard = (): void => {
    if (isApplying) {
      return;
    }
    void pending.run({
      key: discardKey,
      failureTitle: COMMENT_ROW_FAILURE.discard,
      task: () => useAppStore.getState().discardProposedFix({ sessionId, threadId, worktreePath }),
    });
  };
  const retryWithHint = (): void =>
    requestReview({
      getState: useAppStore.getState,
      sessionId,
      request: { kind: 'compose', threadId, mode: 'redraft' },
    });
  return {
    result,
    candidate,
    isStarting: pending.pendingKeys.has(startKey),
    isApplying,
    isDiscarding,
    fix,
    retry,
    apply,
    discard,
    retryWithHint,
  };
};
