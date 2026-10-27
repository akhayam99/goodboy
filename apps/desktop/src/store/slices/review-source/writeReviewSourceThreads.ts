import type { SessionId } from '@goodboy/types';
import type { ReviewSourceThreads, SetFn } from './types';

export const THREADS_TTL_MS = 30_000;

const EMPTY_SOURCE_THREADS: ReviewSourceThreads = {
  comments: [],
  fetchedAt: null,
  loading: false,
  error: null,
};

type PatchParams = {
  readonly current: ReviewSourceThreads;
};

type Params = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly key: string;
  readonly patch: (params: PatchParams) => ReviewSourceThreads;
};

export const writeReviewSourceThreads = ({ set, sessionId, key, patch }: Params): void =>
  set((state) => ({
    reviewSourceThreads: {
      ...state.reviewSourceThreads,
      [sessionId]: {
        ...state.reviewSourceThreads[sessionId],
        [key]: patch({
          current: state.reviewSourceThreads[sessionId]?.[key] ?? EMPTY_SOURCE_THREADS,
        }),
      },
    },
  }));
