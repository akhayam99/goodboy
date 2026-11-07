import type { SessionId } from '@goodboy/types';
import { EMPTY_RESOLVE_QUEUE_VIEW, type ResolveQueueView, type SetFn } from './types';

type ViewParams = {
  readonly sessionId: SessionId;
  readonly patch: Partial<ResolveQueueView>;
};

export const setResolveQueueView = (set: SetFn) => {
  return ({ sessionId, patch }: ViewParams): void => {
    set((s) => ({
      resolveQueueView: {
        ...s.resolveQueueView,
        [sessionId]: {
          ...(s.resolveQueueView[sessionId] ?? EMPTY_RESOLVE_QUEUE_VIEW),
          ...patch,
        },
      },
    }));
  };
};
