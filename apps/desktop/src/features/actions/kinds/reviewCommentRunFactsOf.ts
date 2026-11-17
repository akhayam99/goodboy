import type { SessionId } from '@goodboy/types';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import type { AppStore } from '../../../store/store';
import type { ResolveQueueRow } from '../../resolve/buildResolveQueueRows';
import { commentLaneOf } from '../../resolve/commentLaneOf';
import { commentRunOf } from '../../resolve/commentRunOf';
import { commentRunThreadIdsOf } from '../../resolve/commentRunThreadIdsOf';
import type { ReviewCommentFacts } from './reviewComment';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly row: ResolveQueueRow;
};

export const reviewCommentRunFactsOf = ({
  state,
  sessionId,
  row,
}: Params): Pick<ReviewCommentFacts, 'lane' | 'runAgentId' | 'canStartRun'> => {
  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  return {
    lane: commentLaneOf({ row, inRunThreadIds: new Set(commentRunThreadIdsOf({ agents })) }),
    runAgentId: commentRunOf({ agents, threadId: row.thread.threadId }),
    canStartRun: sessionById(state.sessions, sessionId)?.workspaceId != null,
  };
};
