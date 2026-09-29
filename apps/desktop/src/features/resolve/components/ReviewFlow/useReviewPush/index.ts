import { useCallback, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { ResolvePublicationPreview, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { agentPlace } from '../../../../../store/slices/navigation/place';
import { isReportedError } from '../../../../../store/slices/notifications/reportedError';
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
  | { readonly kind: 'result'; readonly result: PushResult };

export type ReviewPush = {
  readonly phase: ReviewPushPhase;
  readonly arm: (params: { readonly isRetry: boolean }) => Promise<void>;
  readonly confirm: () => Promise<void>;
  readonly cancel: () => void;
  readonly dismiss: () => void;
  readonly recover: (action: NonNullable<BlockerCopy['action']>) => void;
};

const IDLE: ReviewPushPhase = { kind: 'idle' };

const failed = (sentence: string): ReviewPushPhase => ({
  kind: 'result',
  result: { tone: 'failed', sentence },
});

export const useReviewPush = ({ sessionId }: { readonly sessionId: SessionId }): ReviewPush => {
  const preparePublication = useAppStore((s) => s.preparePublication);
  const retryPublication = useAppStore((s) => s.retryPublication);
  const publishConversations = useAppStore((s) => s.publishConversations);
  const cancelPublication = useAppStore((s) => s.cancelPublication);
  const refreshSessionPrDetail = useAppStore((s) => s.refreshSessionPrDetail);
  const openDiffLens = useAppStore((s) => s.openDiffLens);
  const navigate = useAppStore((s) => s.navigate);
  const [phase, setPhase] = useState<ReviewPushPhase>(IDLE);

  const arm = useCallback(
    async ({ isRetry }: { readonly isRetry: boolean }): Promise<void> => {
      setPhase({ kind: 'preparing' });
      try {
        const preview = isRetry
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
          setPhase({ kind: 'result', result: pushResultOf({ outcome: result }) });
          return;
        case 'push_failed':
          setPhase(failed(pushFailedSentence({ error: result.error })));
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
  }, [phase, publishConversations, sessionId]);

  const cancel = useCallback((): void => {
    const publicationId = phase.kind === 'confirm' ? phase.preview.publicationId : null;
    setPhase(IDLE);
    if (publicationId !== null) {
      void cancelPublication({ sessionId, publicationId }).catch(() => undefined);
    }
  }, [cancelPublication, phase, sessionId]);

  const recover = useCallback(
    (action: NonNullable<BlockerCopy['action']>): void => {
      if (action === 'recheck_fix') {
        void arm({ isRetry: false });
        return;
      }
      if (action === 'refresh') {
        void refreshSessionPrDetail(sessionId, { force: true }).then(() => arm({ isRetry: false }));
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
    [arm, navigate, openDiffLens, refreshSessionPrDetail, sessionId],
  );

  return {
    phase,
    arm,
    confirm,
    cancel,
    dismiss: useCallback(() => setPhase(IDLE), []),
    recover,
  };
};
