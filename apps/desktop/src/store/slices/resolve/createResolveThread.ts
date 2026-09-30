import type { Agent, ProjectId, ResolveSourceKind, ResolveThread, SessionId } from '@goodboy/types';
import { providerThreadIdOf, sourceKindOfThreadId } from './resolveThreadSource';

type Params = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly agent?: Agent;
  readonly projectId?: ProjectId | null;
  readonly prNumber?: number | null;
  readonly diffCommentId?: string | null;
  readonly generation?: number;
  readonly reopenedFromThreadId?: string | null;
  readonly sourceKind?: ResolveSourceKind;
};

export const createResolveThread = ({
  sessionId,
  threadId,
  agent,
  projectId = null,
  prNumber = null,
  diffCommentId = null,
  generation = 0,
  reopenedFromThreadId = null,
  sourceKind = sourceKindOfThreadId({ threadId }),
}: Params): ResolveThread => {
  const numberFromUrl = agent?.sourceCommentUrl?.match(/\/(?:pull|-\/merge_requests)\/(\d+)/)?.[1];
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    sessionId,
    threadId,
    projectId,
    prNumber: numberFromUrl === undefined ? prNumber : Number(numberFromUrl),
    originKind: diffCommentId === null ? (agent?.sourceKind ?? 'review_comment') : 'diff_comment',
    diffCommentId,
    state: 'open',
    stage: 'new',
    stateReason: null,
    revision: 0,
    generation,
    reopenedFromThreadId,
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
    createdAt: now,
    updatedAt: now,
    sourceKind: diffCommentId === null ? sourceKind : 'local',
    providerThreadId:
      diffCommentId === null
        ? providerThreadIdOf({ row: { threadId, providerThreadId: null } })
        : null,
  };
};
