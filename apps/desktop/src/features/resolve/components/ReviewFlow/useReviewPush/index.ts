import { useCallback, useEffect, useRef, useState } from 'react';
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
import { driftSentence, type BlockerCopy } from '../../../resolvePublishCopy';
import { previewNeedsDecision } from '../../../previewNeedsDecision';
import { openReviewComment } from '../../../openReviewComment';
import {
  PUSH_BUSY,
  PUSH_MISSING,
  PUSH_STALE_FALLBACK,
  pushCommitCount,
  pushFailedSentence,
  pushResultOf,
  type PushResult,
} from '../../../reviewPushCopy';

type ReviewPushPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'preparing' }
  | {
      readonly kind: 'confirm';
      readonly preview: ResolvePublicationPreview;
      readonly changed?: string | undefined;
    }
  | {
      readonly kind: 'pushing';
      readonly preview: ResolvePublicationPreview;
      readonly hasPanel: boolean;
    }
  | { readonly kind: 'sync_confirm' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'result'; readonly result: PushResult };

type ArmParams = {
  readonly isRetry: boolean;
  readonly threadIds?: ReadonlyArray<string> | undefined;
};

type PressParams = {
  readonly isRetry: boolean;
};

export type ReviewPush = {
  readonly phase: ReviewPushPhase;
  readonly arm: (params: ArmParams) => Promise<void>;
  readonly press: (params: PressParams) => Promise<void>;
  readonly confirm: () => Promise<void>;
  readonly cancel: () => void;
  readonly askSync: () => void;
  readonly confirmSync: () => Promise<void>;
  readonly dismiss: () => void;
  readonly recover: (action: NonNullable<BlockerCopy['action']>) => void;
};

const IDLE: ReviewPushPhase = { kind: 'idle' };

const IN_FLIGHT: ReadonlySet<ReviewPushPhase['kind']> = new Set([
  'preparing',
  'pushing',
  'syncing',
]);

type RunParams = {
  readonly preview: ResolvePublicationPreview;
  readonly hasPanel: boolean;
};

