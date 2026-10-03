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
import { useActiveReviewSource } from '../useActiveReviewSource';
import { useResolveDeliveryReceipts } from '../useResolveDeliveryReceipts';

const EMPTY_QUEUE_ITEMS: ReadonlyArray<ResolveQueueItemWithThread> = [];
const EMPTY_ATTEMPTS: ReadonlyArray<ResolveAttempt> = [];
const EMPTY_PUBLICATIONS: ReadonlyArray<ResolvePublication> = [];
const NO_ROWS: ReadonlyArray<ResolveQueueRow> = [];

type Params = {
  readonly sessionId: SessionId;
  readonly isEnabled?: boolean;
};

export const useResolveQueueRows = ({
  sessionId,
  isEnabled = true,
}: Params): ReadonlyArray<ResolveQueueRow> => {
  const { source } = useActiveReviewSource({ sessionId });
  const comments = source?.comments ?? (EMPTY_ARRAY as ReadonlyArray<PrComment>);
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
      isEnabled
        ? buildResolveQueueRows({
            entries: queueItems,
            attempts,
            deliveryReceipts,
            comments,
            notes,
          })
        : NO_ROWS,
    [attempts, comments, deliveryReceipts, isEnabled, notes, queueItems],
  );
};
