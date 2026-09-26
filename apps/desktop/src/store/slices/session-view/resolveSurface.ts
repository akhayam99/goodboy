import type { AgentId, SessionId } from '@goodboy/types';
import { EMPTY_RESOLVE_QUEUE_VIEW, type GetFn, type ResolveQueueView, type SetFn } from './types';
import { agentPlace } from '../navigation/place';

type ViewParams = {
  readonly sessionId: SessionId;
  readonly patch: Partial<ResolveQueueView>;
};

type OpenParams = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly sha: string;
  readonly path: string | null;
  readonly line: number | null;
  readonly order: ReadonlyArray<string>;
  readonly scrollTop: number;
};

type ReturnParams = { readonly sessionId: SessionId };
type AgentParams = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly threadId: string;
  readonly prNumber: number;
};
type PublicationParams = {
  readonly sessionId: SessionId;
  readonly threadId: string;
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
  return ({ sessionId, threadId, sha, path, line, order, scrollTop }: OpenParams): void => {
    set((s) => ({
      resolveQueueView: {
        ...s.resolveQueueView,
        [sessionId]: {
          ...(s.resolveQueueView[sessionId] ?? EMPTY_RESOLVE_QUEUE_VIEW),
          order,
          scrollTop,
        },
      },
      resolveDiffReturn: { ...s.resolveDiffReturn, [sessionId]: { threadId, path, line } },
    }));
    get().openDiffLens(sessionId, { kind: 'commit', sha, path });
  };
};

export const returnFromResolveDiff = (set: SetFn, get: GetFn) => {
  return ({ sessionId }: ReturnParams): void => {
    set((s) => ({ resolveDiffReturn: { ...s.resolveDiffReturn, [sessionId]: null } }));
    get().back();
  };
};

export const openResolvePublication = (set: SetFn, get: GetFn) => {
  return ({ sessionId, threadId, reconcile }: PublicationParams): void => {
    get().closeDrawer();
    set((s) => ({
      resolvePublicationReturn: {
        ...s.resolvePublicationReturn,
        [sessionId]: {
          threadId,
          reconcile,
          requestId: (s.resolvePublicationReturn[sessionId]?.requestId ?? 0) + 1,
        },
      },
    }));
  };
};

export const returnFromResolvePublication = (set: SetFn, get: GetFn) => {
  return ({ sessionId }: ReturnParams): void => {
    const target = get().resolvePublicationReturn[sessionId] ?? null;
    if (target === null) {
      return;
    }
    set((s) => ({
      resolvePublicationReturn: { ...s.resolvePublicationReturn, [sessionId]: null },
    }));
    get().openDrawer({ kind: 'conversation', sessionId, payload: { threadId: target.threadId } });
  };
};

export const openResolveAgent = (set: SetFn, get: GetFn) => {
  return ({ sessionId, agentId, threadId, prNumber }: AgentParams): void => {
    set((s) => ({
      resolveAgentReturn: {
        ...s.resolveAgentReturn,
        [sessionId]: {
          agentId,
          threadId,
          prNumber,
          view: s.resolveQueueView[sessionId] ?? EMPTY_RESOLVE_QUEUE_VIEW,
        },
      },
    }));
    get().navigate({ to: agentPlace({ sessionId, agentId }) });
  };
};

export const returnFromResolveAgent = (set: SetFn, get: GetFn) => {
  return ({ sessionId }: ReturnParams): void => {
    const origin = get().resolveAgentReturn[sessionId] ?? null;
    if (origin === null) {
      return;
    }
    set((s) => ({
      resolveQueueView: { ...s.resolveQueueView, [sessionId]: origin.view },
      resolveAgentReturn: { ...s.resolveAgentReturn, [sessionId]: null },
    }));
    get().back();
  };
};
