import { useMemo } from 'react';
import type {
  DiffComment,
  PrComment,
  ResolveAttempt,
  ResolvePublication,
  ResolveQueueItemWithThread,
  SessionId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { buildResolveQueueRows, type ResolveQueueRow } from '../../buildResolveQueueRows';
import { useResolveDeliveryReceipts } from '../useResolveDeliveryReceipts';

const EMPTY_QUEUE_ITEMS: ReadonlyArray<ResolveQueueItemWithThread> = [];
const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];
const EMPTY_PUBLICATIONS: ReadonlyArray<ResolvePublication> = [];

type Params = {
  readonly sessionId: SessionId;
};

export const useResolveQueueRows = ({ sessionId }: Params): ReadonlyArray<ResolveQueueRow> => {
  const comments = useAppStore(
    (s) =>
      s.sessionGithub[sessionId]?.detail?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>),
  );
  const notes = useAppStore(
    (s) => s.diffComments[sessionId] ?? (EMPTY_ARRAY as ReadonlyArray<DiffComment>),
  );
  const queueItems = useAppStore((s) => s.sessionResolveQueueItems[sessionId] ?? EMPTY_QUEUE_ITEMS);
  const attempts = useAppStore((s) => s.sessionResolveAttempts[sessionId] ?? EMPTY_ATTEMPTS);
  const publications = useAppStore(
    (s) => s.sessionResolvePublications[sessionId] ?? EMPTY_PUBLICATIONS,
  );
  const deliveryReceipts = useResolveDeliveryReceipts({ publications });

  return useMemo(
    () =>
      buildResolveQueueRows({
        entries: queueItems,
        attempts,
        deliveryReceipts,
        comments,
        notes,
      }),
    [attempts, comments, deliveryReceipts, notes, queueItems],
  );
};
