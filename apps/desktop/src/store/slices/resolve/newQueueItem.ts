import type { ResolveQueueItem, SessionId } from '@goodboy/types';

type Params = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly candidateRevision: number;
};

export const newQueueItem = ({
  sessionId,
  threadId,
  candidateRevision,
}: Params): ResolveQueueItem => {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    sessionId,
    threadId,
    generation: 0,
    reopenedFromItemId: null,
    candidateRevision,
    approvalState: 'none',
    approvedRevision: null,
    approvedReplyHash: null,
    integratedSha: null,
    deferredAt: null,
    deliveredAt: null,
    supersededAt: null,
    createdAt: now,
    updatedAt: now,
  };
};
