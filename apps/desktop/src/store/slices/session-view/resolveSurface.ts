import type { SessionId } from '@goodboy/types';
import { EMPTY_RESOLVE_QUEUE_VIEW, type GetFn, type ResolveQueueView, type SetFn } from './types';

type ViewParams = {
  readonly sessionId: SessionId;
  readonly patch: Partial<ResolveQueueView>;
};

type OpenParams = {
  readonly sessionId: SessionId;
  readonly sha: string;
  readonly path: string | null;
  readonly order: ReadonlyArray<string>;
  readonly scrollTop: number;
};

type PublicationParams = {
  readonly sessionId: SessionId;
  readonly reconcile: boolean;
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

export const openResolveDiff = (set: SetFn, get: GetFn) => {
  return ({ sessionId, sha, path, order, scrollTop }: OpenParams): void => {
    set((s) => ({
      resolveQueueView: {
        ...s.resolveQueueView,
        [sessionId]: {
          ...(s.resolveQueueView[sessionId] ?? EMPTY_RESOLVE_QUEUE_VIEW),
          order,
          scrollTop,
        },
      },
    }));
    get().openDiffLens(sessionId, { kind: 'commit', sha, path });
  };
};

export const openResolvePublication = (set: SetFn, get: GetFn) => {
  return ({ sessionId, reconcile }: PublicationParams): void => {
    get().closeDrawer();
    set((s) => ({
      resolvePublicationRequest: {
        ...s.resolvePublicationRequest,
        [sessionId]: {
          reconcile,
          requestId: (s.resolvePublicationRequest[sessionId]?.requestId ?? 0) + 1,
        },
      },
    }));
  };
};
