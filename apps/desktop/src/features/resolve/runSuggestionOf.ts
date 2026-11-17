import type { ResolveThread } from '@goodboy/types';
import type { AppStore } from '../../store/store';
import { commentRunOf } from './commentRunOf';
import { NEEDS_RUN_REASON } from './needsRunReason';

type Params = {
  readonly state: Pick<AppStore, 'sessionPhaseRuns'>;
  readonly thread: Pick<ResolveThread, 'sessionId' | 'threadId' | 'state' | 'stateReason'>;
};

export const runSuggestionOf = ({ state, thread }: Params): string | null => {
  const reason = NEEDS_RUN_REASON.reasonOf({ stateReason: thread.stateReason });
  if (thread.state !== 'failed' || reason === null) {
    return null;
  }
  const agents = state.sessionPhaseRuns[thread.sessionId] ?? [];
  return commentRunOf({ agents, threadId: thread.threadId }) === null ? reason : null;
};
