import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { threadMountIdOf } from '../../store/slices/review-source/threadMountIdOf';
import type { ReviewTargetOutcome } from '../../store/slices/review-navigation';
import { noteIdOfThread } from '../resolve/notes/noteThread';
import { openReview } from './openReview';
import { pullRequestNumberFromUrl } from './pullRequestNumberFromUrl';

type Params = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly prUrl?: string | null;
};

type State = ReturnType<typeof useAppStore.getState>;

type IdentityParams = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly prUrl: string | null;
};

const prNumberFor = ({ state, sessionId, threadId, prUrl }: IdentityParams): number | null => {
  const linked = prUrl === null ? null : pullRequestNumberFromUrl({ url: prUrl });
  const row =
    (state.sessionResolveThreads[sessionId] ?? []).find(
      (candidate) => candidate.threadId === threadId,
    ) ?? null;
  const attempt =
    (state.sessionResolveAttempts[sessionId] ?? []).find((candidate) =>
      candidate.threadIds.includes(threadId),
    ) ?? null;
  return (
    linked ??
    row?.prNumber ??
    attempt?.prNumber ??
    state.sessionSelectedPrNumber[sessionId] ??
    state.sessionGithub[sessionId]?.pr?.number ??
    null
  );
};

export const openReviewThread = ({
  sessionId,
  threadId,
  prUrl = null,
}: Params): Promise<ReviewTargetOutcome> => {
  const state = useAppStore.getState();
  const noteId = noteIdOfThread({ threadId });
  if (noteId !== null) {
    const mountId = threadMountIdOf({ state, sessionId, threadId });
    return openReview({
      sessionId,
      destination:
        mountId === null
          ? { kind: 'notes', threadIds: [threadId] }
          : { kind: 'threads', mountId, threadIds: [threadId] },
    });
  }
  const prNumber = prNumberFor({ state, sessionId, threadId, prUrl });
  if (prNumber === null) {
    return Promise.resolve({ kind: 'unavailable', reason: 'no_pull_request' });
  }
  return openReview({
    sessionId,
    destination: {
      kind: 'thread',
      mountId: threadMountIdOf({ state, sessionId, threadId, prNumber }),
      prNumber,
      threadId,
    },
  });
};
