import type { ResolvePublicationThread, ResolveQueueItem, ResolveThread } from '@goodboy/types';

export const resolveDeliveryReceiptsFor = ({
  item,
  thread,
  deliveryReceipts,
}: {
  readonly item: ResolveQueueItem;
  readonly thread: ResolveThread;
  readonly deliveryReceipts: ReadonlyArray<ResolvePublicationThread>;
}): ReadonlyArray<ResolvePublicationThread> =>
  deliveryReceipts.filter(
    (receipt) => receipt.threadId === thread.threadId && receipt.revision === item.approvedRevision,
  );

export const isDeliveryComplete = ({
  receipt,
}: {
  readonly receipt: ResolvePublicationThread;
}): boolean =>
  (receipt.replyPhase === 'posted' || receipt.replyPhase === 'skipped') &&
  (receipt.resolvePhase === 'resolved' || receipt.resolvePhase === 'skipped');
