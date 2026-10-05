import { useCallback, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import { REVIEW_SOURCE_LABEL } from '@goodboy/core';
import type {
  MountId,
  ResolvePublication,
  ResolvePublicationPreview,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { agentPlace } from '../../../../../store/slices/navigation/place';
import { selectActiveMount } from '../../../../../store/slices/project-mounts/selectors';
import { isRemoteMovedError } from '../../../../../store/slices/resolve/remoteMovedError';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
import { SYNC_COPY } from '../../../failedRunCopy';
import { useActiveReviewSource } from '../../../hooks/useActiveReviewSource';
import type { BlockerCopy } from '../../../resolvePublishCopy';
import {
  PUSH_BUSY,
  pushFailedSentence,
  pushResultOf,
  type PushResult,
} from '../../../reviewPushCopy';

type ReviewPushPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'preparing' }
  | { readonly kind: 'confirm'; readonly preview: ResolvePublicationPreview }
  | { readonly kind: 'pushing'; readonly preview: ResolvePublicationPreview }
  | { readonly kind: 'sync_confirm' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'result'; readonly result: PushResult };

type ArmParams = {
  readonly isRetry: boolean;
  readonly threadIds?: ReadonlyArray<string> | undefined;
};

export type ReviewPush = {
  readonly phase: ReviewPushPhase;
  readonly arm: (params: ArmParams) => Promise<void>;
  readonly confirm: () => Promise<void>;
  readonly cancel: () => void;
  readonly askSync: () => void;
  readonly confirmSync: () => Promise<void>;
  readonly dismiss: () => void;
  readonly recover: (action: NonNullable<BlockerCopy['action']>) => void;
};

const IDLE: ReviewPushPhase = { kind: 'idle' };

const failed = (sentence: string, canSync = false): ReviewPushPhase => ({
  kind: 'result',
  result: { tone: 'failed', sentence, ...(canSync && { canSync }) },
});

const syncMountIdOf = ({ sessionId }: { readonly sessionId: SessionId }): MountId | null => {
  const state = useAppStore.getState();
  const latest = (
    state.sessionResolvePublications[sessionId] ?? []
  ).reduce<ResolvePublication | null>(
    (best, candidate) =>
      candidate.mountTarget !== null && (best === null || candidate.createdAt >= best.createdAt)
        ? candidate
        : best,
    null,
  );
  return latest?.mountTarget?.mountId ?? selectActiveMount({ state, sessionId })?.mountId ?? null;
};

type PushParams = {
  readonly sessionId: SessionId;
};

export const useReviewPush = ({ sessionId }: PushParams): ReviewPush => {
  const preparePublication = useAppStore((s) => s.preparePublication);
  const retryPublication = useAppStore((s) => s.retryPublication);
  const publishConversations = useAppStore((s) => s.publishConversations);
  const cancelPublication = useAppStore((s) => s.cancelPublication);
  const syncBranchWithRemote = useAppStore((s) => s.syncBranchWithRemote);
  const openDiffLens = useAppStore((s) => s.openDiffLens);
  const navigate = useAppStore((s) => s.navigate);
  const [phase, setPhase] = useState<ReviewPushPhase>(IDLE);
  const armedThreadIds = useRef<ReadonlyArray<string> | undefined>(undefined);
  const { source } = useActiveReviewSource({ sessionId });
  const provider = REVIEW_SOURCE_LABEL[source?.kind ?? 'github'];

  const arm = useCallback(
    async ({ isRetry, threadIds }: ArmParams): Promise<void> => {
      armedThreadIds.current = threadIds;
      setPhase({ kind: 'preparing' });
      try {
        const preview =
          threadIds !== undefined
            ? await preparePublication({ sessionId, threadIds, isolated: true })
            : isRetry
              ? await retryPublication({ sessionId })
              : await preparePublication({ sessionId });
        const isEmpty =
          preview.publicationId === null && preview.blocker === null && preview.drift.length === 0;
        setPhase(
          isEmpty
            ? {
                kind: 'result',
                result: { tone: 'done', sentence: 'Nothing is waiting for the push.' },
              }
            : { kind: 'confirm', preview },
        );
      } catch (error) {
        setPhase(isReportedError(error) ? IDLE : failed(formatError(error)));
      }
    },
    [preparePublication, retryPublication, sessionId],
  );

  const confirm = useCallback(async (): Promise<void> => {
    if (phase.kind !== 'confirm') {
      return;
    }
    const { preview } = phase;
    const { publicationId } = preview;
    if (publicationId === null) {
      return;
    }
    setPhase({ kind: 'pushing', preview });
    try {
      const result = await publishConversations({ sessionId, publicationId });
      switch (result.kind) {
        case 'done':
          setPhase({ kind: 'result', result: pushResultOf({ outcome: result, provider }) });
          return;
        case 'push_failed':
          setPhase(
            failed(
              pushFailedSentence({ error: result.error }),
              isRemoteMovedError({ error: result.error }),
            ),
          );
          return;
        case 'busy':
          setPhase(failed(PUSH_BUSY));
          return;
        case 'stale':
          setPhase({ kind: 'confirm', preview: result.preview });
          return;
        case 'missing':
          setPhase(IDLE);
          return;
        default: {
          const exhaustive: never = result;
          return exhaustive;
        }
      }
    } catch (error) {
      setPhase(isReportedError(error) ? IDLE : failed(formatError(error)));
    }
  }, [phase, provider, publishConversations, sessionId]);

  const cancel = useCallback((): void => {
    const publicationId = phase.kind === 'confirm' ? phase.preview.publicationId : null;
    setPhase(IDLE);
    if (publicationId !== null) {
      void cancelPublication({ sessionId, publicationId }).catch(() => undefined);
    }
  }, [cancelPublication, phase, sessionId]);

  const askSync = useCallback((): void => setPhase({ kind: 'sync_confirm' }), []);

  const confirmSync = useCallback(async (): Promise<void> => {
    const mountId = syncMountIdOf({ sessionId });
    if (mountId === null) {
      setPhase(failed(SYNC_COPY.noBranch));
      return;
    }
    setPhase({ kind: 'syncing' });
    try {
      const outcome = await syncBranchWithRemote({ sessionId, mountId });
      switch (outcome.kind) {
        case 'synced':
        case 'nothing':
          await arm({ isRetry: true, threadIds: armedThreadIds.current });
          return;
        case 'conflict':
          setPhase(failed(SYNC_COPY.conflict));
          return;
        case 'busy':
          setPhase(failed(PUSH_BUSY));
          return;
        case 'failed':
          setPhase(failed(outcome.message));
          return;
        default: {
          const exhaustive: never = outcome;
          return exhaustive;
        }
      }
    } catch (error) {
      setPhase(isReportedError(error) ? IDLE : failed(formatError(error)));
    }
  }, [arm, sessionId, syncBranchWithRemote]);

  const recover = useCallback(
    (action: NonNullable<BlockerCopy['action']>): void => {
      if (action === 'see_missing') {
        const state = useAppStore.getState();
        const facts = state.sessionThreadGit[sessionId] ?? {};
        const threadId =
          Object.entries(facts).find(
            ([, item]) => item.gitState === 'missing' && item.missing?.wasPushed !== true,
          )?.[0] ?? null;
        setPhase(IDLE);
        if (threadId !== null) {
          state.openDrawer({ kind: 'conversation', sessionId, payload: { threadId } });
        }
        return;
      }
      if (action === 'sync') {
        setPhase({ kind: 'sync_confirm' });
        return;
      }
      if (action === 'view_work') {
        const attempts = useAppStore.getState().sessionResolveAttempts[sessionId] ?? [];
        const latest = attempts.reduce<(typeof attempts)[number] | null>(
          (best, candidate) =>
            best === null || candidate.createdAt >= best.createdAt ? candidate : best,
          null,
        );
        if (latest !== null) {
          navigate({ to: agentPlace({ sessionId, agentId: latest.agentId }) });
        }
        return;
      }
      openDiffLens(sessionId, { kind: 'working', path: null });
    },
    [arm, navigate, openDiffLens, sessionId],
  );

  return {
    phase,
    arm,
    confirm,
    cancel,
    askSync,
    confirmSync,
    dismiss: useCallback(() => setPhase(IDLE), []),
    recover,
  };
};
