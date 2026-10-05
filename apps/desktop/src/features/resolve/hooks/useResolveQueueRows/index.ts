import { useMemo } from 'react';
import type {
  PrComment,
  ResolveAttempt,
  ResolvePublication,
  ResolveQueueItemWithThread,
  SessionId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { buildResolveQueueRows, type ResolveQueueRow } from '../../buildResolveQueueRows';
import { useBranchNotes } from '../../notes/useBranchNotes';
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
  const { all: notes, onBranch } = useBranchNotes({ sessionId });
  const hiddenNoteIds = useMemo(() => {
    const visible = new Set(onBranch.map((note) => note.id));
    return new Set(notes.filter((note) => !visible.has(note.id)).map((note) => note.id));
  }, [notes, onBranch]);
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
            entries: queueItems.filter(
              ({ thread }) =>
                thread.originKind !== 'diff_comment' ||
                thread.diffCommentId === null ||
                !hiddenNoteIds.has(thread.diffCommentId),
            ),
            attempts,
            deliveryReceipts,
            comments,
            notes,
          })
        : NO_ROWS,
    [attempts, comments, deliveryReceipts, hiddenNoteIds, isEnabled, notes, queueItems],
  );
};
