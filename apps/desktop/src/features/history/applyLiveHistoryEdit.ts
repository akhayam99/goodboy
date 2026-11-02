import type { HistoryPlanArgs } from '@goodboy/types';
import { invokeHistory } from './invokeHistory';
import type { HistoryLiveOutcome } from './historyLiveTypes';

type Params = {
  readonly plan: HistoryPlanArgs;
  readonly branch: string;
  readonly shouldStash: boolean;
};

export const applyLiveHistoryEdit = ({ plan, branch, shouldStash }: Params) =>
  invokeHistory<HistoryLiveOutcome>({
    command: 'history_live_edit',
    args: { args: { request: { plan, branch }, shouldStash } },
  });
