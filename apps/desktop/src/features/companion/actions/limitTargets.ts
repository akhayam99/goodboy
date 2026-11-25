import type { SessionId } from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';

type Params = {
  readonly store: AppStore;
  readonly sessionId: SessionId;
  readonly runId: string;
};

export const isLimitRunOfSession = ({ store, sessionId, runId }: Params): boolean => {
  const session = sessionById(store.sessions, sessionId);
  if (session?.workflowRuns.some((run) => run.id === runId) === true) {
    return true;
  }
  return (store.autoTreeViews?.[sessionId] ?? []).some((view) => view.tree.id === runId);
};
