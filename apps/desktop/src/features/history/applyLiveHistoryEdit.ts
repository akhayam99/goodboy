import type { HistoryPlanArgs } from '@goodboy/types';
import { invokeCommand } from '../../shared/lib/invokeCommand';
import type { HistoryLiveOutcome } from './historyLiveTypes';

type Params = {
  readonly plan: HistoryPlanArgs;
  readonly branch: string;
  readonly shouldStash: boolean;
};

export const applyLiveHistoryEdit = ({ plan, branch, shouldStash }: Params) =>
  invokeCommand<HistoryLiveOutcome>('history_live_edit', {
    args: { request: { plan, branch }, shouldStash },
  });
