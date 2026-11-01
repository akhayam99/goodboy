import type { SessionId, WorkflowRunId } from '@goodboy/types';
import type { SpendLimitStop } from '../budgetBlock';
import type { GetFn, SetFn } from '../types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly stop: SpendLimitStop;
};

export const announceRunBudget = ({ set, get, sessionId, workflowRunId, stop }: Params): void => {
  if (get().announcedRunBudget[workflowRunId] === stop.limitUsd) {
    return;
  }
  set((state) => ({
    announcedRunBudget: { ...state.announcedRunBudget, [workflowRunId]: stop.limitUsd },
  }));
  void get().emitNotification({
    kind: 'budget-cap',
    severity: 'warning',
    title: 'Run is over its limit',
    body: stop.message,
    sessionId,
    action: { kind: 'open-budget', sessionId },
  });
};
