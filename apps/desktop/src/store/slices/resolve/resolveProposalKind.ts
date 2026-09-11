import type { ResolveQueueItem, ResolveThread } from '@goodboy/types';

export type ResolveProposalKind = 'fix' | 'reply_only' | 'none';

type Params = {
  readonly item: ResolveQueueItem;
  readonly thread: ResolveThread;
};

export const resolveProposalKind = ({ item, thread }: Params): ResolveProposalKind => {
  if (item.integratedSha !== null || (thread.commitShas?.length ?? 0) > 0) {
    return 'fix';
  }
  const draft = thread.replyDraft;
  if (draft !== null && draft.trim() !== '') {
    return 'reply_only';
  }
  return 'none';
};
