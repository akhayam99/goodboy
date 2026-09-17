import type { ResolveQueueItem } from '@goodboy/types';
import type { ResolveCandidateWithItems } from '../../store/slices/resolve/state';
import type { ResolveQueueRow } from './buildResolveQueueRows';

export type SharedCandidateMember = Readonly<{
  queueItemId: string;
  threadId: string;
  title: string | null;
  approvalState: ResolveQueueItem['approvalState'];
}>;

type Params = Readonly<{
  queueItemId: string;
  candidates: ReadonlyArray<ResolveCandidateWithItems>;
  rows: ReadonlyArray<ResolveQueueRow>;
}>;

export const sharedCandidateThreadIds = ({
  queueItemId,
  candidates,
  rows,
}: Params): ReadonlyArray<SharedCandidateMember> => {
  const holding = candidates.filter(
    ({ candidate, items }) =>
      candidate.state === 'ready' && items.some((item) => item.queueItemId === queueItemId),
  );
  const held = holding[holding.length - 1] ?? null;
  if (held === null) {
    return [];
  }
  return held.items.flatMap<SharedCandidateMember>((member) => {
    if (member.queueItemId === queueItemId) {
      return [];
    }
    const row = rows.find(({ item }) => item.id === member.queueItemId);
    if (row === undefined) {
      return [];
    }
    return [
      {
        queueItemId: member.queueItemId,
        threadId: row.thread.threadId,
        title: row.reviewerNote?.body ?? null,
        approvalState: row.item.approvalState,
      },
    ];
  });
};

export const sharedCandidateBlocker = ({
  members,
}: {
  readonly members: ReadonlyArray<SharedCandidateMember>;
}): 'deferred' | 'wont_fix' | null => {
  if (members.some((member) => member.approvalState === 'deferred')) {
    return 'deferred';
  }
  if (members.some((member) => member.approvalState === 'wont_fix')) {
    return 'wont_fix';
  }
  return null;
};
