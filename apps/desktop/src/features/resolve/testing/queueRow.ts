import type { ResolveStage, ResolveThread, SessionId } from '@goodboy/types';
import type { ResolveQueueRow } from '../buildResolveQueueRows';
import type { ResolveProposalKind } from '../../../store/slices/resolve/resolveProposalKind';
import type { ResolveFailedStep } from '../resolveRowState';

export const queueRowAt = ({
  stage,
  threadId = 'PRRT_1',
  proposalKind = 'fix',
  failedStep = null,
  originKind = 'review_comment',
  sourceKind = 'github',
  deliveredAt = null,
  approvalState = 'none',
}: {
  readonly stage: ResolveStage;
  readonly threadId?: string;
  readonly proposalKind?: ResolveProposalKind;
  readonly failedStep?: ResolveFailedStep | null;
  readonly originKind?: ResolveThread['originKind'];
  readonly sourceKind?: 'github' | 'gitlab' | 'bitbucket';
  readonly deliveredAt?: number | null;
  readonly approvalState?: ResolveQueueRow['item']['approvalState'];
}): ResolveQueueRow => ({
  thread: {
    id: `thread-row-${threadId}`,
    sessionId: 'session-1' as SessionId,
    projectId: null,
    prNumber: 318,
    threadId,
    originKind,
    sourceKind,
    diffCommentId: null,
    state: stage === 'failed' ? 'failed' : 'open',
    stage,
    stateReason: failedStep === 'push' ? 'publication_failed:push' : null,
    revision: 1,
    generation: 1,
    reopenedFromThreadId: null,
    activeAttemptId: null,
    disposition: null,
    replyDraft: null,
    commitShas: null,
    fixupOfSha: null,
    replacesSha: null,
    question: null,
    replyPostedAt: null,
    replyId: null,
    githubResolved: null,
    closedAt: null,
    closedSource: null,
    createdAt: 1,
    updatedAt: 1,
  },
  item: {
    id: `item-row-${threadId}`,
    sessionId: 'session-1' as SessionId,
    threadId,
    generation: 1,
    reopenedFromItemId: null,
    candidateRevision: 1,
    approvalState,
    approvedRevision: null,
    approvedReplyHash: null,
    integratedSha: null,
    deferredAt: null,
    deliveredAt,
    supersededAt: null,
    createdAt: 1,
    updatedAt: 1,
  },
  commentThread: null,
  status: 'new',
  rowState: {
    state: stage === 'failed' ? 'failed' : 'new',
    node: 'queued',
    sentence: null,
    action: null,
    failedStep,
    isRemoteMoved: false,
  },
  attempt: null,
  reviewerNote: null,
  proposal: null,
  proposalKind,
  coveredThreadIds: [],
  delivery: null,
});