type ClosePreparationParams = {
  readonly target: SessionId;
  readonly publicationId: string;
};

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
  const phaseRef = useRef<ReviewPushPhase>(IDLE);
  const armedThreadIds = useRef<ReadonlyArray<string> | undefined>(undefined);
  const { source } = useActiveReviewSource({ sessionId });
  const provider = REVIEW_SOURCE_LABEL[source?.kind ?? 'github'];

  const move = useCallback((next: ReviewPushPhase): void => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const closePreparation = useCallback(
    ({ target, publicationId }: ClosePreparationParams): void => {
      void cancelPublication({ sessionId: target, publicationId }).catch(() => undefined);
    },
    [cancelPublication],
  );

  useEffect(
    () => () => {
      const current = phaseRef.current;
      if (current.kind === 'confirm' && current.preview.publicationId !== null) {
        closePreparation({ target: sessionId, publicationId: current.preview.publicationId });
      }
      phaseRef.current = IDLE;
    },
    [closePreparation, sessionId],
  );

  const run = useCallback(
    async ({ preview, hasPanel }: RunParams): Promise<void> => {
      const { publicationId } = preview;
      if (publicationId === null) {
        return;
      }
      move({ kind: 'pushing', preview, hasPanel });
      try {
        const result = await publishConversations({ sessionId, publicationId });
        switch (result.kind) {
          case 'done':
            move({
              kind: 'result',
              result: pushResultOf({
                outcome: result,
                provider,
                commits: pushCommitCount({ preview }),
              }),
            });
            return;
          case 'push_failed':
            move(
              failed(
                pushFailedSentence({ error: result.error }),
                isRemoteMovedError({ error: result.error }),
              ),
            );
            return;
          case 'busy':
            move(failed(PUSH_BUSY));
            return;
          case 'stale':
            move({
              kind: 'confirm',
              preview: result.preview,
              changed: driftSentence({ drift: result.preview.drift }) ?? PUSH_STALE_FALLBACK,
            });
            return;
          case 'missing':
            closePreparation({ target: sessionId, publicationId });
            move({ kind: 'result', result: { tone: 'done', sentence: PUSH_MISSING } });
            return;
          default: {
            const exhaustive: never = result;
            return exhaustive;
          }
        }
      } catch (error) {
        move(isReportedError(error) ? IDLE : failed(formatError(error)));
      }
    },
    [closePreparation, move, provider, publishConversations, sessionId],
  );

  const arm = useCallback(
    async ({ isRetry, threadIds }: ArmParams): Promise<void> => {
      if (IN_FLIGHT.has(phaseRef.current.kind)) {
        return;
      }
      armedThreadIds.current = threadIds;
      const previous = phaseRef.current;
      move({ kind: 'preparing' });
      if (previous.kind === 'confirm' && previous.preview.publicationId !== null) {
        closePreparation({ target: sessionId, publicationId: previous.preview.publicationId });
      }
      try {
        const preview =
          threadIds !== undefined
            ? await preparePublication({ sessionId, threadIds, isolated: true })
            : isRetry
              ? await retryPublication({ sessionId })
              : await preparePublication({ sessionId });
        if (phaseRef.current.kind !== 'preparing') {
          if (preview.publicationId !== null) {
            closePreparation({ target: sessionId, publicationId: preview.publicationId });
          }
          return;
        }
        const isEmpty =
          preview.publicationId === null && preview.blocker === null && preview.drift.length === 0;
        if (isEmpty) {
          move({
            kind: 'result',
            result: { tone: 'done', sentence: 'Nothing is waiting for the push.' },
          });
          return;
        }
        if (!previewNeedsDecision({ preview })) {
          await run({ preview, hasPanel: false });
          return;
        }
        move({ kind: 'confirm', preview });
      } catch (error) {
        move(isReportedError(error) ? IDLE : failed(formatError(error)));
      }
    },
    [closePreparation, move, preparePublication, retryPublication, run, sessionId],
  );

  const confirm = useCallback(async (): Promise<void> => {
    const current = phaseRef.current;
    if (current.kind !== 'confirm') {
      return;
    }
    await run({ preview: current.preview, hasPanel: true });
  }, [run]);

  const cancel = useCallback((): void => {
    const current = phaseRef.current;
    const publicationId = current.kind === 'confirm' ? current.preview.publicationId : null;
    move(IDLE);
    if (publicationId !== null) {
      closePreparation({ target: sessionId, publicationId });
    }
  }, [closePreparation, move, sessionId]);

  const press = useCallback(
    async ({ isRetry }: PressParams): Promise<void> => {
      const kind = phaseRef.current.kind;
      if (kind === 'confirm' || kind === 'sync_confirm') {
        cancel();
        return;
      }
      await arm({ isRetry });
    },
    [arm, cancel],
  );

  const askSync = useCallback((): void => move({ kind: 'sync_confirm' }), [move]);

  const confirmSync = useCallback(async (): Promise<void> => {
    const mountId = syncMountIdOf({ sessionId });
    if (mountId === null) {
      move(failed(SYNC_COPY.noBranch));
      return;
    }
    move({ kind: 'syncing' });
    try {
      const outcome = await syncBranchWithRemote({ sessionId, mountId });
      switch (outcome.kind) {
        case 'synced':
        case 'nothing':
          move(IDLE);
          await arm({ isRetry: true, threadIds: armedThreadIds.current });
          return;
        case 'conflict':
          move(failed(SYNC_COPY.conflict));
          return;
        case 'busy':
          move(failed(PUSH_BUSY));
          return;
        case 'failed':
          move(failed(outcome.message));
          return;
        default: {
          const exhaustive: never = outcome;
          return exhaustive;
        }
      }
    } catch (error) {
      move(isReportedError(error) ? IDLE : failed(formatError(error)));
    }
  }, [arm, move, sessionId, syncBranchWithRemote]);

  const recover = useCallback(
    (action: NonNullable<BlockerCopy['action']>): void => {
      if (action === 'see_missing') {
        const state = useAppStore.getState();
        const facts = state.sessionThreadGit[sessionId] ?? {};
        const threadId =
          Object.entries(facts).find(
            ([, item]) => item.gitState === 'missing' && item.missing?.wasPushed !== true,
          )?.[0] ?? null;
        cancel();
        if (threadId !== null) {
          openReviewComment({ navigate: state.navigate, sessionId, threadId });
        }
        return;
      }
      if (action === 'sync') {
        cancel();
        move({ kind: 'sync_confirm' });
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
    [cancel, move, navigate, openDiffLens, sessionId],
  );

  return {
    phase,
    arm,
    press,
    confirm,
    cancel,
    askSync,
    confirmSync,
    dismiss: useCallback(() => move(IDLE), [move]),
    recover,
  };
};
